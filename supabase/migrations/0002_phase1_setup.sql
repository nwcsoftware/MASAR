-- =====================================================================
--  MASAR — Migration 0002: Phase 1 setup (FR-01 … FR-05, FR-60, FR-61)
--
--  Security fixes found while building the Phase 1 write flows:
--   1. profiles_update_self let any user change their own role / company_id
--      (self-promotion to owner, tenant hopping)  → column guard trigger
--   2. drivers_self_update let a driver change any column of their record
--      (company, hour cap, licence)               → column guard trigger
--   3. user_sites_admin had no company check      → company-scoped policies
--   4. companies_insert + (1) was the only onboarding path
--                                                  → rpc_create_company
--  Plus: rpc_set_site_airports (FR-03, atomic), and the driver live-status
--  fix in rpc_task_transition (docs/DATABASE.md "Known issue").
--
--  Guards key off current_user: direct client DML runs as `authenticated`;
--  SECURITY DEFINER RPCs (rpc_*), service_role Edge Functions and
--  migrations run as other roles and are trusted.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles: only admins of the same company may change role / company /
--    active flag — never their own; only owners grant or revoke owner
-- ---------------------------------------------------------------------
create or replace function trg_profiles_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'profile id is immutable' using errcode = '42501';
  end if;
  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id
     or new.is_active is distinct from old.is_active then
    if new.id = auth.uid() then
      raise exception 'you cannot change your own role, company or active flag' using errcode = '42501';
    end if;
    if not auth_is_admin()
       or old.company_id is distinct from auth_company_id()
       or new.company_id is distinct from old.company_id then
      raise exception 'only an admin of this company can change roles' using errcode = '42501';
    end if;
    if (new.role = 'owner' or old.role = 'owner') and auth_role() <> 'owner' then
      raise exception 'only an owner can grant or revoke the owner role' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger trg_profiles_guard before update on profiles
  for each row execute function trg_profiles_guard();

-- ---------------------------------------------------------------------
-- 2. drivers: a driver editing their own record may only touch contact
--    fields; everything else is admin-only (drivers_write)
-- ---------------------------------------------------------------------
create or replace function trg_drivers_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or auth_is_admin() then
    return new;
  end if;
  if (to_jsonb(new) - array['phone', 'photo_url', 'updated_at'])
     is distinct from (to_jsonb(old) - array['phone', 'photo_url', 'updated_at']) then
    raise exception 'drivers may only update their phone and photo' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trg_drivers_guard before update on drivers
  for each row execute function trg_drivers_guard();

-- ---------------------------------------------------------------------
-- 3. user_sites: admins manage scopes for users and sites of their company
-- ---------------------------------------------------------------------
drop policy user_sites_select on user_sites;
drop policy user_sites_admin on user_sites;

create or replace function auth_user_in_company(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and company_id = auth_company_id())
$$;

create policy user_sites_select on user_sites for select using (
  user_id = auth.uid() or (auth_is_admin() and auth_user_in_company(user_id)));
create policy user_sites_admin on user_sites for all
  using (auth_is_admin() and auth_user_in_company(user_id)
         and exists (select 1 from sites s where s.id = site_id and s.company_id = auth_company_id()))
  with check (auth_is_admin() and auth_user_in_company(user_id)
              and exists (select 1 from sites s where s.id = site_id and s.company_id = auth_company_id()));

-- ---------------------------------------------------------------------
-- 4. onboarding (FR-01): create a company and become its owner
-- ---------------------------------------------------------------------
drop policy companies_insert on companies;

create or replace function rpc_create_company(
  p_name             text,
  p_name_ar          text default null,
  p_country_code     text default 'SA',
  p_timezone         text default 'Asia/Riyadh',
  p_default_language app_language default 'en'
) returns companies
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c     companies%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from profiles where id = v_uid and company_id is not null) then
    raise exception 'you already belong to a company' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'company name is required' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'unknown time zone %', p_timezone using errcode = '22023';
  end if;

  insert into companies (name, name_ar, country_code, timezone, default_language)
  values (btrim(p_name), nullif(btrim(p_name_ar), ''), upper(p_country_code), p_timezone, p_default_language)
  returning * into c;
  insert into company_settings (company_id) values (c.id);
  update profiles set company_id = c.id, role = 'owner' where id = v_uid;
  return c;
end $$;

-- ---------------------------------------------------------------------
-- 5. FR-03: save a site's airports in one call — upsert the company
--    catalogue by IATA, replace the site's links, keep exactly one default.
--    SECURITY INVOKER: RLS (staff) applies to every write.
--    p_airports: [{iata, icao, name, name_ar, city, city_ar, country_code,
--                  lat, lng, is_international, source, distance_km,
--                  drive_minutes, default_buffer_min, is_default}]
-- ---------------------------------------------------------------------
create or replace function rpc_set_site_airports(p_site_id uuid, p_airports jsonb)
returns setof site_airports
language plpgsql set search_path = public as $$
declare
  v_company uuid;
  a         jsonb;
  v_airport uuid;
  v_ids     uuid[] := '{}';
  v_default uuid;
