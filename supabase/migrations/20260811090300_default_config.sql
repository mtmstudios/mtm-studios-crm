-- =============================================================================
-- Grundkonfiguration: Standard-Pipeline, Stages, Verlustgründe, Tags.
-- Reine Konfiguration — bewusst keine Kunden- oder Beispieldatensätze.
-- =============================================================================

insert into public.pipelines (id, name, position, is_default)
values ('11111111-1111-4111-8111-111111111111', 'Vertrieb', 0, true);

insert into public.stages (pipeline_id, name, position, probability, rotting_days) values
  ('11111111-1111-4111-8111-111111111111', 'Erstkontakt',   0,  10, 14),
  ('11111111-1111-4111-8111-111111111111', 'Qualifiziert',  1,  25, 14),
  ('11111111-1111-4111-8111-111111111111', 'Bedarfsanalyse',2,  40, 10),
  ('11111111-1111-4111-8111-111111111111', 'Angebot',       3,  60,  7),
  ('11111111-1111-4111-8111-111111111111', 'Verhandlung',   4,  80,  7);

insert into public.lost_reasons (label, position) values
  ('Preis zu hoch',            0),
  ('An Wettbewerber verloren', 1),
  ('Kein Budget',              2),
  ('Kein Bedarf',              3),
  ('Zeitpunkt unpassend',      4),
  ('Keine Rückmeldung',        5),
  ('Sonstiges',                6);

insert into public.tags (label, color) values
  ('Bestandskunde', 'emerald'),
  ('Empfehlung',    'violet'),
  ('Kaltakquise',   'amber'),
  ('Wiedervorlage', 'sky');
