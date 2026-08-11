-- =============================================================================
-- Vorstufe: Altbestand beiseite räumen
--
-- Läuft VOR den init-Migrationen. Das produktive Backend fährt noch das
-- Vorgängerschema; dessen Tabellen und zwei Enum-Typen kollidieren mit dem
-- neuen Schema. Statt zu löschen werden sie umbenannt — die Daten bleiben
-- vollständig erhalten und dienen als Sicherheitsnetz, bis die Übernahme
-- geprüft ist.
--
-- Aufräumen erst danach und bewusst: siehe 20260811091000_legacy_uebernahme.sql
-- =============================================================================

-- Der Profil-Trigger wird in der Init-Migration neu angelegt.
drop trigger if exists on_auth_user_created on auth.users;

-- ---------------------------------------------------------------------------
-- Enum-Typen: nur diese beiden kollidieren mit den neuen Definitionen.
--   alt activity_type:   call | email | meeting | task | note
--   neu activity_type:   call | meeting | task | email | deadline | lunch
--   alt contact_status:  lead | prospect | customer | inactive
--   neu contact_status:  lead | active | inactive
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
              where n.nspname = 'public' and t.typname = 'activity_type') then
    execute 'alter type public.activity_type rename to legacy_activity_type';
  end if;

  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
              where n.nspname = 'public' and t.typname = 'contact_status') then
    execute 'alter type public.contact_status rename to legacy_contact_status';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tabellen umbenennen. Indizes, Constraints und Trigger wandern automatisch
-- mit; die alten RLS-Policies bleiben an den umbenannten Tabellen hängen und
-- werden deshalb unten zusätzlich entschärft.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'activities', 'appointments', 'booking_settings', 'companies', 'contacts',
    'conversations', 'deals', 'messages', 'pipeline_automations',
    'review_requests', 'reviews', 'snapshots', 'voice_leads'
  ] loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I rename to %I', t, 'legacy_' || t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Der Altbestand trug `USING (true)`-Policies. Umbenennen allein nimmt den
-- Zugriff nicht weg — ohne diesen Schritt wären die Kundendaten unter den
-- neuen Tabellennamen weiterhin über die API abrufbar.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'legacy_activities', 'legacy_appointments', 'legacy_booking_settings',
    'legacy_companies', 'legacy_contacts', 'legacy_conversations',
    'legacy_deals', 'legacy_messages', 'legacy_pipeline_automations',
    'legacy_review_requests', 'legacy_reviews', 'legacy_snapshots',
    'legacy_voice_leads'
  ] loop
    if not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = t) then
      continue;
    end if;

    -- sämtliche Alt-Policies entfernen
    for p in select policyname from pg_policies
              where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Ab hier ist der Altbestand nur noch über die Service-Rolle erreichbar,
-- also über die Übernahme-Migration und den SQL-Editor — nicht mehr über
-- den Anon-Key aus dem Browser.
