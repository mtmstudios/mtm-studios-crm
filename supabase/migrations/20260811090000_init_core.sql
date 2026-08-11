-- =============================================================================
-- CRM — Kernschema
-- Mandantenmodell: ein Team, alle authentifizierten und aktiven Mitglieder
-- sehen die gemeinsamen Daten (wie Pipedrive/HubSpot). Zuordnung erfolgt
-- fachlich über owner_id, nicht über Sichtbarkeit.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role       as enum ('admin', 'member');
create type public.entity_type    as enum ('contact', 'company', 'deal');
create type public.company_status as enum ('lead', 'prospect', 'customer', 'partner', 'inactive');
create type public.contact_status as enum ('lead', 'active', 'inactive');
create type public.deal_status    as enum ('open', 'won', 'lost');
create type public.activity_type  as enum ('call', 'meeting', 'task', 'email', 'deadline', 'lunch');
create type public.channel_type   as enum ('email', 'sms', 'whatsapp');
create type public.direction_type as enum ('inbound', 'outbound');
create type public.field_type     as enum ('text', 'textarea', 'number', 'currency', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email', 'phone');
create type public.appt_status    as enum ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show');

-- ---------------------------------------------------------------------------
-- Profile / Rollen
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        public.app_role not null default 'member',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Mitgliedschaftsprüfung. SECURITY DEFINER, damit die RLS-Policies auf anderen
-- Tabellen nicht rekursiv wieder profiles-RLS auslösen.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'admin'
  );
$$;

-- Neuer Auth-User bekommt automatisch ein Profil. Der allererste User wird
-- Admin, alle weiteren Member.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when is_first then 'admin'::public.app_role else 'member'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at-Trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Firmen
-- ---------------------------------------------------------------------------
create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  legal_name      text,
  domain          text,
  website         text,
  industry        text,
  employee_count  int,
  annual_revenue  numeric(14,2),
  phone           text,
  email           text,
  street          text,
  zip             text,
  city            text,
  country         text default 'DE',
  vat_number      text,
  tax_number      text,
  customer_number text,
  status          public.company_status not null default 'lead',
  owner_id        uuid references public.profiles(id) on delete set null,
  description     text,
  custom_fields   jsonb not null default '{}'::jsonb,
  sevdesk_id      text unique,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Kontakte
-- ---------------------------------------------------------------------------
create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  first_name      text,
  last_name       text,
  salutation      text,
  academic_title  text,
  job_title       text,
  email           text,
  phone           text,
  mobile          text,
  company_id      uuid references public.companies(id) on delete set null,
  street          text,
  zip             text,
  city            text,
  country         text default 'DE',
  birthday        date,
  linkedin_url    text,
  status          public.contact_status not null default 'lead',
  owner_id        uuid references public.profiles(id) on delete set null,
  description     text,
  custom_fields   jsonb not null default '{}'::jsonb,
  sevdesk_id      text unique,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Anzeigename, generiert: spart im Frontend jedes Zusammenbauen und macht
  -- die Volltextsuche auf einer Spalte möglich.
  full_name       text generated always as (
                    btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
                  ) stored,
  constraint contacts_name_present check (
    coalesce(first_name, '') <> '' or coalesce(last_name, '') <> ''
  )
);

-- ---------------------------------------------------------------------------
-- Pipelines / Stages / Deals
-- ---------------------------------------------------------------------------
create table public.pipelines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   int not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Es darf höchstens eine Default-Pipeline geben.
create unique index pipelines_single_default
  on public.pipelines ((is_default)) where is_default;

create table public.stages (
  id           uuid primary key default gen_random_uuid(),
  pipeline_id  uuid not null references public.pipelines(id) on delete cascade,
  name         text not null,
  position     int not null default 0,
  probability  int not null default 0 check (probability between 0 and 100),
  rotting_days int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (pipeline_id, position) deferrable initially deferred
);

create table public.lost_reasons (
  id       uuid primary key default gen_random_uuid(),
  label    text not null unique,
  position int not null default 0
);