begin
  select company_id into v_company from sites where id = p_site_id;
  if v_company is null then
    raise exception 'site not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_airports) <> 'array' then
    raise exception 'p_airports must be an array' using errcode = '22023';
  end if;

  for a in select * from jsonb_array_elements(p_airports) loop
    if coalesce(a->>'iata', '') !~ '^[A-Z]{3}$' then
      raise exception 'airport needs a 3-letter IATA code: %', a->>'iata' using errcode = '22023';
    end if;
    insert into airports (company_id, iata, icao, name, name_ar, city, city_ar, country_code,
                          lat, lng, is_international, source)
    values (v_company, a->>'iata', a->>'icao', a->>'name', a->>'name_ar', a->>'city', a->>'city_ar',
            coalesce(a->>'country_code', (select country_code from companies where id = v_company)),
            (a->>'lat')::double precision, (a->>'lng')::double precision,
            coalesce((a->>'is_international')::boolean, true), coalesce(a->>'source', 'ai'))
    on conflict (company_id, iata) do update set
      icao = coalesce(excluded.icao, airports.icao),
      name = excluded.name,
      name_ar = coalesce(excluded.name_ar, airports.name_ar),
      city = coalesce(excluded.city, airports.city),
      city_ar = coalesce(excluded.city_ar, airports.city_ar)
    returning id into v_airport;

    v_ids := v_ids || v_airport;
    if coalesce((a->>'is_default')::boolean, false) and v_default is null then
      v_default := v_airport;
    end if;

    insert into site_airports (site_id, airport_id, is_default, distance_km, drive_minutes, default_buffer_min)
    values (p_site_id, v_airport, false, (a->>'distance_km')::numeric, (a->>'drive_minutes')::int,
            coalesce((a->>'default_buffer_min')::int, 30))
    on conflict (site_id, airport_id) do update set
      distance_km = coalesce(excluded.distance_km, site_airports.distance_km),
      drive_minutes = coalesce(excluded.drive_minutes, site_airports.drive_minutes),
      default_buffer_min = excluded.default_buffer_min;
  end loop;

  delete from site_airports where site_id = p_site_id and not (airport_id = any (v_ids));
  update site_airports set is_default = (airport_id = coalesce(v_default, v_ids[1]))
   where site_id = p_site_id;

  return query select * from site_airports where site_id = p_site_id;
end $$;

-- ---------------------------------------------------------------------
-- 6. rpc_task_transition: driver live status derived from all open work
-- ---------------------------------------------------------------------
create or replace function rpc_task_transition(
  p_task_id  uuid,
  p_action   text,            -- acknowledge | decline | start | arrive | delay | resume | complete | cancel
  p_payload  jsonb default '{}',
  p_event_id uuid default gen_random_uuid()
) returns tasks
language plpgsql security definer set search_path = public as $$
declare
  t        tasks%rowtype;
  v_from   task_status;
  v_to     task_status;
  v_driver uuid := auth_driver_id();
  v_lat    double precision := (p_payload->>'lat')::double precision;
  v_lng    double precision := (p_payload->>'lng')::double precision;
  v_evt    task_event_type;
  v_assignee uuid;
