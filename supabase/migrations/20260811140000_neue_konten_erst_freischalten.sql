-- =============================================================================
-- Neue Konten müssen freigeschaltet werden
--
-- Bisher bekam jede Registrierung sofort ein aktives Profil. Zusammen mit
-- offener Registrierung und einer öffentlich erreichbaren App bedeutete das:
-- wer die Adresse kennt, legt sich ein Konto an und sieht den kompletten
-- Kundenbestand. RLS war korrekt — die Mitgliedschaft war das Problem.
--
-- Ab jetzt:
--   - der allererste Account bleibt Admin und aktiv (sonst sperrt man sich aus)
--   - jedes weitere Konto entsteht INAKTIV und sieht nichts, bis ein Admin es
--     unter Einstellungen → Team freischaltet
--
-- Zweite Verteidigungslinie: die Registrierung wird in Supabase zusätzlich
-- abgeschaltet, neue Leute kommen per Einladung. Diese Migration wirkt auch
-- dann, wenn jemand die Registrierung später wieder aktiviert.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ist_erster boolean;
begin
  select count(*) = 0 into ist_erster from public.profiles;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when ist_erster then 'admin'::public.app_role else 'member'::public.app_role end,
    -- Genau hier lag das Loch: vorher stand hier der Vorgabewert true.
    ist_erster
  );
  return new;
end;
$$;

-- Bestandsprüfung: aktive Profile, die niemand bewusst freigeschaltet hat,
-- sollen sichtbar werden. Nur ausgeben, nicht ändern — ein automatisches
-- Deaktivieren könnte echte Kollegen aussperren.
do $$
declare
  anzahl int;
begin
  select count(*) into anzahl from public.profiles where is_active;
  raise notice 'Aktive Profile derzeit: %. Bitte unter Einstellungen → Team prüfen.', anzahl;
end $$;