create table public.deals (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  value               numeric(14,2) not null default 0,
  currency            char(3) not null default 'EUR',
  pipeline_id         uuid not null references public.pipelines(id) on delete restrict,
  stage_id            uuid not null references public.stages(id) on delete restrict,
  contact_id          uuid references public.contacts(id) on delete set null,
  company_id          uuid references public.companies(id) on delete set null,
  owner_id            uuid references public.profiles(id) on delete set null,
  status              public.deal_status not null default 'open',
  probability         int check (probability between 0 and 100),
  expected_close_date date,
  won_at              timestamptz,
  lost_at             timestamptz,
  lost_reason_id      uuid references public.lost_reasons(id) on delete set null,
  lost_comment        text,
  source              text,
  description         text,
  custom_fields       jsonb not null default '{}'::jsonb,
  position            numeric not null default 0,  -- Sortierung innerhalb der Stage-Spalte
  stage_changed_at    timestamptz not null default now(),
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- won/lost müssen konsistent zum Zeitstempel sein
  constraint deals_status_timestamps check (
    (status = 'won'  and won_at  is not null and lost_at is null) or
    (status = 'lost' and lost_at is not null and won_at  is null) or
    (status = 'open' and won_at  is null     and lost_at is null)
  )
);

-- Stage-Wechsel protokollieren — Grundlage für Conversion- und Velocity-Reports.
create table public.deal_stage_history (
  id            bigserial primary key,
  deal_id       uuid not null references public.deals(id) on delete cascade,
  from_stage_id uuid references public.stages(id) on delete set null,
  to_stage_id   uuid not null references public.stages(id) on delete cascade,
  changed_by    uuid references public.profiles(id) on delete set null,
  changed_at    timestamptz not null default now()
);

-- Zwei Trigger, weil beide Teile unterschiedliche Zeitpunkte brauchen:
-- stage_changed_at muss BEFORE gesetzt werden (verändert NEW), der
-- Historieneintrag AFTER (die Deal-Zeile muss für den Fremdschlüssel
-- bereits existieren).
create or replace function public.touch_stage_changed()
returns trigger
language plpgsql
as $$
begin
  if new.stage_id is distinct from old.stage_id then
    new.stage_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger deals_touch_stage_changed
  before update of stage_id on public.deals
  for each row execute function public.touch_stage_changed();

create or replace function public.track_deal_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by)
    values (new.id, null, new.stage_id, auth.uid());
  elsif new.stage_id is distinct from old.stage_id then
    insert into public.deal_stage_history (deal_id, from_stage_id, to_stage_id, changed_by)
    values (new.id, old.stage_id, new.stage_id, auth.uid());
  end if;
  return null;
end;
$$;

create trigger deals_track_stage
  after insert or update of stage_id on public.deals
  for each row execute function public.track_deal_stage();

-- ---------------------------------------------------------------------------
-- Aktivitäten / Notizen
-- ---------------------------------------------------------------------------
create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  type             public.activity_type not null default 'task',
  subject          text not null,
  notes            text,
  due_at           timestamptz,
  duration_minutes int,
  done             boolean not null default false,
  done_at          timestamptz,
  deal_id          uuid references public.deals(id) on delete cascade,
  contact_id       uuid references public.contacts(id) on delete cascade,
  company_id       uuid references public.companies(id) on delete cascade,
  owner_id         uuid references public.profiles(id) on delete set null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  deal_id    uuid references public.deals(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_has_parent check (
    num_nonnulls(deal_id, contact_id, company_id) >= 1
  )
);

-- ---------------------------------------------------------------------------
-- Tags (polymorph)
-- ---------------------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,
  color      text not null default 'slate',
  created_at timestamptz not null default now()
);

create table public.taggings (
  tag_id      uuid not null references public.tags(id) on delete cascade,
  entity      public.entity_type not null,
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (tag_id, entity, entity_id)
);

-- ---------------------------------------------------------------------------
-- Custom Fields — Definitionen; Werte liegen als jsonb an der Entität
-- ---------------------------------------------------------------------------
create table public.custom_field_defs (
  id         uuid primary key default gen_random_uuid(),
  entity     public.entity_type not null,
  key        text not null,
  label      text not null,
  field_type public.field_type not null default 'text',
  options    jsonb not null default '[]'::jsonb,
  position   int not null default 0,
  required   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entity, key)
);