begin
  -- idempotent replay from offline queue
  if exists (select 1 from task_events where id = p_event_id) then
    select * into t from tasks where id = p_task_id; return t;
  end if;

  select * into t from tasks where id = p_task_id for update;
  if t.id is null then raise exception 'task not found'; end if;
  if t.company_id <> auth_company_id() then raise exception 'forbidden'; end if;
  if not auth_is_staff() and not exists (
       select 1 from task_assignments where task_id = p_task_id and driver_id = v_driver) then
    raise exception 'not assigned to this task';
  end if;

  v_from := t.status;
  case p_action
    when 'acknowledge' then
      if v_from <> 'assigned' then raise exception 'cannot acknowledge from %', v_from; end if;
      v_to := 'acknowledged'; v_evt := 'acknowledged';
      update task_assignments set acknowledged_at = now() where task_id = p_task_id and driver_id = v_driver;
    when 'decline' then
      if v_from not in ('assigned') then raise exception 'cannot decline from %', v_from; end if;
      v_to := 'declined'; v_evt := 'declined';
      update task_assignments set declined_at = now(), decline_reason = p_payload->>'reason'
        where task_id = p_task_id and driver_id = v_driver;
    when 'start' then
      if v_from not in ('assigned','acknowledged','delayed') then raise exception 'cannot start from %', v_from; end if;
      v_to := 'en_route'; v_evt := 'started';
      update tasks set actual_start_at = coalesce(actual_start_at, now()),
                       odometer_start_km = coalesce((p_payload->>'odometer_km')::int, odometer_start_km)
        where id = p_task_id;
    when 'arrive' then
      if v_from not in ('en_route','delayed') then raise exception 'cannot arrive from %', v_from; end if;
      v_to := 'in_progress'; v_evt := 'arrived';
    when 'delay' then
      if v_from not in ('assigned','acknowledged','en_route','in_progress') then raise exception 'cannot delay from %', v_from; end if;
      v_to := 'delayed'; v_evt := 'delayed';
      insert into task_delays (task_id, reported_by, reason, delay_min, note, previous_status, new_estimated_start)
      values (p_task_id, auth.uid(), coalesce((p_payload->>'reason')::delay_reason, 'other'),
              (p_payload->>'delay_min')::int, p_payload->>'note', v_from,
              case when (p_payload->>'delay_min') is not null
                   then fn_task_effective_start(p_task_id) + make_interval(mins => (p_payload->>'delay_min')::int) end);
      if (p_payload->>'delay_min') is not null then
        update flight_details
           set estimated_time = coalesce(estimated_time, scheduled_time) + make_interval(mins => (p_payload->>'delay_min')::int),
               flight_status = case when (p_payload->>'reason') = 'flight_delayed' then 'delayed' else flight_status end
         where task_id = p_task_id;
      end if;
    when 'resume' then
      if v_from <> 'delayed' then raise exception 'cannot resume from %', v_from; end if;
      select previous_status into v_to from task_delays where task_id = p_task_id and resolved_at is null
        order by created_at desc limit 1;
      v_to := coalesce(v_to, 'acknowledged'); v_evt := 'resumed';
      update task_delays set resolved_at = now() where task_id = p_task_id and resolved_at is null;
    when 'complete' then
      if v_from not in ('en_route','in_progress','delayed') then raise exception 'cannot complete from %', v_from; end if;
      v_to := 'completed'; v_evt := 'completed';
      update tasks set actual_end_at = now(),
                       actual_start_at = coalesce(actual_start_at, scheduled_start),
                       odometer_end_km = coalesce((p_payload->>'odometer_km')::int, odometer_end_km),
                       actual_distance_km = coalesce((p_payload->>'distance_km')::numeric,
                                                     nullif((p_payload->>'odometer_km')::int - odometer_start_km, 0),
                                                     actual_distance_km),
                       completion_notes = coalesce(p_payload->>'notes', completion_notes)
        where id = p_task_id;
      update task_delays set resolved_at = now() where task_id = p_task_id and resolved_at is null;
    when 'cancel' then
      if not auth_is_staff() then raise exception 'only staff can cancel'; end if;
      if v_from in ('completed','cancelled') then raise exception 'cannot cancel from %', v_from; end if;
      v_to := 'cancelled'; v_evt := 'cancelled';
      update tasks set cancel_reason = p_payload->>'reason' where id = p_task_id;
    else
      raise exception 'unknown action %', p_action;
  end case;

  update tasks set status = v_to where id = p_task_id returning * into t;

  insert into task_events (id, task_id, company_id, type, actor_id, from_status, to_status, lat, lng, payload, client_ts)
  values (p_event_id, p_task_id, t.company_id, v_evt, auth.uid(), v_from, v_to, v_lat, v_lng, p_payload,
          (p_payload->>'client_ts')::timestamptz);

  -- keep live status in sync for every driver on the task, derived from that
  -- driver's most active open task (not from this task alone), so acknowledging
  -- a later trip no longer resets an en-route/delayed driver to idle (0002 fix)
  for v_assignee in select driver_id from task_assignments where task_id = p_task_id loop
    update drivers d set current_status = coalesce((
        select case t2.status when 'in_progress' then 'in_progress'::driver_status
                              when 'delayed'     then 'delayed'::driver_status
                              else 'en_route'::driver_status end
        from task_assignments a2 join tasks t2 on t2.id = a2.task_id
        where a2.driver_id = v_assignee and t2.status in ('en_route','in_progress','delayed')
        order by case t2.status when 'in_progress' then 0 when 'delayed' then 1 else 2 end
        limit 1), 'idle'),
      last_seen_at = case when v_assignee = v_driver then now() else d.last_seen_at end
    where d.id = v_assignee;
  end loop;

  -- refresh day summary on completion
  if v_to = 'completed' then
    perform fn_refresh_driver_day_summary(a.driver_id, (t.scheduled_start at time zone
             (select timezone from companies where id = t.company_id))::date)
    from task_assignments a where a.task_id = p_task_id;
  end if;
  return t;
end $$;

grant execute on function rpc_create_company(text, text, text, text, app_language) to authenticated;
grant execute on function rpc_set_site_airports(uuid, jsonb) to authenticated;
grant execute on function auth_user_in_company(uuid) to authenticated;
