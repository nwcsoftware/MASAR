-- =====================================================================
--  MASAR — Migration 0004: staff directory, grades and grade groups
--
--  Company rule: staff carry a grade (01–20). Grades roll up into groups the
--  company defines (A = most senior, then B, C, D …), and only one group may
--  travel in a car — the car's own group. Drivers have a grade of their own
--  and a "drives for" group: A drives everyone, C only C and below.
--
--   1. grade_groups — per-company ranges (rank 1 = A = most senior);
--      rpc_set_grade_groups replaces them atomically (admin).
--   2. people — the staff directory (Excel import / added from the wizard);
--      rpc_import_people upserts by employee number.
--   3. vehicles.grade_group_id; drivers.grade + drivers.serve_group_id.
--   4. Passengers (tasks.passengers jsonb) are snapshotted with their grade
--      and group at save time: {person_id?, name, phone?, grade?, group_id?,
--      group_code?, visitor?}. A one-time visitor isn't registered but is
--      given a group for the trip.
--   5. Three blocking conflict types, materialised with the others so the
--      FR-14 gate (admin override with a reason) applies unchanged:
--        grade_mixed              passengers from more than one group
--        vehicle_grade_mismatch   the car belongs to another group
--        driver_grade_not_allowed the driver may not drive a group that senior
--   6. Shared airport trips (FR-15) only merge within one group.
--
--  No groups configured → no passenger has a group → no grade conflicts.
-- =====================================================================

alter type conflict_type add value if not exists 'grade_mixed';
alter type conflict_type add value if not exists 'vehicle_grade_mismatch';
alter type conflict_type add value if not exists 'driver_grade_not_allowed';

-- ---------------------------------------------------------------------
-- 1. grade groups
-- ---------------------------------------------------------------------
create table grade_groups (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  code        text not null,                 -- 'A', 'B', …
  name        text,
  name_ar     text,
  rank        int  not null,                 -- 1 = most senior
  min_grade   int  not null,
  max_grade   int  not null,
  created_at  timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, rank),
  check (min_grade between 1 and 99 and max_grade between 1 and 99 and min_grade <= max_grade)
);
create index grade_groups_company_idx on grade_groups(company_id);

alter table grade_groups enable row level security;
create policy grade_groups_select on grade_groups for select using (company_id = auth_company_id());
-- writes only through rpc_set_grade_groups (validates ranges)

-- the group a grade falls in for a company (null = ungrouped)
create or replace function fn_grade_group(p_company uuid, p_grade int) returns uuid
language sql stable security definer set search_path = public as $$
  select id from grade_groups
  where company_id = p_company and p_grade between min_grade and max_grade
  order by rank limit 1
$$;

-- p_groups: ordered [{code, name?, name_ar?, min_grade, max_grade}] — first = A (most senior)
create or replace function rpc_set_grade_groups(p_groups jsonb) returns setof grade_groups
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  g         record;
begin
  if v_company is null or not auth_is_admin() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_groups) <> 'array' then raise exception 'errors.invalidInput'; end if;

  drop table if exists _groups;
  create temp table _groups on commit drop as
  select upper(trim(x.v->>'code')) as code, nullif(trim(x.v->>'name'), '') as name,
         nullif(trim(x.v->>'name_ar'), '') as name_ar,
         (x.v->>'min_grade')::int as min_grade, (x.v->>'max_grade')::int as max_grade, x.ord::int as rank
  from jsonb_array_elements(p_groups) with ordinality as x(v, ord);

  if exists (select 1 from _groups where coalesce(code, '') = '' or min_grade is null or max_grade is null
                                       or min_grade < 1 or max_grade > 99 or min_grade > max_grade) then
    raise exception 'grades.errors.range';
  end if;
  if (select count(distinct code) from _groups) <> (select count(*) from _groups) then
    raise exception 'grades.errors.duplicateCode';
  end if;
  if exists (select 1 from _groups a join _groups b on a.rank < b.rank
             where int4range(a.min_grade, a.max_grade, '[]') && int4range(b.min_grade, b.max_grade, '[]')) then
    raise exception 'grades.errors.overlap';
  end if;

  -- keep ids of codes that stay (vehicles / drivers point at them); free the ranks first
  update grade_groups set rank = rank + 1000 where company_id = v_company;
  delete from grade_groups where company_id = v_company and code not in (select code from _groups);
  for g in select * from _groups order by rank loop
    insert into grade_groups (company_id, code, name, name_ar, rank, min_grade, max_grade)
    values (v_company, g.code, g.name, g.name_ar, g.rank, g.min_grade, g.max_grade)
    on conflict (company_id, code) do update set
      name = excluded.name, name_ar = excluded.name_ar, rank = excluded.rank,
      min_grade = excluded.min_grade, max_grade = excluded.max_grade;
  end loop;
  return query select * from grade_groups where company_id = v_company order by rank;
