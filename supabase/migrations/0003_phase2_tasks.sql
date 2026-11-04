-- =====================================================================
--  MASAR — Migration 0003: Phase 2 tasks core
--  (FR-10, FR-11, FR-13, FR-14, FR-15, FR-16, FR-42, US-02, US-03, US-04, US-14)
--
--   1. fn_conflicts_for — the conflict engine for a *proposed* task (no row
--      yet), so the wizard can warn before saving (US-03). fn_check_task_conflicts
--      now delegates to it, gains a tenant check (it is security definer and
--      was callable with any company's task id) and uses company-local day
--      bounds for the same-day checks (0001 used UTC days, so a 01:30 Riyadh
--      trip counted towards the previous day).
--   2. rpc_preview_task_conflicts — conflicts for several candidate drivers
--      at once (AssignStep driver list).
--   3. rpc_save_task — the wizard's single write: task + stops + flight +
--      primary assignment in one transaction, then the conflict gate:
--      blocking conflicts need an admin override with a reason (FR-14).
--   4. rpc_reschedule_task — calendar drag-and-drop (US-14): shift times,
--      optionally move to another driver, re-run the gate.
--   5. rpc_override_task_conflicts — admin override from the task sheet.
--   6. rpc_share_trip — FR-15 "Merge as shared trip": the rider task rides
--      on another site's airport trip (task_links shared_ride; passengers and
--      the rider's site copied onto the host as an extra stop). Riders follow
--      their host: completed with it, released again if it is cancelled.
--
--  Status changes made here (assignment ↔ scheduled, riders following the
--  host) are server-side consequences of a write, like trg_notify_assignment;
--  driver actions still go through rpc_task_transition only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. conflict engine for a proposed task
-- ---------------------------------------------------------------------
create or replace function fn_conflicts_for(
  p_company      uuid,
  p_driver_id    uuid,
  p_vehicle_id   uuid,
  p_start        timestamptz,
  p_end          timestamptz,
  p_first_lat    double precision default null,
  p_first_lng    double precision default null,
  p_exclude_task uuid default null
) returns table (
  type          conflict_type,
  severity      conflict_severity,
  other_task_id uuid,
  details       jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_settings    company_settings%rowtype;
  v_driver      drivers%rowtype;
  v_tz          text;
  v_end         timestamptz := p_end;
  v_day_start   timestamptz;
  v_day_end     timestamptz;
  v_planned_min int;
  v_max_min     int;
  r             record;
begin
  -- internal (execute revoked below), but never let a signed-in caller read another tenant
  if auth.uid() is not null and p_company is distinct from auth_company_id() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  select * into v_settings from company_settings where company_id = p_company;
  select coalesce(timezone, 'UTC') into v_tz from companies where id = p_company;
  if v_end is null or v_end <= p_start then
    v_end := p_start + interval '60 min';
  end if;
  -- the company-local calendar day of the start
  v_day_start := date_trunc('day', p_start at time zone v_tz) at time zone v_tz;
  v_day_end   := (date_trunc('day', p_start at time zone v_tz) + interval '1 day') at time zone v_tz;

  if p_driver_id is not null then
    select * into v_driver from drivers where id = p_driver_id and company_id = p_company;
    if v_driver.id is null then
      raise exception 'driver % not found', p_driver_id;
    end if;

    -- 1. driver overlap (± 15 min travel padding)
    for r in
      select t.id, t.title, t.scheduled_start, fn_task_effective_end(t.id) as eff_end, s.name as site_name
      from task_assignments a
      join tasks t on t.id = a.task_id
      join sites s on s.id = t.site_id
      where a.driver_id = p_driver_id
        and (p_exclude_task is null or t.id <> p_exclude_task)
        and t.status not in ('cancelled','completed','declined','no_show','draft')
        and tstzrange(t.scheduled_start - interval '15 min', fn_task_effective_end(t.id) + interval '15 min')
            && tstzrange(p_start, v_end)
    loop
      type := 'driver_overlap'; severity := 'blocking'; other_task_id := r.id;
      details := jsonb_build_object('title', r.title, 'site', r.site_name, 'start', r.scheduled_start, 'end', r.eff_end);
      return next;
    end loop;

    -- 2. multi-location same day (first stops far apart)
    if p_first_lat is not null and p_first_lng is not null then
      for r in
        select t.id, t.title, st.lat, st.lng, s.name as site_name
        from task_assignments a
        join tasks t on t.id = a.task_id
        join sites s on s.id = t.site_id
        join lateral (select lat, lng from task_stops where task_id = t.id order by seq limit 1) st on true
        where a.driver_id = p_driver_id
          and (p_exclude_task is null or t.id <> p_exclude_task)
          and t.status not in ('cancelled','completed','declined','no_show','draft')
          and t.scheduled_start >= v_day_start and t.scheduled_start < v_day_end
          and st.lat is not null
          and fn_distance_km(p_first_lat, p_first_lng, st.lat, st.lng) > v_settings.far_location_km
      loop
        type := 'driver_multi_location_same_day'; severity := 'warning'; other_task_id := r.id;
        details := jsonb_build_object('title', r.title, 'site', r.site_name,
                   'distance_km', round(fn_distance_km(p_first_lat, p_first_lng, r.lat, r.lng)::numeric, 1));
        return next;
      end loop;
    end if;

    -- 4. driver over hours for the (company-local) day
    select coalesce(sum(extract(epoch from (fn_task_effective_end(t.id) - t.scheduled_start)) / 60), 0)::int
      into v_planned_min
    from task_assignments a join tasks t on t.id = a.task_id
    where a.driver_id = p_driver_id
      and (p_exclude_task is null or t.id <> p_exclude_task)
      and t.status not in ('cancelled','declined','no_show','draft')
      and t.scheduled_start >= v_day_start and t.scheduled_start < v_day_end;
    v_planned_min := v_planned_min + (extract(epoch from (v_end - p_start)) / 60)::int;
    v_max_min := coalesce(v_driver.max_daily_driving_min, v_settings.max_daily_driving_min);
    if v_planned_min > v_max_min then
      type := 'driver_over_hours'; severity := 'warning'; other_task_id := null;
      details := jsonb_build_object('planned_min', v_planned_min, 'max_min', v_max_min);
      return next;
    end if;

    -- 5. outside the driver's shift (company-local wall clock)
    if v_driver.shift_start is not null and v_driver.shift_end is not null then
      if (p_start at time zone v_tz)::time < v_driver.shift_start
         or (v_end at time zone v_tz)::time > v_driver.shift_end
         or (v_end at time zone v_tz)::date > (p_start at time zone v_tz)::date then
        type := 'outside_working_hours'; severity := 'info'; other_task_id := null;
        details := jsonb_build_object('shift_start', v_driver.shift_start, 'shift_end', v_driver.shift_end);
        return next;
      end if;
    end if;

    -- 6. driver unavailable (leave, sick, off day …)
    for r in
      select da.type as atype, da.starts_at, da.ends_at from driver_availability da
      where da.driver_id = p_driver_id and tstzrange(da.starts_at, da.ends_at) && tstzrange(p_start, v_end)
    loop
      type := 'driver_unavailable'; severity := 'blocking'; other_task_id := null;
      details := jsonb_build_object('availability', r.atype, 'from', r.starts_at, 'to', r.ends_at);
      return next;
    end loop;
  end if;

  -- 3. vehicle overlap
  if p_vehicle_id is not null then
    for r in
      select t.id, t.title, t.scheduled_start, fn_task_effective_end(t.id) as eff_end
      from task_assignments a join tasks t on t.id = a.task_id
      where a.vehicle_id = p_vehicle_id
        and (p_exclude_task is null or t.id <> p_exclude_task)
        and t.status not in ('cancelled','completed','declined','no_show','draft')
        and tstzrange(t.scheduled_start, fn_task_effective_end(t.id)) && tstzrange(p_start, v_end)
    loop
      type := 'vehicle_overlap'; severity := 'warning'; other_task_id := r.id;
      details := jsonb_build_object('title', r.title, 'start', r.scheduled_start, 'end', r.eff_end);
      return next;
    end loop;
  end if;
  return;
end $$;

-- existing task → same engine; signature unchanged (triggers + clients use it)
create or replace function fn_check_task_conflicts(
  p_task_id     uuid,
  p_driver_id   uuid,
  p_vehicle_id  uuid default null,
  p_start       timestamptz default null,
  p_end         timestamptz default null
) returns table (
  type          conflict_type,
  severity      conflict_severity,
  other_task_id uuid,
  details       jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid;
  v_start   timestamptz;
  v_end     timestamptz;
  v_lat     double precision;
  v_lng     double precision;
begin
  select t.company_id, coalesce(p_start, t.scheduled_start), coalesce(p_end, fn_task_effective_end(t.id))
    into v_company, v_start, v_end from tasks t where t.id = p_task_id;
  if v_company is null then
    raise exception 'task % not found', p_task_id;
  end if;
  -- signed-in callers only see their own company (service role / jobs have no uid)
  if auth.uid() is not null and v_company is distinct from auth_company_id() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  select s.lat, s.lng into v_lat, v_lng from task_stops s where s.task_id = p_task_id order by s.seq limit 1;
  return query
    select c.type, c.severity, c.other_task_id, c.details
    from fn_conflicts_for(v_company, p_driver_id, p_vehicle_id, v_start, v_end, v_lat, v_lng, p_task_id) c;
end $$;

-- ---------------------------------------------------------------------
-- 2. preview for candidate drivers (AssignStep, FR-16 / US-03)
-- ---------------------------------------------------------------------
create or replace function rpc_preview_task_conflicts(
  p_driver_ids   uuid[],
  p_start        timestamptz,
  p_end          timestamptz,
  p_vehicle_id   uuid default null,
  p_first_lat    double precision default null,
  p_first_lng    double precision default null,
  p_exclude_task uuid default null
) returns table (
  driver_id     uuid,
  type          conflict_type,
  severity      conflict_severity,
  other_task_id uuid,
  details       jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  v_driver  uuid;
begin
  if v_company is null or not auth_is_staff() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'tasks.errors.endBeforeStart';
  end if;
  foreach v_driver in array coalesce(p_driver_ids, '{}') loop
    if exists (select 1 from drivers d where d.id = v_driver and d.company_id = v_company) then
      return query
        select v_driver, c.type, c.severity, c.other_task_id, c.details
        from fn_conflicts_for(v_company, v_driver, null, p_start, p_end, p_first_lat, p_first_lng, p_exclude_task) c;
    end if;
  end loop;
  -- vehicle conflicts are not tied to a driver
  if p_vehicle_id is not null and exists (select 1 from vehicles v where v.id = p_vehicle_id and v.company_id = v_company) then
    return query
      select null::uuid, c.type, c.severity, c.other_task_id, c.details
      from fn_conflicts_for(v_company, null, p_vehicle_id, p_start, p_end, null, null, p_exclude_task) c;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- shared internals (security invoker: RLS of the caller applies)
-- ---------------------------------------------------------------------

-- Point the task's primary assignment at p_driver (null = unassign).
-- A new assignment fires trg_notify_assignment (push + status → assigned).
create or replace function fn_set_primary_driver(p_task_id uuid, p_driver_id uuid, p_vehicle_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_current task_assignments%rowtype;
  v_company uuid;
begin
  select company_id into v_company from tasks where id = p_task_id;
  select * into v_current from task_assignments where task_id = p_task_id and is_primary;

  if v_current.id is not null and v_current.driver_id = p_driver_id then
    if v_current.vehicle_id is distinct from p_vehicle_id then
      update task_assignments set vehicle_id = p_vehicle_id where id = v_current.id;
    end if;
    return;
  end if;

  if v_current.id is not null then
    delete from task_assignments where id = v_current.id;
    insert into task_events (task_id, company_id, type, actor_id, payload)
    values (p_task_id, v_company, 'unassigned', auth.uid(), jsonb_build_object('driver_id', v_current.driver_id));
  end if;
  -- back to the pool; a new assignment moves it to `assigned` again
  update tasks set status = 'scheduled' where id = p_task_id and status in ('assigned','acknowledged','declined');

  if p_driver_id is not null then
    insert into task_assignments (task_id, driver_id, vehicle_id, is_primary, assigned_by)
    values (p_task_id, p_driver_id, p_vehicle_id, true, auth.uid());
  end if;
end $$;

-- Re-materialise conflicts for the task and every task it collides with,
-- then enforce FR-14: blocking conflicts need an admin override + reason.
create or replace function fn_conflict_gate(p_task_id uuid, p_override_reason text)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_reason text := nullif(trim(p_override_reason), '');
  v_other  uuid;
begin
  perform fn_refresh_task_conflicts(p_task_id);
  -- the other side of a collision (old or new) must reflect this change too
  for v_other in
    select distinct c.other_task_id from task_conflicts c
    where c.task_id = p_task_id and c.other_task_id is not null and (c.resolved_at is null or c.resolved_at = now())
    union
    select distinct c.task_id from task_conflicts c
    where c.other_task_id = p_task_id and c.resolved_at is null
  loop
    perform fn_refresh_task_conflicts(v_other);
  end loop;

  if exists (select 1 from task_conflicts where task_id = p_task_id and resolved_at is null and severity = 'blocking') then
    if v_reason is null then
      raise exception 'conflicts.errors.blocking';
    end if;
    if not auth_is_admin() then
      raise exception 'conflicts.errors.adminOnly';
    end if;
    update tasks set conflicts_overridden = true, override_reason = v_reason, override_by = auth.uid()
    where id = p_task_id and (not conflicts_overridden or override_reason is distinct from v_reason);
    if found then
      insert into task_events (task_id, company_id, type, actor_id, payload)
      select p_task_id, company_id, 'conflict_overridden', auth.uid(), jsonb_build_object('reason', v_reason)
      from tasks where id = p_task_id;
    end if;
  else
    update tasks set conflicts_overridden = false, override_reason = null, override_by = null
    where id = p_task_id and conflicts_overridden;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. rpc_save_task — the wizard's single write (FR-10 … FR-16)
-- ---------------------------------------------------------------------
-- p_task: { id?, site_id, category, priority?, title, description?,
--   scheduled_start, scheduled_end?, estimated_duration_min?, estimated_distance_km?,
--   passengers?: [{name, phone?, note?}], metadata?: {},
--   stops: [{label, address?, lat?, lng?, google_place_id?, site_id?, airport_id?,
--            planned_arrival_at?, dwell_min?, leg_distance_km?, leg_duration_min?,
--            contact_name?, contact_phone?, notes?}]   (≥ 2, first = origin)
--   flight?: {airport_id, direction, airline?, flight_no?, terminal?, scheduled_time, buffer_min?}  (airport only)
--   driver_id?, vehicle_id?, override_reason?, share_with_task_id? }
create or replace function rpc_save_task(p_task jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_company  uuid := auth_company_id();
  v_id       uuid := nullif(p_task->>'id', '')::uuid;
  v_site     uuid := nullif(p_task->>'site_id', '')::uuid;
  v_category task_category := (p_task->>'category')::task_category;
  v_start    timestamptz := nullif(p_task->>'scheduled_start', '')::timestamptz;
  v_end      timestamptz := nullif(p_task->>'scheduled_end', '')::timestamptz;
  v_driver   uuid := nullif(p_task->>'driver_id', '')::uuid;
  v_vehicle  uuid := nullif(p_task->>'vehicle_id', '')::uuid;
  v_share    uuid := nullif(p_task->>'share_with_task_id', '')::uuid;
  v_flight   jsonb := case when jsonb_typeof(p_task->'flight') = 'object' then p_task->'flight' end;
  v_stops    jsonb := coalesce(p_task->'stops', '[]');
  v_existing tasks%rowtype;
begin
  if v_company is null or not auth_is_staff() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_task->>'title'), '') = '' then raise exception 'tasks.errors.title'; end if;
  if v_start is null then raise exception 'tasks.errors.start'; end if;
  if v_end is not null and v_end <= v_start then raise exception 'tasks.errors.endBeforeStart'; end if;
  if jsonb_typeof(v_stops) <> 'array' or jsonb_array_length(v_stops) < 2 then raise exception 'tasks.errors.stopsMin'; end if;
  if v_category = 'airport' and (v_flight is null or nullif(v_flight->>'scheduled_time', '') is null) then
    raise exception 'tasks.errors.flightTime';
  end if;

  -- every referenced row must belong to the caller's company (FKs alone don't say so)
  if not exists (select 1 from sites where id = v_site and company_id = v_company) then
    raise exception 'errors.invalidInput';
  end if;
  if v_driver is not null and not exists (select 1 from drivers where id = v_driver and company_id = v_company and is_active) then
    raise exception 'errors.invalidInput';
  end if;
  if v_vehicle is not null and not exists (select 1 from vehicles where id = v_vehicle and company_id = v_company) then
    raise exception 'errors.invalidInput';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_stops) s
    where (nullif(s->>'site_id', '') is not null
           and not exists (select 1 from sites x where x.id = (s->>'site_id')::uuid and x.company_id = v_company))
       or (nullif(s->>'airport_id', '') is not null
           and not exists (select 1 from airports x where x.id = (s->>'airport_id')::uuid and x.company_id = v_company))
  ) or (v_flight is not null and nullif(v_flight->>'airport_id', '') is not null
        and not exists (select 1 from airports x where x.id = (v_flight->>'airport_id')::uuid and x.company_id = v_company)) then
    raise exception 'errors.invalidInput';
  end if;

  if v_id is null then
    insert into tasks (company_id, site_id, category, status, priority, title, description,
                       scheduled_start, scheduled_end, estimated_duration_min, estimated_distance_km,
                       passengers, metadata, created_by, requested_by)
    values (v_company, v_site, v_category, 'scheduled', coalesce((p_task->>'priority')::task_priority, 'normal'),
            trim(p_task->>'title'), nullif(trim(p_task->>'description'), ''),
            v_start, v_end, (p_task->>'estimated_duration_min')::int, (p_task->>'estimated_distance_km')::numeric,
            coalesce(p_task->'passengers', '[]'), coalesce(p_task->'metadata', '{}'), auth.uid(), auth.uid())
    returning id into v_id;
    insert into task_events (task_id, company_id, type, actor_id, to_status)
    values (v_id, v_company, 'created', auth.uid(), 'scheduled');
  else
    select * into v_existing from tasks where id = v_id for update;
    if v_existing.id is null then raise exception 'taskDetail.notFound'; end if;
    if v_existing.status not in ('draft','scheduled','assigned','acknowledged','declined') then
      raise exception 'tasks.errors.notEditable';
    end if;
    update tasks set
      site_id = v_site, category = v_category,
      priority = coalesce((p_task->>'priority')::task_priority, priority),
      title = trim(p_task->>'title'), description = nullif(trim(p_task->>'description'), ''),
      scheduled_start = v_start, scheduled_end = v_end,
      estimated_duration_min = (p_task->>'estimated_duration_min')::int,
      estimated_distance_km = (p_task->>'estimated_distance_km')::numeric,
      passengers = coalesce(p_task->'passengers', passengers),
      metadata = metadata || coalesce(p_task->'metadata', '{}')
    where id = v_id;
    if not found then raise exception 'errors.forbidden' using errcode = '42501'; end if;
    insert into task_events (task_id, company_id, type, actor_id)
    values (v_id, v_company, 'updated', auth.uid());
  end if;

  -- stops: replace the ordered list
  delete from task_stops where task_id = v_id;
  insert into task_stops (task_id, seq, label, address, lat, lng, google_place_id, site_id, airport_id,
                          planned_arrival_at, dwell_min, leg_distance_km, leg_duration_min,
                          contact_name, contact_phone, notes)
  select v_id, s.ord::int, nullif(s.v->>'label', ''), nullif(s.v->>'address', ''),
         (s.v->>'lat')::double precision, (s.v->>'lng')::double precision, nullif(s.v->>'google_place_id', ''),
         nullif(s.v->>'site_id', '')::uuid, nullif(s.v->>'airport_id', '')::uuid,
         nullif(s.v->>'planned_arrival_at', '')::timestamptz, coalesce((s.v->>'dwell_min')::int, 0),
         (s.v->>'leg_distance_km')::numeric, (s.v->>'leg_duration_min')::int,
         nullif(s.v->>'contact_name', ''), nullif(s.v->>'contact_phone', ''), nullif(s.v->>'notes', '')
  from jsonb_array_elements(v_stops) with ordinality as s(v, ord);

  -- flight (airport tasks only); a changed flight time drops the stale delay estimate
  if v_category = 'airport' then
    insert into flight_details (task_id, airport_id, direction, airline, flight_no, terminal, scheduled_time, buffer_min)
    values (v_id, nullif(v_flight->>'airport_id', '')::uuid,
            coalesce((v_flight->>'direction')::flight_direction, 'arrival'),
            nullif(trim(v_flight->>'airline'), ''), nullif(upper(trim(v_flight->>'flight_no')), ''),
            nullif(trim(v_flight->>'terminal'), ''), (v_flight->>'scheduled_time')::timestamptz,
            coalesce((v_flight->>'buffer_min')::int, 30))
    on conflict (task_id) do update set
      airport_id = excluded.airport_id, direction = excluded.direction, airline = excluded.airline,
      flight_no = excluded.flight_no, terminal = excluded.terminal, buffer_min = excluded.buffer_min,
      estimated_time = case when flight_details.scheduled_time = excluded.scheduled_time
                            then flight_details.estimated_time end,
      scheduled_time = excluded.scheduled_time, updated_at = now();
  else
    delete from flight_details where task_id = v_id;
  end if;

  -- a rider on another site's trip has no car of its own
  if v_share is not null or (v_existing.id is not null and v_existing.metadata ? 'shared_with') then
    if v_driver is not null then raise exception 'share.errors.riderAssigned'; end if;
  else
    perform fn_set_primary_driver(v_id, v_driver, v_vehicle);
  end if;

  perform fn_conflict_gate(v_id, p_task->>'override_reason');

  if v_share is not null then
    perform rpc_share_trip(v_id, v_share);
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. rpc_reschedule_task — calendar drag-and-drop (US-14, FR-42)
-- ---------------------------------------------------------------------
-- Moves the whole task (stops' planned arrivals shift with it; the flight
-- time is a fact and stays). p_change_driver = true also reassigns the task
-- to p_driver_id (null = unassigned), keeping the vehicle.
create or replace function rpc_reschedule_task(
  p_task_id         uuid,
  p_start           timestamptz,
  p_driver_id       uuid default null,
  p_change_driver   boolean default false,
  p_override_reason text default null
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  t        tasks%rowtype;
  v_delta  interval;
  v_vehicle uuid;
begin
  if not auth_is_staff() then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  select * into t from tasks where id = p_task_id for update;
  if t.id is null then raise exception 'taskDetail.notFound'; end if;
  if t.status not in ('draft','scheduled','assigned','acknowledged','declined') then
    raise exception 'tasks.errors.notEditable';
  end if;
  if p_change_driver and p_driver_id is not null and t.metadata ? 'shared_with' then
    raise exception 'share.errors.riderAssigned';
  end if;
  if p_change_driver and p_driver_id is not null
     and not exists (select 1 from drivers where id = p_driver_id and company_id = t.company_id and is_active) then
    raise exception 'errors.invalidInput';
  end if;

  v_delta := p_start - t.scheduled_start;
  if v_delta <> interval '0' then
    update tasks set scheduled_start = scheduled_start + v_delta, scheduled_end = scheduled_end + v_delta
    where id = p_task_id;
    update task_stops set planned_arrival_at = planned_arrival_at + v_delta
    where task_id = p_task_id and planned_arrival_at is not null;
    insert into task_events (task_id, company_id, type, actor_id, payload)
    values (p_task_id, t.company_id, 'updated', auth.uid(),
            jsonb_build_object('rescheduled_from', t.scheduled_start, 'rescheduled_to', p_start));
  end if;

  if p_change_driver then
    select vehicle_id into v_vehicle from task_assignments where task_id = p_task_id and is_primary;
    perform fn_set_primary_driver(p_task_id, p_driver_id, v_vehicle);
  end if;

  perform fn_conflict_gate(p_task_id, coalesce(p_override_reason, case when t.conflicts_overridden then t.override_reason end));
end $$;

-- ---------------------------------------------------------------------
-- 5. admin override from the task sheet (FR-14)
-- ---------------------------------------------------------------------
create or replace function rpc_override_task_conflicts(p_task_id uuid, p_reason text) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not auth_is_admin() then raise exception 'conflicts.errors.adminOnly'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'conflicts.errors.reason'; end if;
  if not auth_can_edit_task(p_task_id) then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  perform fn_conflict_gate(p_task_id, p_reason);
end $$;

-- ---------------------------------------------------------------------
-- 6. FR-15 shared airport trips
-- ---------------------------------------------------------------------
-- The rider (an unassigned airport task) rides on the host (another trip to
-- the same airport). Security definer: sharing is cross-site by nature —
-- a Site A dispatcher adds their passengers to Site B's car — so access is
-- checked explicitly: the caller must be able to edit the rider, and the
-- host must be an open trip of the same company to the same airport.
create or replace function rpc_share_trip(p_task_id uuid, p_host_task_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t        tasks%rowtype;
  h        tasks%rowtype;
  f_t      flight_details%rowtype;
  f_h      flight_details%rowtype;
  s        sites%rowtype;
  v_seq    int;
  v_last   task_stops%rowtype;
  v_extra  int;
begin
  if not auth_is_staff() or not auth_can_edit_task(p_task_id) then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  select * into t from tasks where id = p_task_id for update;
  select * into h from tasks where id = p_host_task_id and company_id = t.company_id for update;
  if h.id is null or t.id = h.id or t.category <> 'airport' or h.category <> 'airport' then
    raise exception 'share.errors.invalid';
  end if;
  select * into f_t from flight_details where task_id = t.id;
  select * into f_h from flight_details where task_id = h.id;
  if f_t.airport_id is null or f_t.airport_id is distinct from f_h.airport_id then
    raise exception 'share.errors.invalid';
  end if;
  if t.status not in ('draft','scheduled','declined')
     or exists (select 1 from task_assignments where task_id = t.id) then
    raise exception 'share.errors.riderAssigned';
  end if;
  if h.status in ('completed','cancelled','declined','no_show') or h.metadata ? 'shared_with' then
    raise exception 'share.errors.hostClosed';
  end if;
  if t.metadata ? 'shared_with' then
    raise exception 'share.errors.already';
  end if;

  insert into task_links (task_id, related_task_id, relation, created_by)
  values (t.id, h.id, 'shared_ride', auth.uid());
  update tasks set metadata = metadata || jsonb_build_object('shared_with', h.id),
                   status = case when status = 'declined' then 'scheduled'::task_status else status end
  where id = t.id;

  -- the rider's passengers travel in the host car, tagged with their site
  select * into s from sites where id = t.site_id;
  update tasks set passengers = passengers || coalesce((
      select jsonb_agg(case when p ? 'note' then p else p || jsonb_build_object('note', s.name) end)
      from jsonb_array_elements(t.passengers) p), '[]')
  where id = h.id;

  -- … and the host stops at the rider's site: after the airport for an
  -- arrival (drop-off), before it for a departure (pick-up)
  if not exists (select 1 from task_stops where task_id = h.id and site_id = t.site_id) then
    if f_h.direction = 'departure' then
      select seq into v_seq from task_stops where task_id = h.id and airport_id = f_h.airport_id order by seq limit 1;
      v_seq := coalesce(v_seq, (select max(seq) from task_stops where task_id = h.id), 1);
      update task_stops set seq = seq + 10000 where task_id = h.id and seq >= v_seq;
      update task_stops set seq = seq - 9999 where task_id = h.id and seq >= 10000;
      insert into task_stops (task_id, seq, label, address, lat, lng, site_id, dwell_min, contact_name, contact_phone)
      values (h.id, v_seq, s.name, s.address, s.lat, s.lng, s.id, 10, s.contact_name, s.contact_phone);
    else
      select * into v_last from task_stops where task_id = h.id order by seq desc limit 1;
      insert into task_stops (task_id, seq, label, address, lat, lng, site_id, dwell_min, contact_name, contact_phone,
                              leg_distance_km, leg_duration_min, planned_arrival_at)
      select h.id, coalesce(v_last.seq, 0) + 1, s.name, s.address, s.lat, s.lng, s.id, 10, s.contact_name, s.contact_phone,
             e.km, e.minutes,
             case when h.scheduled_end is not null then h.scheduled_end + make_interval(mins => e.minutes) end
      from (select round((fn_distance_km(v_last.lat, v_last.lng, s.lat, s.lng) * 1.3)::numeric, 1) as km,
                   greatest(15, round(fn_distance_km(v_last.lat, v_last.lng, s.lat, s.lng) * 1.3 / 70 * 60))::int as minutes
            where v_last.lat is not null and s.lat is not null
            union all
            select null, 0 where v_last.lat is null or s.lat is null
            limit 1) e;
      -- the drop-off lengthens the host trip (rough road estimate until route-estimate re-runs)
      select coalesce(leg_duration_min, 0) + 10 into v_extra from task_stops where task_id = h.id order by seq desc limit 1;
      update tasks set scheduled_end = scheduled_end + make_interval(mins => v_extra),
                       estimated_duration_min = estimated_duration_min + v_extra
      where id = h.id and scheduled_end is not null;
    end if;
  end if;

  insert into task_events (task_id, company_id, type, actor_id, payload) values
    (t.id, t.company_id, 'updated', auth.uid(), jsonb_build_object('shared_ride_with', h.id)),
    (h.id, h.company_id, 'updated', auth.uid(), jsonb_build_object('shared_ride_from', t.id));

  -- the host's driver learns about the extra passengers
  insert into notifications (company_id, user_id, type, task_id, title, body, channels)
  select h.company_id, d.profile_id, 'task_updated', h.id, h.title, s.name, '{in_app,push}'
  from task_assignments a join drivers d on d.id = a.driver_id
  where a.task_id = h.id and a.is_primary and d.profile_id is not null;

  perform fn_refresh_task_conflicts(h.id);
end $$;

-- a rider has no car of its own, so it is never offered as a trip to share
create or replace function fn_similar_airport_trips(
  p_airport_id uuid,
  p_time       timestamptz,
  p_exclude_task uuid default null
) returns table (
  task_id uuid, site_id uuid, site_name text, direction flight_direction,
  flight_no text, scheduled_time timestamptz, scheduled_start timestamptz,
  driver_name text, minutes_apart int
)
language sql stable security definer set search_path = public as $$
  select t.id, t.site_id, s.name, f.direction, f.flight_no, f.scheduled_time, t.scheduled_start,
         d.full_name,
         abs(extract(epoch from (f.scheduled_time - p_time)) / 60)::int as minutes_apart
  from flight_details f
  join tasks t on t.id = f.task_id
  join sites s on s.id = t.site_id
  left join task_assignments a on a.task_id = t.id and a.is_primary
  left join drivers d on d.id = a.driver_id
  where f.airport_id = p_airport_id
    and t.company_id = auth_company_id()
    and (p_exclude_task is null or t.id <> p_exclude_task)
    and t.status not in ('cancelled','completed','declined','no_show')
    and not t.metadata ? 'shared_with'
    and abs(extract(epoch from (f.scheduled_time - p_time)) / 60)
        <= (select airport_share_window_min from company_settings where company_id = auth_company_id())
  order by minutes_apart
$$;

-- riders follow their host: completed together; released if the host is cancelled
create or replace function trg_shared_ride_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status is not distinct from old.status then return new; end if;

  if new.status = 'completed' then
    for r in
      select t.id, t.company_id, t.status from task_links l join tasks t on t.id = l.task_id
      where l.related_task_id = new.id and l.relation = 'shared_ride'
        and t.status not in ('completed','cancelled','no_show')
    loop
      update tasks set status = 'completed', actual_start_at = new.actual_start_at, actual_end_at = new.actual_end_at
      where id = r.id;
      insert into task_events (task_id, company_id, type, from_status, to_status, payload)
      values (r.id, r.company_id, 'completed', r.status, 'completed', jsonb_build_object('shared_ride_with', new.id));
    end loop;
  elsif new.status in ('cancelled','no_show') then
    -- host gone: riders need a car again; a cancelled rider leaves the host
    update tasks t set metadata = t.metadata - 'shared_with'
    from task_links l
    where l.relation = 'shared_ride' and l.related_task_id = new.id and t.id = l.task_id;
    delete from task_links where relation = 'shared_ride' and (related_task_id = new.id or task_id = new.id);
    if new.metadata ? 'shared_with' then
      update tasks set metadata = metadata - 'shared_with' where id = new.id;
    end if;
  end if;
  return new;
end $$;
create trigger trg_tasks_shared_ride_follow after update of status on tasks
  for each row execute function trg_shared_ride_follow();

-- ---------------------------------------------------------------------
-- 7. grants (Supabase's default privileges cover new functions; explicit
--    for plain Postgres / PGlite verification)
-- ---------------------------------------------------------------------
-- the engine takes a company id: only callable through the wrappers above
revoke execute on function fn_conflicts_for(uuid, uuid, uuid, timestamptz, timestamptz, double precision, double precision, uuid)
  from public, anon, authenticated;
grant execute on function rpc_preview_task_conflicts(uuid[], timestamptz, timestamptz, uuid, double precision, double precision, uuid) to authenticated;
grant execute on function fn_set_primary_driver(uuid, uuid, uuid) to authenticated;
grant execute on function fn_conflict_gate(uuid, text) to authenticated;
grant execute on function rpc_save_task(jsonb) to authenticated;
grant execute on function rpc_reschedule_task(uuid, timestamptz, uuid, boolean, text) to authenticated;
grant execute on function rpc_override_task_conflicts(uuid, text) to authenticated;
grant execute on function rpc_share_trip(uuid, uuid) to authenticated;
