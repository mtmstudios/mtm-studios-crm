-- =============================================================================
-- RPC-Funktionen: Suche, Board, Reporting, öffentliche Buchung
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Globale Suche (Command Palette)
-- ---------------------------------------------------------------------------
create or replace function public.search_global(q text, max_rows int default 8)
returns table (
  entity   public.entity_type,
  id       uuid,
  title    text,
  subtitle text,
  score    real
)
language sql
stable
security invoker
set search_path = public
as $$
  with needle as (select btrim(q) as q)
  (
    select 'contact'::public.entity_type, c.id, c.full_name,
           coalesce(co.name, c.email, c.phone),
           greatest(similarity(c.full_name, n.q), similarity(coalesce(c.email, ''), n.q))
      from public.contacts c
      cross join needle n
      left join public.companies co on co.id = c.company_id
     where c.full_name ilike '%' || n.q || '%'
        or c.email     ilike '%' || n.q || '%'
     order by 5 desc
     limit max_rows
  )
  union all
  (
    select 'company'::public.entity_type, co.id, co.name,
           coalesce(co.city, co.domain), similarity(co.name, n.q)
      from public.companies co
      cross join needle n
     where co.name   ilike '%' || n.q || '%'
        or co.domain ilike '%' || n.q || '%'
     order by 5 desc
     limit max_rows
  )
  union all
  (
    select 'deal'::public.entity_type, d.id, d.title,
           to_char(d.value, 'FM999G999G990D00') || ' ' || d.currency,
           similarity(d.title, n.q)
      from public.deals d
      cross join needle n
     where d.title ilike '%' || n.q || '%'
     order by 5 desc
     limit max_rows
  );
$$;

-- ---------------------------------------------------------------------------
-- Deal im Board verschieben — Stage-Wechsel und Neusortierung in einem Schritt.
-- Die Position wird als Mittelwert zwischen den Nachbarn vergeben, damit beim
-- Umsortieren nicht die halbe Spalte neu geschrieben werden muss.
-- ---------------------------------------------------------------------------
create or replace function public.move_deal(
  p_deal_id     uuid,
  p_stage_id    uuid,
  p_before_id   uuid default null,   -- Deal, vor dem eingefügt wird
  p_after_id    uuid default null    -- Deal, nach dem eingefügt wird
)
returns public.deals
language plpgsql
security invoker
set search_path = public
as $$
declare
  pos_before numeric;
  pos_after  numeric;
  new_pos    numeric;
  result     public.deals;
begin
  -- "position" ist in Postgres ein Schlüsselwort und muss qualifiziert werden
  select d.position into pos_after  from public.deals d where d.id = p_after_id;
  select d.position into pos_before from public.deals d where d.id = p_before_id;

  new_pos := case
    when pos_after is not null and pos_before is not null then (pos_after + pos_before) / 2
    when pos_after  is not null then pos_after + 1024
    when pos_before is not null then pos_before - 1024
    else coalesce(
      (select max(position) + 1024 from public.deals
        where stage_id = p_stage_id and status = 'open'), 0)
  end;

  update public.deals
     set stage_id = p_stage_id,
         position = new_pos,
         -- Wahrscheinlichkeit der Zielstage übernehmen, solange am Deal
         -- keine abweichende manuell gesetzt wurde
         probability = coalesce(
           probability,
           (select s.probability from public.stages s where s.id = p_stage_id))
   where id = p_deal_id
   returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deal gewinnen / verlieren — hält die status/timestamp-Constraint konsistent
-- ---------------------------------------------------------------------------
create or replace function public.win_deal(p_deal_id uuid)
returns public.deals
language sql
security invoker
set search_path = public
as $$
  update public.deals
     set status = 'won', won_at = now(), lost_at = null,
         lost_reason_id = null, lost_comment = null, probability = 100
   where id = p_deal_id
   returning *;
$$;

create or replace function public.lose_deal(
  p_deal_id   uuid,
  p_reason_id uuid default null,
  p_comment   text default null
)
returns public.deals
language sql
security invoker
set search_path = public
as $$
  update public.deals
     set status = 'lost', lost_at = now(), won_at = null,
         lost_reason_id = p_reason_id, lost_comment = p_comment, probability = 0
   where id = p_deal_id
   returning *;
$$;

create or replace function public.reopen_deal(p_deal_id uuid)
returns public.deals
language sql
security invoker
set search_path = public
as $$
  update public.deals
     set status = 'open', won_at = null, lost_at = null,
         lost_reason_id = null, lost_comment = null
   where id = p_deal_id
   returning *;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard-Kennzahlen. Ein Aufruf statt sechs Roundtrips; der Vergleichs-
