-- =============================================================================
-- Projekte und Dokumente
--
-- Projekte: laufende Arbeit an einem Kunden, mit Abschnitten (Spalten) und
-- Aufgaben. Bewusst KEIN zweites Aufgabensystem — die bestehenden activities
-- bekommen project_id und section_id. Dadurch:
--   - eine Projektaufgabe erscheint auch in "Meine Aufgaben"
--   - sie kann gleichzeitig an Firma, Deal und Projekt hängen
--   - Zeitleiste, Erledigt-Haken und Filter funktionieren unverändert
--
-- Dokumente: Dateien an Firma, Kontakt, Deal oder Projekt. Die Datei liegt in
-- Supabase Storage, die Tabelle hält nur die Metadaten und den Pfad.
-- =============================================================================

create type public.project_status as enum (
  'planung', 'laeuft', 'pausiert', 'abgeschlossen', 'abgebrochen'
);

-- ---------------------------------------------------------------------------
-- Projekte
-- ---------------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  company_id  uuid references public.companies(id) on delete set null,
  deal_id     uuid references public.deals(id) on delete set null,
  owner_id    uuid references public.profiles(id) on delete set null,
  status      public.project_status not null default 'planung',
  color       text not null default 'blue',
  starts_on   date,
  due_on      date,
  completed_at timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Abgeschlossen und ohne Zeitstempel wäre in der Auswertung nicht greifbar
  constraint projects_completed_consistent check (
    (status = 'abgeschlossen') = (completed_at is not null)
  )
);

-- Abschnitte = Spalten im Projektboard.
create table public.project_sections (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Aufgaben um den Projektbezug erweitern
-- ---------------------------------------------------------------------------
alter table public.activities
  add column project_id uuid references public.projects(id) on delete cascade,
  add column section_id uuid references public.project_sections(id) on delete set null,
  -- Sortierung innerhalb einer Spalte; wie im Deal-Board über Zwischenwerte
  add column position numeric not null default 0;

-- Ein neues Projekt bekommt sofort brauchbare Abschnitte, sonst steht man
-- vor einem leeren Board.
create or replace function public.seed_project_sections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_sections (project_id, name, position) values
    (new.id, 'Backlog',      0),
    (new.id, 'Diese Woche',  1),
    (new.id, 'In Arbeit',    2),
    (new.id, 'Review',       3),
    (new.id, 'Fertig',       4);
  return null;
end;
$$;

create trigger projects_seed_sections
  after insert on public.projects
  for each row execute function public.seed_project_sections();

-- Wird die letzte Aufgabe erledigt, ist das Projekt deshalb noch nicht fertig —
-- der Status bleibt bewusst manuell. Aber der Abschluss-Zeitstempel soll
-- konsistent sein.
create or replace function public.touch_project_completed()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'abgeschlossen' and old.status is distinct from 'abgeschlossen' then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status <> 'abgeschlossen' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger projects_touch_completed
  before update of status on public.projects
  for each row execute function public.touch_project_completed();

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Dokumente
-- ---------------------------------------------------------------------------
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  mime_type    text,
  size_bytes   bigint,
  -- Pfad im Storage-Bucket; eindeutig, damit keine zwei Zeilen dieselbe
  -- Datei beanspruchen
  storage_path text not null unique,
  description  text,
  company_id   uuid references public.companies(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete cascade,
  deal_id      uuid references public.deals(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete cascade,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint documents_has_parent check (
    num_nonnulls(company_id, contact_id, deal_id, project_id) >= 1
  )
);

-- ---------------------------------------------------------------------------
-- Indizes
-- ---------------------------------------------------------------------------
create index projects_company        on public.projects (company_id);
create index projects_deal           on public.projects (deal_id);
create index projects_owner          on public.projects (owner_id);
create index projects_status         on public.projects (status);
create index projects_due            on public.projects (due_on) where status in ('planung', 'laeuft');
create index projects_name_trgm      on public.projects using gin (name gin_trgm_ops);

create index project_sections_project on public.project_sections (project_id, position);

create index activities_project      on public.activities (project_id);
create index activities_board        on public.activities (project_id, section_id, position);

create index documents_company       on public.documents (company_id);
create index documents_contact       on public.documents (contact_id);
create index documents_deal          on public.documents (deal_id);
create index documents_project       on public.documents (project_id);
create index documents_created_at    on public.documents (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — gleiche Regel wie bei den übrigen Fachdaten
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['projects', 'project_sections', 'documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy "member_all_%s" on public.%I
         for all to authenticated
         using (public.is_member()) with check (public.is_member())', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Fortschritt je Projekt. Serverseitig, damit die Liste nicht für jedes
-- Projekt die Aufgaben nachladen muss.
-- ---------------------------------------------------------------------------
create or replace function public.project_progress(p_project_ids uuid[] default null)
returns table (
  project_id     uuid,
  aufgaben       bigint,
  erledigt       bigint,
  ueberfaellig   bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id,
         count(a.id),
         count(a.id) filter (where a.done),
         count(a.id) filter (where not a.done and a.due_at < now())
    from public.projects p
    left join public.activities a on a.project_id = p.id
   where p_project_ids is null or p.id = any(p_project_ids)
   group by p.id;
$$;

-- ---------------------------------------------------------------------------
-- Aufgabe im Projektboard verschieben — wie move_deal, nur für Abschnitte.
-- ---------------------------------------------------------------------------
create or replace function public.move_task(
  p_task_id    uuid,
  p_section_id uuid,
  p_before_id  uuid default null,
  p_after_id   uuid default null
)
returns public.activities
language plpgsql
security invoker
set search_path = public
as $$
declare
  pos_before numeric;
  pos_after  numeric;
  neu        numeric;
  ergebnis   public.activities;
begin
  select a.position into pos_after  from public.activities a where a.id = p_after_id;
  select a.position into pos_before from public.activities a where a.id = p_before_id;

  neu := case
    when pos_after is not null and pos_before is not null then (pos_after + pos_before) / 2
    when pos_after  is not null then pos_after + 1024
    when pos_before is not null then pos_before - 1024
    else coalesce((select max(a.position) + 1024 from public.activities a
                    where a.section_id = p_section_id), 0)
  end;

  update public.activities
     set section_id = p_section_id,
         position   = neu
   where id = p_task_id
   returning * into ergebnis;

  return ergebnis;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: privater Bucket für Dokumente.
-- Der Block läuft nur, wenn das storage-Schema existiert — beim Testen gegen
-- ein blankes Postgres gibt es das nicht.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Kein storage-Schema — Bucket-Anlage übersprungen.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit)
  values ('dokumente', 'dokumente', false, 26214400)   -- 25 MB je Datei
  on conflict (id) do nothing;

  -- Bestehende Policies entfernen, damit die Migration wiederholbar bleibt
  execute 'drop policy if exists "dokumente_lesen" on storage.objects';
  execute 'drop policy if exists "dokumente_schreiben" on storage.objects';
  execute 'drop policy if exists "dokumente_loeschen" on storage.objects';

  -- Nur aktive Teammitglieder; der Bucket ist nicht öffentlich, Downloads
  -- laufen über signierte URLs mit kurzer Laufzeit.
  execute $p$
    create policy "dokumente_lesen" on storage.objects
      for select to authenticated
      using (bucket_id = 'dokumente' and public.is_member())
  $p$;
  execute $p$
    create policy "dokumente_schreiben" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'dokumente' and public.is_member())
  $p$;
  execute $p$
    create policy "dokumente_loeschen" on storage.objects
      for delete to authenticated
      using (bucket_id = 'dokumente' and public.is_member())
  $p$;
end $$;
