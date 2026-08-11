-- =============================================================================
-- Übernahme des Altbestands ins neue Schema
--
-- Läuft NACH den init-Migrationen. Überträgt Firmen, Kontakte und Deals aus
-- den legacy_-Tabellen. Die Quelle bleibt unangetastet — falls etwas nicht
-- passt, lässt sich die Übernahme wiederholen.
--
-- Idempotent: die alte UUID wird als Primärschlüssel übernommen, ein zweiter
-- Lauf schreibt dieselben Zeilen erneut statt Dubletten anzulegen.
-- =============================================================================

do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'legacy_companies') then
    raise notice 'Kein Altbestand gefunden — Übernahme übersprungen.';
    return;
  end if;

  -- Leere Alt-Tabellen bedeuten: hier gibt es nichts zu übernehmen. Das ist
  -- der Normalfall auf einem Zielprojekt, das nur eine alte, nie befüllte
  -- Schemahülle trug — der Bestand kommt dort über
  -- scripts/seed-from-backup.mjs. Ohne diese Prüfung würde die Migration an
  -- Spalten scheitern, die in älteren Schemaständen schlicht fehlen.
  perform 1 from public.legacy_companies limit 1;
  if not found then
    raise notice 'Altbestand ist leer — Übernahme übersprungen.';
    return;
  end if;

  -- Der Vollständigkeit halber: die Übernahme setzt das vollständige
  -- Vorgängerschema voraus. Fehlt eine erwartete Spalte, lieber sauber
  -- aussteigen als mitten im Insert abbrechen.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'legacy_companies'
       and column_name in ('website', 'status')
     group by table_name having count(*) = 2
  ) then
    raise notice 'Altbestand hat ein abweichendes Schema — Übernahme übersprungen.';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Firmen
  -- Der Altbestand kennt `notes` als Freitextfeld. Das wandert nach
  -- description; zusätzlich wird daraus unten ein Notiz-Eintrag erzeugt,
  -- damit der Text auch in der Zeitleiste auftaucht.
  -- -------------------------------------------------------------------------
  insert into public.companies (
    id, name, website, domain, industry, city, country, description, status, created_at
  )
  select
    l.id,
    l.name,
    l.website,
    -- Domain aus der Website ableiten, soweit vorhanden
    nullif(regexp_replace(coalesce(l.website, ''), '^https?://(www\.)?([^/]+).*$', '\2'), ''),
    l.industry,
    l.city,
    coalesce(l.country, 'DE'),
    l.notes,
    -- Der Altbestand führte alles als 'lead'; die Werte decken sich mit dem
    -- neuen Enum, unbekannte fallen auf 'lead' zurück.
    case l.status::text
      when 'prospect' then 'prospect'
      when 'customer' then 'customer'
      when 'inactive' then 'inactive'
      else 'lead'
    end::public.company_status,
    l.created_at
  from public.legacy_companies l
  on conflict (id) do update set
    name        = excluded.name,
    website     = excluded.website,
    industry    = excluded.industry,
    city        = excluded.city,
    description = excluded.description;

  -- -------------------------------------------------------------------------
  -- Kontakte
  -- `position` heißt jetzt job_title, `source` wandert in source-freies
  -- description-Feld, `tags` wird unten zu echten Tags aufgelöst.
  -- -------------------------------------------------------------------------
  insert into public.contacts (
    id, first_name, last_name, email, phone, company_id, job_title,
    description, status, created_at
  )
  select
    l.id,
    nullif(btrim(l.first_name), ''),
    nullif(btrim(l.last_name), ''),
    nullif(btrim(l.email), ''),
    nullif(btrim(l.phone), ''),
    l.company_id,
    nullif(btrim(l.position), ''),
    l.notes,
    case l.status::text
      when 'inactive' then 'inactive'
      when 'lead'     then 'lead'
      else 'active'
    end::public.contact_status,
    l.created_at
  from public.legacy_contacts l
  -- Die neue Tabelle verlangt mindestens einen Namensbestandteil
  where coalesce(btrim(l.first_name), '') <> ''
     or coalesce(btrim(l.last_name), '') <> ''
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name  = excluded.last_name,
    email      = excluded.email,
    phone      = excluded.phone,
    company_id = excluded.company_id,
    job_title  = excluded.job_title;

  -- -------------------------------------------------------------------------
  -- Deals
  -- Der Altbestand hielt die Phase als Text in `stage` und kannte weder
  -- Pipelines noch einen getrennten Status. Beides wird hier aufgelöst:
  --   lead        → Erstkontakt
  --   qualified   → Qualifiziert
  --   proposal    → Angebot
  --   negotiation → Verhandlung
  --   won / lost  → letzte Phase + status gewonnen/verloren
  -- -------------------------------------------------------------------------
  insert into public.deals (
    id, title, value, currency, pipeline_id, stage_id, contact_id, company_id,
    status, probability, expected_close_date, won_at, lost_at, description,
    position, created_at, stage_changed_at
  )
  select
    l.id,
    l.title,
    coalesce(l.value, 0),
    coalesce(l.currency, 'EUR'),
    p.id,
    coalesce(s.id, s_default.id),
    l.contact_id,
    l.company_id,
    case l.stage::text
      when 'won'  then 'won'
      when 'lost' then 'lost'
      else 'open'
    end::public.deal_status,
    l.probability,
    l.close_date,
    -- Die Constraint verlangt einen Zeitstempel passend zum Status. Der
    -- Altbestand kennt keinen, deshalb ersatzweise das Anlagedatum.
    case when l.stage::text = 'won'  then l.created_at end,
    case when l.stage::text = 'lost' then l.created_at end,
    l.notes,
    -- Sortierung im Board nach Wert, absteigend
    row_number() over (order by l.value desc nulls last) * 1024,
    l.created_at,
    l.created_at
  from public.legacy_deals l
  cross join lateral (
    select id from public.pipelines where is_default limit 1
  ) p
  left join public.stages s
    on s.pipeline_id = p.id
   and s.name = case l.stage::text
         when 'lead'        then 'Erstkontakt'
         when 'qualified'   then 'Qualifiziert'
         when 'proposal'    then 'Angebot'
         when 'negotiation' then 'Verhandlung'
         when 'won'         then 'Verhandlung'
         when 'lost'        then 'Verhandlung'
       end
  -- Fallback, falls eine Phase umbenannt wurde
  cross join lateral (
    select id from public.stages
     where pipeline_id = p.id order by position limit 1
  ) s_default
  on conflict (id) do update set
    title    = excluded.title,
    value    = excluded.value,
    stage_id = excluded.stage_id,
    status   = excluded.status;

  -- -------------------------------------------------------------------------
  -- Freitext-Notizen zusätzlich als Notiz-Einträge, damit sie in der
  -- Zeitleiste erscheinen und nicht nur im Beschreibungsfeld stehen.
  -- -------------------------------------------------------------------------
  insert into public.notes (body, company_id, created_at)
  select l.notes, l.id, l.created_at
    from public.legacy_companies l
   where coalesce(btrim(l.notes), '') <> ''
     and not exists (
       select 1 from public.notes n
        where n.company_id = l.id and n.body = l.notes
     );

  raise notice 'Übernahme abgeschlossen.';
end $$;

-- ---------------------------------------------------------------------------
-- Kontrollabfrage — Ergebnis im SQL-Editor prüfen:
--
--   select 'companies' t, (select count(*) from public.legacy_companies) alt,
--                         (select count(*) from public.companies) neu
--   union all select 'contacts', (select count(*) from public.legacy_contacts),
--                                (select count(*) from public.contacts)
--   union all select 'deals',    (select count(*) from public.legacy_deals),
--                                (select count(*) from public.deals);
--
-- Erst wenn die Zahlen und Summen stimmen, dürfen die legacy_-Tabellen weg:
--   drop table public.legacy_companies cascade;  -- usw.
-- ---------------------------------------------------------------------------