-- zeitraum ist gleich lang und liegt unmittelbar davor.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_metrics(
  p_from     timestamptz,
  p_to       timestamptz,
  p_owner_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with span as (
    select p_from as f, p_to as t, (p_to - p_from) as len
  ),
  prev as (
    select (select f - len from span) as f, (select f from span) as t
  ),
  scoped as (
    select d.* from public.deals d
     where p_owner_id is null or d.owner_id = p_owner_id
  )
  select jsonb_build_object(
    'won_value',        (select coalesce(sum(value), 0) from scoped, span
                          where status = 'won' and won_at >= f and won_at < t),
    'won_value_prev',   (select coalesce(sum(value), 0) from scoped, prev
                          where status = 'won' and won_at >= f and won_at < t),
    'won_count',        (select count(*) from scoped, span
                          where status = 'won' and won_at >= f and won_at < t),
    'lost_count',       (select count(*) from scoped, span
                          where status = 'lost' and lost_at >= f and lost_at < t),
    'created_count',    (select count(*) from scoped, span
                          where created_at >= f and created_at < t),
    'open_value',       (select coalesce(sum(value), 0) from scoped where status = 'open'),
    'open_count',       (select count(*) from scoped where status = 'open'),
    -- gewichteter Forecast über die Stage-Wahrscheinlichkeit
    'forecast',         (select coalesce(sum(d.value * coalesce(d.probability, s.probability) / 100.0), 0)
                           from scoped d join public.stages s on s.id = d.stage_id
                          where d.status = 'open'),
    'avg_deal_size',    (select coalesce(avg(value), 0) from scoped, span
                          where status = 'won' and won_at >= f and won_at < t),
    -- mittlere Laufzeit gewonnener Deals in Tagen
    'avg_cycle_days',   (select coalesce(avg(extract(epoch from (won_at - created_at)) / 86400), 0)
                           from scoped, span
                          where status = 'won' and won_at >= f and won_at < t),
    'activities_done',  (select count(*) from public.activities a, span
                          where a.done and a.done_at >= f and a.done_at < t
                            and (p_owner_id is null or a.owner_id = p_owner_id)),
    'activities_overdue', (select count(*) from public.activities a
                            where not a.done and a.due_at < now()
                              and (p_owner_id is null or a.owner_id = p_owner_id)),
    'by_stage',         (select coalesce(jsonb_agg(x order by x->>'position'), '[]'::jsonb) from (
                            select jsonb_build_object(
                                     'stage_id',  s.id,
                                     'name',      s.name,
                                     'position',  s.position,
                                     'count',     count(d.id),
                                     'value',     coalesce(sum(d.value), 0)
                                   ) as x
                              from public.stages s
                              left join scoped d on d.stage_id = s.id and d.status = 'open'
                             group by s.id, s.name, s.position
                          ) q),
    'won_series',       (select coalesce(jsonb_agg(jsonb_build_object(
                                   'day', day, 'value', value) order by day), '[]'::jsonb)
                           from (
                            select date_trunc('day', won_at)::date as day,
                                   sum(value) as value
                              from scoped, span
                             where status = 'won' and won_at >= f and won_at < t
                             group by 1
                          ) q)
  );
$$;

-- Spaltenkopf des Kanban-Boards: Anzahl und Summe je Stage. Muss serverseitig
-- laufen, weil das Board nur die ersten N Karten je Spalte lädt und aus den
-- geladenen Karten sonst falsche Summen entstünden.
create or replace function public.board_summary(
  p_pipeline_id uuid,
  p_owner_id    uuid default null
)
returns table (
  stage_id    uuid,
  deal_count  bigint,
  total_value numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id,
         count(d.id),
         coalesce(sum(d.value), 0)
    from public.stages s
    left join public.deals d
           on d.stage_id = s.id
          and d.status = 'open'
          and (p_owner_id is null or d.owner_id = p_owner_id)
   where s.pipeline_id = p_pipeline_id
   group by s.id;
$$;

-- Conversion je Stage: wie viele Deals haben Stage X je erreicht, und wie
-- viele davon wurden am Ende gewonnen.
create or replace function public.pipeline_conversion(p_pipeline_id uuid)
returns table (
  stage_id       uuid,
  stage_name     text,
  stage_position int,
  reached        bigint,
  won            bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id, s.name, s.position,
         count(distinct h.deal_id) as reached,
         count(distinct h.deal_id) filter (where d.status = 'won') as won
    from public.stages s
    left join public.deal_stage_history h on h.to_stage_id = s.id
    left join public.deals d on d.id = h.deal_id
   where s.pipeline_id = p_pipeline_id
   group by s.id, s.name, s.position
   order by s.position;
$$;

-- ---------------------------------------------------------------------------
-- Öffentliche Buchungsseite
-- Anonyme Zugriffe laufen ausschließlich über diese drei SECURITY-DEFINER-
-- Funktionen. Sie geben genau das preis, was die Seite braucht — keine
-- Tabellenrechte für die Rolle anon.
-- ---------------------------------------------------------------------------
create or replace function public.booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'slug',             b.slug,
           'title',            b.title,
           'description',      b.description,
           'duration_minutes', b.duration_minutes,
           'timezone',         b.timezone,
           'horizon_days',     b.horizon_days,
           'host_name',        p.full_name
         )
    from public.booking_settings b
    join public.profiles p on p.id = b.owner_id
   where b.slug = p_slug and b.is_active;
$$;

-- Freie Slots für einen Tag. Rechnet in der Zeitzone der Buchungsseite,
-- schneidet Vorlaufzeit und bereits belegte Termine heraus.
create or replace function public.booking_slots(p_slug text, p_day date)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b        public.booking_settings;
  windows  jsonb;
  w        jsonb;
  step     interval;
  slot     timestamptz;
  win_end  timestamptz;
  dow_key  text;
begin
  select * into b from public.booking_settings where slug = p_slug and is_active;
  if not found then
    return;
  end if;

  if p_day > (current_date + b.horizon_days) or p_day < current_date then
    return;
  end if;

  -- 'mon' … 'sun'
  dow_key := lower(to_char(p_day, 'dy'));
  windows := b.availability -> dow_key;
  if windows is null or jsonb_typeof(windows) <> 'array' then
    return;
  end if;

  step := make_interval(mins => b.duration_minutes + b.buffer_minutes);

  for w in select * from jsonb_array_elements(windows) loop
    slot    := ((p_day::text || ' ' || (w->>0))::timestamp) at time zone b.timezone;
    win_end := ((p_day::text || ' ' || (w->>1))::timestamp) at time zone b.timezone;

    while slot + make_interval(mins => b.duration_minutes) <= win_end loop
      if slot >= now() + make_interval(hours => b.lead_time_hours)
         and not exists (
           select 1 from public.appointments a
            where a.owner_id = b.owner_id
              and a.status in ('scheduled', 'confirmed')
              and a.starts_at < slot + make_interval(mins => b.duration_minutes)
              and a.ends_at   > slot
         )
      then
        return next slot;
      end if;
      slot := slot + step;
    end loop;
  end loop;
end;
$$;

create or replace function public.book_slot(
  p_slug        text,
  p_starts_at   timestamptz,
  p_guest_name  text,
  p_guest_email text,
  p_guest_phone text default null,
  p_notes       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b       public.booking_settings;
  new_id  uuid;
begin
  select * into b from public.booking_settings where slug = p_slug and is_active;
  if not found then
    raise exception 'Buchungsseite nicht gefunden';
  end if;

  if coalesce(btrim(p_guest_name), '') = '' or p_guest_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Name und gültige E-Mail-Adresse sind erforderlich';
  end if;

  -- Der Slot muss auch jetzt noch frei sein — schützt gegen die Lücke
  -- zwischen Anzeige und Klick.
  if not exists (
    select 1 from public.booking_slots(p_slug, (p_starts_at at time zone b.timezone)::date) s
     where s = p_starts_at
  ) then
    raise exception 'Dieser Termin ist nicht mehr verfügbar';
  end if;

  insert into public.appointments (
    title, starts_at, ends_at, status, owner_id, booking_id,
    guest_name, guest_email, guest_phone, notes
  )
  values (
    b.title,
    p_starts_at,
    p_starts_at + make_interval(mins => b.duration_minutes),
    'scheduled',
    b.owner_id,
    b.id,
    btrim(p_guest_name),
    lower(btrim(p_guest_email)),
    p_guest_phone,
    p_notes
  )
  returning id into new_id;

  return jsonb_build_object(
    'id', new_id,
    'starts_at', p_starts_at,
    'duration_minutes', b.duration_minutes,
    'timezone', b.timezone
  );
end;
$$;

-- Nur diese drei Funktionen sind für anonyme Aufrufer freigegeben.
grant execute on function public.booking_page(text)              to anon, authenticated;
grant execute on function public.booking_slots(text, date)       to anon, authenticated;
grant execute on function public.book_slot(text, timestamptz, text, text, text, text) to anon, authenticated;