end $$;

-- ---------------------------------------------------------------------
-- 2. staff directory
-- ---------------------------------------------------------------------
create table people (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  employee_no  text,
  full_name    text not null,
  full_name_ar text,
  grade        int check (grade between 1 and 99),
  job_title    text,
  department   text,
  site_id      uuid references sites(id) on delete set null,
  phone        text,
  email        text,
  is_active    boolean not null default true,
  notes        text,
  source       text not null default 'manual',   -- manual | import
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, employee_no)
);
create index people_company_idx on people(company_id);
create index people_name_idx on people(company_id, lower(full_name));
create trigger trg_people_updated before update on people for each row execute function fn_set_updated_at();

alter table people enable row level security;
-- staff and viewers read the directory; drivers see passengers on their own tasks only (tasks.passengers)
create policy people_select on people for select using (company_id = auth_company_id() and auth_role() <> 'driver');
create policy people_insert on people for insert with check (company_id = auth_company_id() and auth_is_staff());
create policy people_update on people for update using (company_id = auth_company_id() and auth_is_staff())
                                                 with check (company_id = auth_company_id() and auth_is_staff());
create policy people_delete on people for delete using (company_id = auth_company_id() and auth_is_admin());

-- Excel import (FR: staff directory). Upsert by employee number; rows
-- without one are always inserted. Returns {inserted, updated}.
create or replace function rpc_import_people(p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  v_company  uuid := auth_company_id();
  v_inserted int := 0;
  v_updated  int := 0;
  r          record;
  v_site     uuid;
begin
  if v_company is null or not auth_is_staff() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'errors.invalidInput'; end if;
  for r in
    select nullif(trim(x->>'employee_no'), '') as employee_no, trim(x->>'full_name') as full_name,
           nullif(trim(x->>'full_name_ar'), '') as full_name_ar, (x->>'grade')::int as grade,
           nullif(trim(x->>'job_title'), '') as job_title, nullif(trim(x->>'department'), '') as department,
           nullif(trim(x->>'site'), '') as site, nullif(trim(x->>'phone'), '') as phone,
           nullif(lower(trim(x->>'email')), '') as email
    from jsonb_array_elements(p_rows) x
  loop
    if coalesce(r.full_name, '') = '' then raise exception 'people.errors.name'; end if;
    if r.grade is not null and (r.grade < 1 or r.grade > 99) then raise exception 'people.errors.grade'; end if;
    -- site by code or name (EN/AR), case-insensitive
    select id into v_site from sites
    where company_id = v_company and r.site is not null
      and (upper(code) = upper(r.site) or lower(name) = lower(r.site) or name_ar = r.site)
    limit 1;
    if r.employee_no is not null and exists (select 1 from people where company_id = v_company and employee_no = r.employee_no) then
      update people set full_name = r.full_name, full_name_ar = coalesce(r.full_name_ar, full_name_ar),
                        grade = coalesce(r.grade, grade), job_title = coalesce(r.job_title, job_title),
                        department = coalesce(r.department, department), site_id = coalesce(v_site, site_id),
                        phone = coalesce(r.phone, phone), email = coalesce(r.email, email), is_active = true
      where company_id = v_company and employee_no = r.employee_no;
      v_updated := v_updated + 1;
    else
      insert into people (company_id, employee_no, full_name, full_name_ar, grade, job_title, department,
                          site_id, phone, email, source, created_by)
      values (v_company, r.employee_no, r.full_name, r.full_name_ar, r.grade, r.job_title, r.department,
              v_site, r.phone, r.email, 'import', auth.uid());
      v_inserted := v_inserted + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end $$;

-- ---------------------------------------------------------------------
-- 3. vehicles and drivers
-- ---------------------------------------------------------------------
alter table vehicles add column grade_group_id uuid references grade_groups(id) on delete set null;
alter table drivers  add column grade int check (grade between 1 and 99);
-- the most senior group this driver may drive for (A = everyone); null = unrestricted
alter table drivers  add column serve_group_id uuid references grade_groups(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. passenger snapshots
-- ---------------------------------------------------------------------
-- Resolves each passenger against the directory and stamps grade + group:
-- registered people take their current grade; visitors keep the group the
-- dispatcher picked; free-text legacy rows stay ungraded.
create or replace function fn_snapshot_passengers(p_company uuid, p_passengers jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_out   jsonb := '[]';
  p       jsonb;
  v_person people%rowtype;
  v_group grade_groups%rowtype;
begin
  if auth.uid() is not null and p_company is distinct from auth_company_id() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if p_passengers is not null and jsonb_typeof(p_passengers) <> 'array' then
    raise exception 'errors.invalidInput';
  end if;
  for p in select * from jsonb_array_elements(coalesce(p_passengers, '[]')) loop
    v_group := null;
    if nullif(p->>'person_id', '') is not null then
      select * into v_person from people where id = (p->>'person_id')::uuid and company_id = p_company;
      if v_person.id is null then raise exception 'errors.invalidInput'; end if;
      select * into v_group from grade_groups where id = fn_grade_group(p_company, v_person.grade);
      p := jsonb_strip_nulls(jsonb_build_object(
        'person_id', v_person.id, 'name', coalesce(nullif(trim(p->>'name'), ''), v_person.full_name),
        'phone', coalesce(nullif(trim(p->>'phone'), ''), v_person.phone), 'note', p->>'note',
        'grade', v_person.grade, 'group_id', v_group.id, 'group_code', v_group.code));
    elsif coalesce((p->>'visitor')::boolean, false) then
      select * into v_group from grade_groups
      where company_id = p_company and id = nullif(p->>'group_id', '')::uuid;
      p := jsonb_strip_nulls(jsonb_build_object(
        'name', trim(p->>'name'), 'phone', nullif(trim(p->>'phone'), ''), 'note', p->>'note',
        'visitor', true, 'group_id', v_group.id, 'group_code', v_group.code));
    else
      p := jsonb_strip_nulls(jsonb_build_object('name', trim(p->>'name'), 'phone', nullif(trim(p->>'phone'), ''), 'note', p->>'note'));
    end if;
    if coalesce(trim(p->>'name'), '') = '' then raise exception 'tasks.errors.passengerName'; end if;
    v_out := v_out || jsonb_build_array(p);
  end loop;
  return v_out;
end $$;

-- ---------------------------------------------------------------------
-- 5. grade conflicts
-- ---------------------------------------------------------------------
create or replace function fn_grade_conflicts(p_company uuid, p_passengers jsonb, p_vehicle_id uuid, p_driver_id uuid)
returns table (type conflict_type, severity conflict_severity, other_task_id uuid, details jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  v_codes    text[];
  v_vehicle  grade_groups%rowtype;
  v_serve    grade_groups%rowtype;
  v_senior   grade_groups%rowtype;
begin
  if auth.uid() is not null and p_company is distinct from auth_company_id() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  -- groups on board, most senior first (current definitions, by id)
  select array_agg(g.code order by g.rank) into v_codes
  from grade_groups g
  where g.company_id = p_company
    and g.id in (select (x->>'group_id')::uuid from jsonb_array_elements(coalesce(p_passengers, '[]')) x
                 where nullif(x->>'group_id', '') is not null);
  if v_codes is null then return; end if;

  if array_length(v_codes, 1) > 1 then
    type := 'grade_mixed'; severity := 'blocking'; other_task_id := null;
    details := jsonb_build_object('groups', to_jsonb(v_codes));
    return next;
  end if;

  if p_vehicle_id is not null then
    select g.* into v_vehicle from vehicles v join grade_groups g on g.id = v.grade_group_id
    where v.id = p_vehicle_id and v.company_id = p_company;
    if v_vehicle.id is not null and v_codes <> array[v_vehicle.code] then
      type := 'vehicle_grade_mismatch'; severity := 'blocking'; other_task_id := null;
      details := jsonb_build_object('vehicle_group', v_vehicle.code, 'groups', to_jsonb(v_codes));
      return next;
    end if;
  end if;

  if p_driver_id is not null then
    select g.* into v_serve from drivers d join grade_groups g on g.id = d.serve_group_id
    where d.id = p_driver_id and d.company_id = p_company;
    select * into v_senior from grade_groups where company_id = p_company and code = v_codes[1];
    if v_serve.id is not null and v_senior.rank < v_serve.rank then
      type := 'driver_grade_not_allowed'; severity := 'blocking'; other_task_id := null;
      details := jsonb_build_object('serve_group', v_serve.code, 'group', v_senior.code);
      return next;
    end if;
  end if;
end $$;

-- time conflicts per assignment (0001) + grade conflicts once per task
create or replace function fn_refresh_task_conflicts(p_task_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a      record;
  t      tasks%rowtype;
  v_main task_assignments%rowtype;
begin
  update task_conflicts set resolved_at = now() where task_id = p_task_id and resolved_at is null;
  for a in select driver_id, vehicle_id from task_assignments where task_id = p_task_id loop
    insert into task_conflicts (task_id, other_task_id, driver_id, vehicle_id, type, severity, details)
    select p_task_id, c.other_task_id, a.driver_id, a.vehicle_id, c.type, c.severity, c.details
    from fn_check_task_conflicts(p_task_id, a.driver_id, a.vehicle_id) c;
  end loop;

  select * into t from tasks where id = p_task_id;
  select * into v_main from task_assignments where task_id = p_task_id and is_primary;
  insert into task_conflicts (task_id, other_task_id, driver_id, vehicle_id, type, severity, details)
  select p_task_id, null, v_main.driver_id, v_main.vehicle_id, c.type, c.severity, c.details
  from fn_grade_conflicts(t.company_id, t.passengers, v_main.vehicle_id, v_main.driver_id) c;
end $$;

-- passengers changed outside the wizard (e.g. a shared ride) → re-check
create or replace function trg_task_passenger_conflicts() returns trigger
language plpgsql as $$
begin
  if new.passengers is distinct from old.passengers then
    perform fn_refresh_task_conflicts(new.id);
  end if;
  return new;
end $$;
create trigger trg_tasks_passenger_conflicts after update of passengers on tasks
  for each row execute function trg_task_passenger_conflicts();

-- the wizard's preview of the grade rules for a proposed trip
create or replace function rpc_preview_grade_conflicts(p_passengers jsonb, p_vehicle_id uuid default null, p_driver_id uuid default null)
returns table (type conflict_type, severity conflict_severity, other_task_id uuid, details jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := auth_company_id();
begin
  if v_company is null or not auth_is_staff() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  return query select * from fn_grade_conflicts(v_company, fn_snapshot_passengers(v_company, p_passengers), p_vehicle_id, p_driver_id);
end $$;

-- ---------------------------------------------------------------------
-- rpc_save_task — the 0003 body; passengers now go through
-- fn_snapshot_passengers so grades and groups come from the directory,
-- never from the client
-- ---------------------------------------------------------------------
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
  -- 0004: passengers resolved against the directory, grade + group stamped
  v_passengers jsonb := fn_snapshot_passengers(v_company, coalesce(p_task->'passengers', '[]'));
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
            v_passengers, coalesce(p_task->'metadata', '{}'), auth.uid(), auth.uid())
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
      passengers = v_passengers,
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
-- 6. FR-15 shared trips stay within one group
-- ---------------------------------------------------------------------
create or replace function fn_share_grade_check(p_task_id uuid, p_host_task_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  t tasks%rowtype;
  h tasks%rowtype;
  a task_assignments%rowtype;
begin
  select * into t from tasks where id = p_task_id;
  select * into h from tasks where id = p_host_task_id;
  select * into a from task_assignments where task_id = h.id and is_primary;
  if exists (select 1 from fn_grade_conflicts(h.company_id, h.passengers || t.passengers, a.vehicle_id, a.driver_id)) then
    raise exception 'share.errors.gradeMismatch';
  end if;
end $$;

create or replace function trg_task_links_grade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.relation = 'shared_ride' then
    perform fn_share_grade_check(new.task_id, new.related_task_id);
  end if;
  return new;
end $$;
create trigger trg_task_links_grade before insert on task_links
  for each row execute function trg_task_links_grade();

-- similar trips now say which groups ride in them, so the hint can skip
-- incompatible cars (return type changes → drop + create)
drop function if exists fn_similar_airport_trips(uuid, timestamptz, uuid);
create function fn_similar_airport_trips(
  p_airport_id uuid,
  p_time       timestamptz,
  p_exclude_task uuid default null
) returns table (
  task_id uuid, site_id uuid, site_name text, direction flight_direction,
  flight_no text, scheduled_time timestamptz, scheduled_start timestamptz,
  driver_name text, minutes_apart int, passenger_groups text[], vehicle_group text
)
language sql stable security definer set search_path = public as $$
  select t.id, t.site_id, s.name, f.direction, f.flight_no, f.scheduled_time, t.scheduled_start,
         d.full_name,
         abs(extract(epoch from (f.scheduled_time - p_time)) / 60)::int as minutes_apart,
         coalesce((select array_agg(distinct x->>'group_code') from jsonb_array_elements(t.passengers) x
                   where x ? 'group_code'), '{}'),
         vg.code
  from flight_details f
  join tasks t on t.id = f.task_id
  join sites s on s.id = t.site_id
  left join task_assignments a on a.task_id = t.id and a.is_primary
  left join drivers d on d.id = a.driver_id
  left join vehicles v on v.id = a.vehicle_id
  left join grade_groups vg on vg.id = v.grade_group_id
  where f.airport_id = p_airport_id
    and t.company_id = auth_company_id()
    and (p_exclude_task is null or t.id <> p_exclude_task)
    and t.status not in ('cancelled','completed','declined','no_show')
    and not t.metadata ? 'shared_with'
    and abs(extract(epoch from (f.scheduled_time - p_time)) / 60)
        <= (select airport_share_window_min from company_settings where company_id = auth_company_id())
  order by minutes_apart
$$;

grant execute on function fn_grade_group(uuid, int) to authenticated;
grant execute on function rpc_set_grade_groups(jsonb) to authenticated;
grant execute on function rpc_import_people(jsonb) to authenticated;
grant execute on function fn_snapshot_passengers(uuid, jsonb) to authenticated;
grant execute on function fn_grade_conflicts(uuid, jsonb, uuid, uuid) to authenticated;
grant execute on function rpc_preview_grade_conflicts(jsonb, uuid, uuid) to authenticated;
grant execute on function fn_share_grade_check(uuid, uuid) to authenticated;
grant execute on function fn_similar_airport_trips(uuid, timestamptz, uuid) to authenticated;
grant select, insert, update, delete on grade_groups, people to authenticated;