-- ---------------------------------------------------------------------------
-- Konversationen / Nachrichten
-- ---------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  subject         text,
  channel         public.channel_type not null default 'email',
  contact_id      uuid references public.contacts(id) on delete set null,
  company_id      uuid references public.companies(id) on delete set null,
  deal_id         uuid references public.deals(id) on delete set null,
  counterparty    text not null,          -- E-Mail-Adresse oder Telefonnummer
  external_id     text,
  last_message_at timestamptz not null default now(),
  unread_count    int not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (channel, counterparty)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction       public.direction_type not null,
  body            text not null,
  body_html       text,
  from_addr       text,
  to_addr         text,
  external_id     text,
  sent_at         timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Konversations-Kopf beim Eintreffen einer Nachricht mitziehen.
create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.sent_at,
         unread_count    = case when new.direction = 'inbound'
                                then unread_count + 1 else unread_count end,
         updated_at      = now()
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- ---------------------------------------------------------------------------
-- Termine / Buchungsseite
-- ---------------------------------------------------------------------------
create table public.booking_settings (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  slug             text not null unique,
  title            text not null,
  description      text,
  duration_minutes int not null default 30,
  buffer_minutes   int not null default 0,
  timezone         text not null default 'Europe/Berlin',
  -- { "mon": [["09:00","17:00"]], "tue": [...], ... }
  availability     jsonb not null default '{}'::jsonb,
  lead_time_hours  int not null default 12,
  horizon_days     int not null default 30,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.appointments (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  location      text,
  meeting_url   text,
  notes         text,
  status        public.appt_status not null default 'scheduled',
  contact_id    uuid references public.contacts(id) on delete set null,
  company_id    uuid references public.companies(id) on delete set null,
  deal_id       uuid references public.deals(id) on delete set null,
  owner_id      uuid references public.profiles(id) on delete set null,
  -- Felder für extern gebuchte Termine (öffentliche Buchungsseite)
  booking_id    uuid references public.booking_settings(id) on delete set null,
  guest_name    text,
  guest_email   text,
  guest_phone   text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint appointments_time_order check (ends_at > starts_at)
);

-- Doppelbuchung pro Bearbeiter verhindern (nur für aktive Termine).
create index appointments_owner_window on public.appointments (owner_id, starts_at, ends_at)
  where status in ('scheduled', 'confirmed');

-- ---------------------------------------------------------------------------
-- Audit-Log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigserial primary key,
  entity      text not null,
  entity_id   uuid not null,
  action      text not null,           -- insert | update | delete
  actor_id    uuid references public.profiles(id) on delete set null,
  changes     jsonb,
  created_at  timestamptz not null default now()
);

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diff     jsonb;
  payload  jsonb;
  row_id   uuid;
begin
  -- NEW/OLD sind je nach Operation nicht gesetzt, daher strikt verzweigen
  -- statt coalesce(new.id, old.id) — letzteres wirft bei DELETE.
  if tg_op = 'DELETE' then
    row_id  := old.id;
    payload := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    row_id  := new.id;
    payload := to_jsonb(new);
  else
    row_id := new.id;

    -- nur tatsächlich geänderte Felder festhalten
    select jsonb_object_agg(key, jsonb_build_object('von', old_row.value, 'nach', new_row.value))
      into diff
      from jsonb_each(to_jsonb(old)) old_row
      join jsonb_each(to_jsonb(new)) new_row using (key)
     where old_row.value is distinct from new_row.value
       and key <> 'updated_at';

    if diff is null or diff = '{}'::jsonb then
      return null;   -- AFTER-Trigger: Rückgabewert wird ohnehin verworfen
    end if;
    payload := diff;
  end if;

  insert into public.audit_log (entity, entity_id, action, actor_id, changes)
  values (tg_table_name, row_id, lower(tg_op), auth.uid(), payload);

  return null;
end;
$$;
