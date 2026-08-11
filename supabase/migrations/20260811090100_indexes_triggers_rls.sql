-- =============================================================================
-- Indizes, Trigger-Verdrahtung, RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Indizes
-- ---------------------------------------------------------------------------

-- Firmen: Suche über Name/Domain/Stadt, plus die üblichen Filterspalten
create index companies_name_trgm    on public.companies using gin (name gin_trgm_ops);
create index companies_city_trgm    on public.companies using gin (city gin_trgm_ops);
create index companies_domain       on public.companies (lower(domain));
create index companies_status       on public.companies (status);
create index companies_owner        on public.companies (owner_id);
create index companies_created_at   on public.companies (created_at desc);
create index companies_custom_gin   on public.companies using gin (custom_fields jsonb_path_ops);

-- Kontakte
create index contacts_fullname_trgm on public.contacts using gin (full_name gin_trgm_ops);
create index contacts_email_trgm    on public.contacts using gin (email gin_trgm_ops);
create index contacts_email_lower   on public.contacts (lower(email)) where email is not null;
create index contacts_company       on public.contacts (company_id);
create index contacts_owner         on public.contacts (owner_id);
create index contacts_status        on public.contacts (status);
create index contacts_created_at    on public.contacts (created_at desc);
create index contacts_custom_gin    on public.contacts using gin (custom_fields jsonb_path_ops);

-- Deals: das Board filtert nach Pipeline+Status und sortiert nach position
create index deals_title_trgm       on public.deals using gin (title gin_trgm_ops);
create index deals_board            on public.deals (pipeline_id, status, stage_id, position);
create index deals_stage            on public.deals (stage_id);
create index deals_contact          on public.deals (contact_id);
create index deals_company          on public.deals (company_id);
create index deals_owner            on public.deals (owner_id);
create index deals_status           on public.deals (status);
create index deals_expected_close   on public.deals (expected_close_date) where status = 'open';
create index deals_won_at           on public.deals (won_at) where status = 'won';
create index deals_created_at       on public.deals (created_at desc);

create index stages_pipeline        on public.stages (pipeline_id, position);
create index stage_history_deal     on public.deal_stage_history (deal_id, changed_at);

-- Aktivitäten: die „Was steht an?"-Abfragen laufen über due_at + done
create index activities_open_due    on public.activities (due_at) where not done;
create index activities_owner_due   on public.activities (owner_id, due_at) where not done;
create index activities_deal        on public.activities (deal_id);
create index activities_contact     on public.activities (contact_id);
create index activities_company     on public.activities (company_id);
create index activities_created_at  on public.activities (created_at desc);

create index notes_deal             on public.notes (deal_id);
create index notes_contact          on public.notes (contact_id);
create index notes_company          on public.notes (company_id);

create index taggings_entity        on public.taggings (entity, entity_id);

create index conversations_recent   on public.conversations (last_message_at desc) where not is_archived;
create index conversations_contact  on public.conversations (contact_id);
create index messages_conversation  on public.messages (conversation_id, sent_at);

create index appointments_window    on public.appointments (starts_at, ends_at);
create index appointments_contact   on public.appointments (contact_id);
create index appointments_deal      on public.appointments (deal_id);

create index audit_log_entity       on public.audit_log (entity, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at überall verdrahten
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'companies', 'contacts', 'pipelines', 'stages', 'deals',
    'activities', 'notes', 'conversations', 'booking_settings', 'appointments'
  ] loop
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Audit auf den fachlich relevanten Tabellen
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['companies', 'contacts', 'deals'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.write_audit()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- Grundregel: aktives Teammitglied darf lesen und schreiben. Kein USING (true).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'companies', 'contacts', 'pipelines', 'stages', 'lost_reasons',
    'deals', 'deal_stage_history', 'activities', 'notes', 'tags', 'taggings',
    'custom_field_defs', 'conversations', 'messages', 'booking_settings',
    'appointments', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Fachdaten: volles CRUD für Teammitglieder
do $$
declare t text;
begin
  foreach t in array array[
    'companies', 'contacts', 'deals', 'activities', 'notes', 'tags', 'taggings',
    'conversations', 'messages', 'appointments'
  ] loop
    execute format(
      'create policy "member_all_%s" on public.%I
         for all to authenticated
         using (public.is_member()) with check (public.is_member())', t, t);
  end loop;
end $$;

-- Konfiguration: alle lesen, nur Admins ändern
do $$
declare t text;
begin
  foreach t in array array[
    'pipelines', 'stages', 'lost_reasons', 'custom_field_defs'
  ] loop
    execute format(
      'create policy "member_read_%s" on public.%I
         for select to authenticated using (public.is_member())', t, t);
    execute format(
      'create policy "admin_write_%s" on public.%I
         for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- Profile: jeder sieht das Team, ändern darf man sich selbst; Rolle und
-- Aktivstatus bleiben Admins vorbehalten.
create policy "profiles_read" on public.profiles
  for select to authenticated using (public.is_member());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role      = (select role      from public.profiles p where p.id = auth.uid())
    and is_active = (select is_active from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Buchungseinstellungen: Team liest alles, jeder pflegt seine eigenen
create policy "booking_read" on public.booking_settings
  for select to authenticated using (public.is_member());

create policy "booking_write_own" on public.booking_settings
  for all to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Historie und Audit: nur lesen, geschrieben wird ausschließlich per Trigger
-- (SECURITY DEFINER, umgeht RLS bewusst).
create policy "stage_history_read" on public.deal_stage_history
  for select to authenticated using (public.is_member());

create policy "audit_read" on public.audit_log
  for select to authenticated using (public.is_admin());

-- Anonyme Rolle bekommt auf keiner Tabelle eine Policy. Der Zugriff der
-- öffentlichen Buchungsseite läuft ausschließlich über die SECURITY-DEFINER-
-- Funktionen in der nächsten Migration.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
