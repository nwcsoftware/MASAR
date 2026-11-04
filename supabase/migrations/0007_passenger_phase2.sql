-- =====================================================================
-- Masar — 0007: passenger module, phase 2
-- Live tracking + share link, passenger notifications (in-app + push),
-- pickup check-in (QR / one-time code), SOS, trip requests.
--
-- Rules
--  • A passenger sees the driver's position only for their own trip, only
--    while it is active (acknowledged → in progress, ±2 h window).
--  • Share links are random tokens, read-only, anonymous, and die when the
--    trip ends (completed / cancelled), is revoked, or expires.
--  • Check-in codes are 6 digits per passenger per trip; drivers can never
--    read them (column privileges), they type or scan what the passenger
--    shows. Five wrong codes in 10 minutes lock check-in for that trip.
--  • Check-in / drop-off / SOS / document uploads are written to audit_log.
--  • SOS: active trips only; fans out to owners/admins and the site's
--    dispatchers; the app also hands the location to emergency contacts.
--  • Trip requests (new / reschedule / cancel) are decided by staff with
--    access to the site; approving a reschedule goes through the conflict
--    gate (rpc_reschedule_task), a cancel removes the passenger (or cancels
--    the trip when they ride alone).
-- Enum values added here are only compared / cast at run time.
-- =====================================================================

alter type notification_type add value if not exists 'passenger_trip_assigned';
alter type notification_type add value if not exists 'driver_changed';
alter type notification_type add value if not exists 'driver_on_the_way';
alter type notification_type add value if not exists 'driver_arrived';
alter type notification_type add value if not exists 'trip_document_added';
alter type notification_type add value if not exists 'sos_alert';
alter type notification_type add value if not exists 'trip_request';
alter type notification_type add value if not exists 'trip_request_decided';

-- fix (0001): in `a.task_id = id` the bare `id` bound to task_assignments.id,
-- so drivers could never read their own tasks from the table
drop policy tasks_select on tasks;
create policy tasks_select on tasks for select using (
  company_id = auth_company_id() and (
    auth_role() in ('owner','admin','viewer')
    or (auth_role() = 'dispatcher' and auth_can_access_site(site_id))
    or exists (select 1 from task_assignments a where a.task_id = tasks.id and a.driver_id = auth_driver_id())
  ));

-- ---------------------------------------------------------------------
-- 1. notification helpers
-- ---------------------------------------------------------------------
-- every approved passenger with a login on a trip (optionally one person)
create or replace function fn_notify_passengers(
  p_task_id uuid, p_type text, p_body text default null, p_data jsonb default '{}', p_person_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (company_id, user_id, type, task_id, title, body, data, channels)
  select t.company_id, p.profile_id, p_type::notification_type, t.id, t.title, p_body,
         p_data || jsonb_build_object('audience', 'passenger'), '{in_app,push}'
  from tasks t
  join task_passengers tp on tp.task_id = t.id
  join people p on p.id = tp.person_id
  where t.id = p_task_id and p.profile_id is not null and p.registration_status = 'approved'
    and (p_person_id is null or p.id = p_person_id);
end $$;

-- owners/admins plus the dispatchers who can act on the site
create or replace function fn_notify_site_staff(
  p_company_id uuid, p_site_id uuid, p_type text, p_task_id uuid, p_title text, p_body text, p_data jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (company_id, user_id, type, task_id, title, body, data, channels)
  select p_company_id, p.id, p_type::notification_type, p_task_id, p_title, p_body, p_data, '{in_app,push}'
  from profiles p
  where p.company_id = p_company_id and p.is_active
    and (p.role in ('owner','admin')
         or (p.role = 'dispatcher' and (p_site_id is null or auth_can_access_site_for(p.id, p_site_id))));
end $$;

-- ---------------------------------------------------------------------
-- 2. check-in codes + "you're on a trip" notification
-- ---------------------------------------------------------------------
create or replace function fn_new_checkin_code(p_task_id uuid) returns text
language plpgsql volatile set search_path = public as $$
declare v_code text;
begin
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from task_passengers where task_id = p_task_id and checkin_code = v_code);
  end loop;
  return v_code;
end $$;

-- 0006 version + codes for newcomers + notify people added to an upcoming trip
create or replace function fn_sync_task_passengers(p_task_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t tasks%rowtype;
  r record;
begin
  select * into t from tasks where id = p_task_id;
  create temp table if not exists _tp_keep (person_id uuid, name text, checkin_code text, checked_in_at timestamptz, dropped_off_at timestamptz) on commit drop;
  delete from _tp_keep;
  insert into _tp_keep select person_id, name, checkin_code, checked_in_at, dropped_off_at from task_passengers where task_id = p_task_id;
  delete from task_passengers where task_id = p_task_id;
  insert into task_passengers (task_id, company_id, person_id, name, pickup_order, checkin_code, checked_in_at, dropped_off_at)
  select p_task_id, t.company_id, nullif(x.v->>'person_id', '')::uuid, coalesce(x.v->>'name', ''), x.ord::int,
         k.checkin_code, k.checked_in_at, k.dropped_off_at
  from jsonb_array_elements(coalesce(t.passengers, '[]')) with ordinality as x(v, ord)
  left join _tp_keep k on (k.person_id is not null and k.person_id = nullif(x.v->>'person_id', '')::uuid)
                       or (k.person_id is null and nullif(x.v->>'person_id', '') is null and k.name = x.v->>'name');

  for r in select id from task_passengers where task_id = p_task_id and checkin_code is null loop
    update task_passengers set checkin_code = fn_new_checkin_code(p_task_id) where id = r.id;
  end loop;

  if t.status::text not in ('draft','completed','cancelled','declined','no_show') and t.scheduled_start > now() - interval '1 hour' then
    for r in select tp.person_id from task_passengers tp
             where tp.task_id = p_task_id and tp.person_id is not null
               and not exists (select 1 from _tp_keep k where k.person_id = tp.person_id) loop
      perform fn_notify_passengers(p_task_id, 'passenger_trip_assigned', null, '{}', r.person_id);
    end loop;
  end if;
end $$;

select fn_sync_task_passengers(id) from tasks where id in (select task_id from task_passengers where checkin_code is null);

-- drivers (and everyone else) read task_passengers without the codes
revoke select on task_passengers from authenticated, anon;
grant select (id, task_id, company_id, person_id, name, pickup_order, pickup_stop_seq, dropoff_stop_seq,
              checked_in_at, dropped_off_at, created_at) on task_passengers to authenticated;
create unique index task_passengers_code_idx on task_passengers(task_id, checkin_code);

-- ---------------------------------------------------------------------
-- 3. passengers hear about their trip: status, driver change, documents
-- ---------------------------------------------------------------------
create or replace function trg_task_status_passengers() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_type text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_type := case new.status::text
    when 'en_route' then case when old.status::text = 'delayed' and new.actual_start_at is not null and old.actual_start_at is not null
                              then null else 'driver_on_the_way' end
    when 'in_progress' then 'driver_arrived'
    when 'delayed' then 'task_delayed'
    when 'cancelled' then 'task_cancelled'
    when 'completed' then 'task_completed'
  end;
  if v_type is not null then
    perform fn_notify_passengers(new.id, v_type, case when v_type = 'task_cancelled' then new.cancel_reason end);
  end if;
  -- the trip ended: whoever is still on board was dropped off, share links stop working
  if new.status::text in ('completed','cancelled') then
    update task_passengers set dropped_off_at = now()
    where task_id = new.id and checked_in_at is not null and dropped_off_at is null;
    update trip_share_links set expires_at = least(expires_at, now()) where task_id = new.id;
  end if;
  return new;
end $$;

create or replace function trg_assignment_passengers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_primary then return new; end if;
  if tg_op = 'UPDATE' and new.driver_id is not distinct from old.driver_id then return new; end if;
  -- a previous different driver ⇒ "your driver changed"; the first assignment is part of "you're on a trip"
  if exists (select 1 from task_events e where e.task_id = new.task_id and e.type = 'assigned'
             and e.payload->>'driver_id' is distinct from new.driver_id::text) then
    perform fn_notify_passengers(new.task_id, 'driver_changed', null,
                                 jsonb_build_object('driver_name', (select full_name from drivers where id = new.driver_id)));
  end if;
  return new;
end $$;
create trigger trg_assignments_passengers after insert or update of driver_id on task_assignments
  for each row execute function trg_assignment_passengers();

create or replace function trg_attachment_passengers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- audit every upload / visibility change of a trip document
  insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
  select t.company_id, auth.uid(), 'task_attachments', new.id::text, lower(tg_op),
         jsonb_build_object('task_id', new.task_id, 'title', new.title, 'category', new.category,
                            'file_name', new.file_name, 'file_type', new.file_type, 'file_size', new.file_size,
                            'visible_to_passengers', new.visible_to_passengers)
  from tasks t where t.id = new.task_id;
  if new.visible_to_passengers and (tg_op = 'INSERT' or not old.visible_to_passengers) then
    perform fn_notify_passengers(new.task_id, 'trip_document_added', coalesce(new.title, new.file_name),
                                 jsonb_build_object('attachment_id', new.id));
  end if;
  return new;
end $$;
create trigger trg_attachments_passengers after insert or update on task_attachments
  for each row execute function trg_attachment_passengers();

-- ---------------------------------------------------------------------
-- 4. share links (anonymous, read-only, die with the trip)
-- ---------------------------------------------------------------------
create table trip_share_links (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  company_id  uuid not null references companies(id) on delete cascade,
  task_id     uuid not null references tasks(id) on delete cascade,
  person_id   uuid not null references people(id) on delete cascade,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index trip_share_links_task_idx on trip_share_links(task_id);
alter table trip_share_links enable row level security;
create policy trip_share_links_own on trip_share_links for select using (person_id = auth_person_id());

-- ---------------------------------------------------------------------
-- 5. SOS
-- ---------------------------------------------------------------------
create table sos_events (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  task_id          uuid not null references tasks(id) on delete cascade,
  person_id        uuid not null references people(id) on delete cascade,
  raised_by        uuid references profiles(id) on delete set null,
  lat              double precision,
  lng              double precision,
  accuracy_m       real,
  message          text check (char_length(message) <= 500),
  location_at      timestamptz,
  status           text not null default 'open' check (status in ('open','acknowledged','resolved')),
  acknowledged_by  uuid references profiles(id) on delete set null,
  acknowledged_at  timestamptz,
  resolved_by      uuid references profiles(id) on delete set null,
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz not null default now()
);
create index sos_events_company_idx on sos_events(company_id, status, created_at desc);
alter table sos_events enable row level security;
create policy sos_events_staff on sos_events for select using (
  company_id = auth_company_id() and auth_role()::text in ('owner','admin','dispatcher','viewer') and auth_can_see_task(task_id));
create policy sos_events_own on sos_events for select using (person_id = auth_person_id());

-- ---------------------------------------------------------------------
-- 6. trip requests
-- ---------------------------------------------------------------------
create table trip_requests (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  person_id        uuid not null references people(id) on delete cascade,
  requested_by     uuid references profiles(id) on delete set null,
  kind             text not null check (kind in ('new','reschedule','cancel')),
  task_id          uuid references tasks(id) on delete set null,      -- reschedule / cancel
  site_id          uuid references sites(id) on delete set null,      -- routes the request to dispatchers
  requested_start  timestamptz,
  pickup           text check (char_length(pickup) <= 300),
  dropoff          text check (char_length(dropoff) <= 300),
  passengers_count int not null default 1 check (passengers_count between 1 and 20),
  notes            text check (char_length(notes) <= 1000),
  status           text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  decided_by       uuid references profiles(id) on delete set null,
  decided_at       timestamptz,
  decision_note    text,
  created_task_id  uuid references tasks(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (kind = 'new' or task_id is not null)
);
create index trip_requests_company_idx on trip_requests(company_id, status, created_at desc);
create index trip_requests_person_idx on trip_requests(person_id, created_at desc);
create trigger trg_trip_requests_updated before update on trip_requests for each row execute function fn_set_updated_at();
alter table trip_requests enable row level security;
create policy trip_requests_own on trip_requests for select using (person_id = auth_person_id());
create policy trip_requests_staff on trip_requests for select using (
  company_id = auth_company_id() and auth_role()::text in ('owner','admin','dispatcher','viewer')
  and (site_id is null or auth_can_access_site(site_id)));

-- ---------------------------------------------------------------------
-- 7. the passenger's trip view (0006) + check-in, share link, open SOS
-- ---------------------------------------------------------------------
create or replace function rpc_passenger_home() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_person people%rowtype;
  v_trips  jsonb;
begin
  select * into v_person from people where profile_id = auth.uid();
  if v_person.id is null then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  if v_person.registration_status is distinct from 'approved' then
    return jsonb_build_object('status', v_person.registration_status, 'note', v_person.registration_note, 'trips', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(trip order by trip->>'scheduled_start'), '[]') into v_trips
  from (
    select jsonb_build_object(
      'id', t.id, 'title', t.title, 'category', t.category, 'status', t.status,
      'scheduled_start', t.scheduled_start, 'scheduled_end', t.scheduled_end,
      'duration_min', coalesce(t.estimated_duration_min, extract(epoch from (t.scheduled_end - t.scheduled_start)) / 60),
      'actual_start_at', t.actual_start_at, 'actual_end_at', t.actual_end_at,
      'site', jsonb_build_object('name', s.name, 'name_ar', s.name_ar),
      'stops', (select coalesce(jsonb_agg(jsonb_build_object('seq', st.seq, 'label', st.label, 'address', st.address,
                       'lat', st.lat, 'lng', st.lng, 'planned_arrival_at', st.planned_arrival_at, 'dwell_min', st.dwell_min) order by st.seq), '[]')
                from task_stops st where st.task_id = t.id),
      'flight', (select jsonb_build_object('flight_no', f.flight_no, 'airline', f.airline, 'direction', f.direction,
                        'terminal', f.terminal, 'scheduled_time', f.scheduled_time, 'estimated_time', f.estimated_time,
                        'airport', a.iata, 'airport_name', a.name, 'airport_name_ar', a.name_ar)
                 from flight_details f left join airports a on a.id = f.airport_id where f.task_id = t.id),
      'driver', (select jsonb_build_object(
                   'id', d.id, 'name', d.full_name, 'name_ar', d.full_name_ar, 'photo_url', d.photo_url,
                   'nationality', d.nationality, 'english_rating', d.english_rating,
                   'licence', (select jsonb_build_object('name', dt.name, 'name_ar', dt.name_ar)
                               from driver_documents dd join document_types dt on dt.id = dd.document_type_id
                               where dd.driver_id = d.id and dt.is_driving_licence order by dd.expires_on desc nulls last limit 1),
                   'rating', (select to_jsonb(x) from fn_driver_rating(d.id) x))
                 from task_assignments ta join drivers d on d.id = ta.driver_id
                 where ta.task_id = t.id and ta.is_primary),
      'vehicle', (select jsonb_build_object('make', v.make, 'model', v.model, 'plate_no', v.plate_no, 'color', v.color)
                  from task_assignments ta join vehicles v on v.id = ta.vehicle_id where ta.task_id = t.id and ta.is_primary),
      'contact_phone', case when fn_trip_is_live(t.id) then s.contact_phone end,
      'co_passengers', (select coalesce(jsonb_agg(jsonb_build_object('first_name', split_part(regexp_replace(o.name, '^(Eng\.|Mr\.|Mrs\.|Ms\.|Dr\.)\s*', ''), ' ', 1),
                                                                     'pickup_order', o.pickup_order, 'me', o.person_id = v_person.id)
                                          order by o.pickup_order), '[]')
                        from task_passengers o where o.task_id = t.id),
      'documents', (select coalesce(jsonb_agg(jsonb_build_object('id', at.id, 'title', at.title, 'category', at.category,
                          'expires_on', at.expires_on, 'file_name', at.file_name, 'file_type', at.file_type,
                          'storage_path', at.storage_path) order by at.created_at), '[]')
                    from task_attachments at where at.task_id = t.id and at.visible_to_passengers),
      'my_rating', (select jsonb_build_object('id', r.id, 'stars', r.stars, 'comment', r.comment, 'editable_until', r.editable_until,
                          'option_ids', (select coalesce(jsonb_agg(c.option_id), '[]') from trip_rating_choices c where c.rating_id = r.id))
                    from trip_ratings r where r.task_id = t.id and r.person_id = v_person.id),
      -- phase 2
      'live', fn_trip_is_live(t.id),
      'checkin', jsonb_build_object(
                   'code', case when t.status::text in ('scheduled','assigned','acknowledged','en_route','in_progress','delayed')
                                 and tp.checked_in_at is null then tp.checkin_code end,
                   'checked_in_at', tp.checked_in_at, 'dropped_off_at', tp.dropped_off_at),
      'share_token', (select l.token from trip_share_links l
                      where l.task_id = t.id and l.person_id = v_person.id and l.revoked_at is null and l.expires_at > now()
                      order by l.created_at desc limit 1),
      'open_sos', (select jsonb_build_object('id', e.id, 'status', e.status, 'created_at', e.created_at)
                   from sos_events e where e.task_id = t.id and e.person_id = v_person.id and e.status <> 'resolved'
                   order by e.created_at desc limit 1)
    ) as trip
    from tasks t
    join task_passengers tp on tp.task_id = t.id and tp.person_id = v_person.id
    join sites s on s.id = t.site_id
    where t.status not in ('draft')
      and t.scheduled_start > now() - interval '60 days'
  ) q;

  return jsonb_build_object('status', 'approved', 'person_id', v_person.id, 'trips', v_trips);
end $$;

-- an "active" trip: driver acknowledged → under way, and close to its time
create or replace function fn_trip_is_live(p_task_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tasks t where t.id = p_task_id
    and t.status::text in ('acknowledged','en_route','in_progress','delayed')
    and now() between t.scheduled_start - interval '2 hours'
                  and greatest(coalesce(t.scheduled_end, t.scheduled_start), coalesce(fn_task_effective_start(t.id), t.scheduled_start)) + interval '2 hours')
$$;

-- shared by the passenger view and the anonymous share link
create or replace function fn_trip_live_payload(p_task_id uuid, p_person_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t      tasks%rowtype;
  v_loc  record;
  v_tp   task_passengers%rowtype;
  v_next record;
  v_eta  timestamptz;
  v_km   double precision;
begin
  select * into t from tasks where id = p_task_id;
  select * into v_tp from task_passengers where task_id = p_task_id and person_id = p_person_id;
  select l.lat, l.lng, l.heading, l.speed_kmh, l.recorded_at into v_loc
  from task_assignments a
  join lateral (select * from driver_locations dl where dl.driver_id = a.driver_id
                order by dl.recorded_at desc limit 1) l on true
  where a.task_id = p_task_id and a.is_primary and l.recorded_at > now() - interval '30 minutes';

  -- heading to the pickup until checked in (their stop; the airport for an
  -- arrival; else the first stop), then to the last stop
  select st.seq, st.label, st.lat, st.lng, st.planned_arrival_at into v_next
  from task_stops st where st.task_id = p_task_id
  order by case
    when v_tp.checked_in_at is not null then -st.seq
    when v_tp.pickup_stop_seq is not null then abs(st.seq - v_tp.pickup_stop_seq)
    when st.airport_id is not null and exists (select 1 from flight_details f where f.task_id = p_task_id and f.direction = 'arrival') then -1000
    else st.seq end
  limit 1;

  if v_loc.lat is not null and v_next.lat is not null then
    v_km := 2 * 6371 * asin(sqrt(power(sin(radians(v_next.lat - v_loc.lat) / 2), 2)
              + cos(radians(v_loc.lat)) * cos(radians(v_next.lat)) * power(sin(radians(v_next.lng - v_loc.lng) / 2), 2)));
    -- to *this passenger's* next stop (task_assignments.eta_next_stop_at is the
    -- driver's next stop, often another one): road factor 1.3 at 40 km/h in town
    v_eta := now() + make_interval(secs => (v_km * 1.3 / 40.0) * 3600);
  end if;

  return jsonb_build_object(
    'task_id', t.id, 'status', t.status, 'live', fn_trip_is_live(t.id),
    'location', case when fn_trip_is_live(t.id) and v_loc.lat is not null then jsonb_build_object(
                  'lat', v_loc.lat, 'lng', v_loc.lng, 'heading', v_loc.heading, 'speed_kmh', v_loc.speed_kmh,
                  'recorded_at', v_loc.recorded_at) end,
    'next_stop', case when v_next.seq is not null then jsonb_build_object(
                   'seq', v_next.seq, 'label', v_next.label, 'lat', v_next.lat, 'lng', v_next.lng,
                   'planned_arrival_at', v_next.planned_arrival_at) end,
    'distance_km', case when fn_trip_is_live(t.id) then round(v_km::numeric, 1) end,
    'eta_at', case when fn_trip_is_live(t.id) then v_eta end,
    'checked_in_at', v_tp.checked_in_at);
end $$;

create or replace function rpc_passenger_live(p_task_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_person uuid := auth_person_id();
begin
  if v_person is null or not exists (
       select 1 from task_passengers tp join people p on p.id = tp.person_id
       where tp.task_id = p_task_id and tp.person_id = v_person and p.registration_status = 'approved') then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  return fn_trip_live_payload(p_task_id, v_person);
end $$;

-- ---------------------------------------------------------------------
-- 8. share link RPCs
-- ---------------------------------------------------------------------
create or replace function rpc_create_share_link(p_task_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_person uuid := auth_person_id();
  t        tasks%rowtype;
  v_token  text;
begin
  select * into t from tasks where id = p_task_id;
  if v_person is null or t.id is null or not exists (
       select 1 from task_passengers tp join people p on p.id = tp.person_id
       where tp.task_id = p_task_id and tp.person_id = v_person and p.registration_status = 'approved') then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if t.status::text in ('completed','cancelled','declined','no_show','draft') then raise exception 'share.errors.tripEnded'; end if;
  -- one live link per passenger per trip
  select token into v_token from trip_share_links
  where task_id = p_task_id and person_id = v_person and revoked_at is null and expires_at > now();
  if v_token is not null then return v_token; end if;
  insert into trip_share_links (company_id, task_id, person_id, created_by, expires_at)
  values (t.company_id, p_task_id, v_person, auth.uid(),
          greatest(coalesce(t.scheduled_end, t.scheduled_start), fn_task_effective_start(t.id)) + interval '3 hours')
  returning token into v_token;
  return v_token;
end $$;

create or replace function rpc_revoke_share_link(p_task_id uuid) returns void
language sql security definer set search_path = public as $$
  update trip_share_links set revoked_at = now()
  where task_id = p_task_id and person_id = auth_person_id() and revoked_at is null
$$;

-- anonymous: what a family member sees (no names, no phone numbers)
create or replace function rpc_shared_trip(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l trip_share_links%rowtype;
  t tasks%rowtype;
begin
  select * into l from trip_share_links where token = p_token;
  if l.id is null then return jsonb_build_object('state', 'invalid'); end if;
  select * into t from tasks where id = l.task_id;
  if l.revoked_at is not null or l.expires_at <= now() or t.status::text in ('completed','cancelled','declined','no_show') then
    return jsonb_build_object('state', 'ended');
  end if;
  return fn_trip_live_payload(l.task_id, l.person_id) || jsonb_build_object(
    'state', 'active',
    'scheduled_start', t.scheduled_start,
    'company', (select name from companies where id = t.company_id),
    'driver_first_name', (select split_part(d.full_name, ' ', 1) from task_assignments a join drivers d on d.id = a.driver_id
                          where a.task_id = t.id and a.is_primary),
    'vehicle', (select jsonb_build_object('make', v.make, 'model', v.model, 'color', v.color, 'plate_no', v.plate_no)
                from task_assignments a join vehicles v on v.id = a.vehicle_id where a.task_id = t.id and a.is_primary),
    'destination', (select label from task_stops where task_id = t.id order by seq desc limit 1));
end $$;

-- ---------------------------------------------------------------------
-- 9. check-in / drop-off (driver)
-- ---------------------------------------------------------------------
-- p_task_passenger_id (no code): only for riders without the app — visitors,
-- people without an approved login — who have no code to show
create or replace function rpc_driver_check_in(
  p_task_id uuid, p_code text, p_lat double precision default null, p_lng double precision default null,
  p_task_passenger_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t       tasks%rowtype;
  v_tp    task_passengers%rowtype;
  v_code  text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_fails int;
begin
  select * into t from tasks where id = p_task_id;
  if t.id is null or auth_driver_id() is null or not exists (
       select 1 from task_assignments where task_id = p_task_id and driver_id = auth_driver_id() and is_primary) then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  -- under way, or about to start (2 h either side of the plan)
  if not (t.status::text in ('en_route','in_progress','delayed')
          or (t.status::text in ('assigned','acknowledged')
              and now() between t.scheduled_start - interval '2 hours' and coalesce(t.scheduled_end, t.scheduled_start) + interval '2 hours')) then
    return jsonb_build_object('ok', false, 'error', 'checkin.errors.notActive');
  end if;
  select count(*) into v_fails from audit_log
  where table_name = 'task_passengers' and action = 'checkin_failed' and row_id = p_task_id::text
    and created_at > now() - interval '10 minutes';
  if v_fails >= 5 then return jsonb_build_object('ok', false, 'error', 'checkin.errors.locked'); end if;

  if p_task_passenger_id is not null then
    select tp.* into v_tp from task_passengers tp where tp.id = p_task_passenger_id and tp.task_id = p_task_id;
    if v_tp.id is null then raise exception 'errors.invalidInput'; end if;
    if exists (select 1 from people p where p.id = v_tp.person_id and p.profile_id is not null and p.registration_status = 'approved') then
      return jsonb_build_object('ok', false, 'error', 'checkin.errors.codeRequired', 'name', v_tp.name);
    end if;
  else
    select * into v_tp from task_passengers where task_id = p_task_id and checkin_code = v_code;
  end if;
  if v_tp.id is null then
    insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
    values (t.company_id, auth.uid(), 'task_passengers', p_task_id::text, 'checkin_failed', jsonb_build_object('lat', p_lat, 'lng', p_lng));
    return jsonb_build_object('ok', false, 'error', case when v_fails >= 4 then 'checkin.errors.locked' else 'checkin.errors.invalid' end);
  end if;
  if v_tp.checked_in_at is not null then
    return jsonb_build_object('ok', false, 'error', 'checkin.errors.already', 'name', v_tp.name);
  end if;

  update task_passengers set checked_in_at = now() where id = v_tp.id;
  insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
  values (t.company_id, auth.uid(), 'task_passengers', v_tp.id::text, 'checked_in',
          jsonb_build_object('task_id', p_task_id, 'person_id', v_tp.person_id, 'lat', p_lat, 'lng', p_lng,
                             'method', case when p_task_passenger_id is null then 'code' else 'no_app' end));

  -- the first pickup starts the trip
  if t.status::text in ('assigned','acknowledged') then
    perform rpc_task_transition(p_task_id, 'start', jsonb_build_object('lat', p_lat, 'lng', p_lng));
    t.status := 'en_route';
  end if;
  if t.status::text in ('en_route','delayed') then
    perform rpc_task_transition(p_task_id, 'arrive', jsonb_build_object('lat', p_lat, 'lng', p_lng));
  end if;
  return jsonb_build_object('ok', true, 'name', v_tp.name, 'pickup_order', v_tp.pickup_order,
                            'status', (select status from tasks where id = p_task_id));
end $$;

create or replace function rpc_driver_drop_off(p_task_passenger_id uuid, p_lat double precision default null, p_lng double precision default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tp   task_passengers%rowtype;
  t      tasks%rowtype;
  v_done boolean;
begin
  select * into v_tp from task_passengers where id = p_task_passenger_id;
  select * into t from tasks where id = v_tp.task_id;
  if t.id is null or auth_driver_id() is null or not exists (
       select 1 from task_assignments where task_id = t.id and driver_id = auth_driver_id() and is_primary) then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if v_tp.checked_in_at is null then raise exception 'checkin.errors.notCheckedIn'; end if;
  if v_tp.dropped_off_at is not null then return jsonb_build_object('ok', true, 'completed', false); end if;

  update task_passengers set dropped_off_at = now() where id = v_tp.id;
  insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
  values (t.company_id, auth.uid(), 'task_passengers', v_tp.id::text, 'dropped_off',
          jsonb_build_object('task_id', t.id, 'person_id', v_tp.person_id, 'lat', p_lat, 'lng', p_lng));

  -- everyone picked up and dropped off ⇒ the trip ends on its own
  v_done := not exists (select 1 from task_passengers where task_id = t.id and (checked_in_at is null or dropped_off_at is null));
  if v_done and t.status::text in ('en_route','in_progress','delayed') then
    perform rpc_task_transition(t.id, 'complete', jsonb_build_object('lat', p_lat, 'lng', p_lng));
  end if;
  return jsonb_build_object('ok', true, 'completed', v_done);
end $$;

-- ---------------------------------------------------------------------
-- 10. SOS RPCs
-- ---------------------------------------------------------------------
create or replace function rpc_passenger_sos(
  p_task_id uuid, p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null, p_message text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_person people%rowtype;
  t        tasks%rowtype;
  v_tp     task_passengers%rowtype;
  v_id     uuid;
begin
  select * into v_person from people where profile_id = auth.uid() and registration_status = 'approved';
  select * into t from tasks where id = p_task_id;
  select * into v_tp from task_passengers where task_id = p_task_id and person_id = v_person.id;
  if v_person.id is null or t.id is null or v_tp.id is null then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  -- an active trip: live window, or on board and not yet dropped off
  if not (fn_trip_is_live(p_task_id) or (v_tp.checked_in_at is not null and v_tp.dropped_off_at is null
                                          and t.status::text not in ('completed','cancelled'))) then
    raise exception 'sos.errors.notActive';
  end if;

  -- a second press while one is open just refreshes the location
  select id into v_id from sos_events where task_id = p_task_id and person_id = v_person.id and status <> 'resolved';
  if v_id is not null then
    update sos_events set lat = coalesce(p_lat, lat), lng = coalesce(p_lng, lng), accuracy_m = coalesce(p_accuracy, accuracy_m),
                          location_at = case when p_lat is not null then now() else location_at end,
                          message = coalesce(nullif(trim(p_message), ''), message)
    where id = v_id;
  else
    insert into sos_events (company_id, task_id, person_id, raised_by, lat, lng, accuracy_m, message, location_at)
    values (t.company_id, p_task_id, v_person.id, auth.uid(), p_lat, p_lng, p_accuracy, nullif(trim(p_message), ''),
            case when p_lat is not null then now() end)
    returning id into v_id;
    perform fn_notify_site_staff(t.company_id, t.site_id, 'sos_alert', t.id, v_person.full_name, nullif(trim(p_message), ''),
                                 jsonb_build_object('sos_id', v_id, 'lat', p_lat, 'lng', p_lng));
  end if;
  insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
  values (t.company_id, auth.uid(), 'sos_events', v_id::text, 'sos_raised',
          jsonb_build_object('task_id', p_task_id, 'lat', p_lat, 'lng', p_lng, 'accuracy_m', p_accuracy, 'message', p_message));

  return jsonb_build_object('id', v_id,
    'emergency_contacts', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'phone', c.phone) order by c.created_at), '[]')
                           from emergency_contacts c where c.person_id = v_person.id),
    'dispatch_phone', (select contact_phone from sites where id = t.site_id));
end $$;

create or replace function rpc_sos_update(p_sos_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e sos_events%rowtype;
begin
  select * into e from sos_events where id = p_sos_id;
  if e.id is null or e.company_id <> auth_company_id() or not auth_is_staff() or not auth_can_see_task(e.task_id) then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if p_action = 'acknowledge' and e.status = 'open' then
    update sos_events set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now() where id = p_sos_id;
  elsif p_action = 'resolve' and e.status <> 'resolved' then
    update sos_events set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(),
                          acknowledged_by = coalesce(acknowledged_by, auth.uid()), acknowledged_at = coalesce(acknowledged_at, now()),
                          resolution_note = nullif(trim(p_note), '')
    where id = p_sos_id;
  else
    raise exception 'errors.invalidInput';
  end if;
  insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
  values (e.company_id, auth.uid(), 'sos_events', p_sos_id::text, 'sos_' || p_action, jsonb_build_object('note', p_note));
end $$;

-- ---------------------------------------------------------------------
-- 11. trip request RPCs
-- ---------------------------------------------------------------------
create or replace function rpc_passenger_request(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_person people%rowtype;
  v_kind   text := p->>'kind';
  v_task   uuid := nullif(p->>'task_id', '')::uuid;
  v_start  timestamptz := nullif(p->>'requested_start', '')::timestamptz;
  t        tasks%rowtype;
  v_id     uuid;
begin
  select * into v_person from people where profile_id = auth.uid() and registration_status = 'approved';
  if v_person.id is null then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  if v_kind is null or v_kind not in ('new','reschedule','cancel') then raise exception 'errors.invalidInput'; end if;
  if char_length(coalesce(p->>'notes', '')) > 1000 then raise exception 'requests.errors.notesLong'; end if;

  if v_kind in ('reschedule','cancel') then
    select t2.* into t from tasks t2 join task_passengers tp on tp.task_id = t2.id and tp.person_id = v_person.id
    where t2.id = v_task;
    if t.id is null then raise exception 'errors.forbidden' using errcode = '42501'; end if;
    if t.status::text not in ('scheduled','assigned','acknowledged','declined','draft') or t.scheduled_start <= now() then
      raise exception 'requests.errors.tooLate';
    end if;
    if exists (select 1 from trip_requests where task_id = v_task and person_id = v_person.id and status = 'pending') then
      raise exception 'requests.errors.duplicate';
    end if;
  end if;
  if v_kind in ('new','reschedule') and (v_start is null or v_start <= now()) then
    raise exception 'requests.errors.startFuture';
  end if;
  if v_kind = 'new' and (nullif(trim(p->>'pickup'), '') is null or nullif(trim(p->>'dropoff'), '') is null) then
    raise exception 'requests.errors.places';
  end if;

  insert into trip_requests (company_id, person_id, requested_by, kind, task_id, site_id, requested_start,
                             pickup, dropoff, passengers_count, notes)
  values (v_person.company_id, v_person.id, auth.uid(), v_kind, case when v_kind <> 'new' then v_task end,
          coalesce(t.site_id, v_person.site_id), v_start,
          nullif(trim(p->>'pickup'), ''), nullif(trim(p->>'dropoff'), ''),
          greatest(1, least(20, coalesce((p->>'passengers_count')::int, 1))), nullif(trim(p->>'notes'), ''))
  returning id into v_id;

  perform fn_notify_site_staff(v_person.company_id, coalesce(t.site_id, v_person.site_id), 'trip_request',
                               case when v_kind = 'new' then null else v_task end, v_person.full_name, nullif(trim(p->>'notes'), ''),
                               jsonb_build_object('request_id', v_id, 'kind', v_kind));
  return v_id;
end $$;

create or replace function rpc_withdraw_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update trip_requests set status = 'withdrawn'
  where id = p_request_id and person_id = auth_person_id() and status = 'pending';
  if not found then raise exception 'errors.invalidInput'; end if;
end $$;

create or replace function rpc_decide_request(
  p_request_id uuid, p_approve boolean, p_note text default null,
  p_created_task_id uuid default null, p_override_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r       trip_requests%rowtype;
  t       tasks%rowtype;
  v_count int;
begin
  select * into r from trip_requests where id = p_request_id for update;
  if r.id is null or r.company_id <> auth_company_id() or not auth_is_staff()
     or (r.site_id is not null and not auth_can_access_site(r.site_id)) then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if r.status <> 'pending' then raise exception 'requests.errors.decided'; end if;
  if not p_approve and nullif(trim(p_note), '') is null then raise exception 'requests.errors.reasonRequired'; end if;

  if p_approve then
    if r.kind = 'reschedule' then
      perform rpc_reschedule_task(r.task_id, r.requested_start, null, false, p_override_reason);
    elsif r.kind = 'cancel' then
      select * into t from tasks where id = r.task_id;
      select count(*) into v_count from task_passengers where task_id = r.task_id;
      if v_count <= 1 then
        perform rpc_task_transition(r.task_id, 'cancel', jsonb_build_object('reason', coalesce(nullif(trim(p_note), ''), 'Passenger request')));
      else
        update tasks set passengers = (select coalesce(jsonb_agg(x.v order by x.ord), '[]')
                                       from jsonb_array_elements(passengers) with ordinality x(v, ord)
                                       where nullif(x.v->>'person_id', '') is distinct from r.person_id::text)
        where id = r.task_id;
      end if;
    elsif p_created_task_id is not null and not exists (
            select 1 from tasks where id = p_created_task_id and company_id = r.company_id) then
      raise exception 'errors.invalidInput';
    end if;
  end if;

  update trip_requests set status = case when p_approve then 'approved' else 'rejected' end,
                           decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), ''),
                           created_task_id = case when r.kind = 'new' then p_created_task_id end
  where id = p_request_id;

  insert into notifications (company_id, user_id, type, task_id, title, body, data, channels)
  select r.company_id, p.profile_id, 'trip_request_decided', coalesce(p_created_task_id, r.task_id), p.full_name, nullif(trim(p_note), ''),
         jsonb_build_object('request_id', r.id, 'kind', r.kind, 'approved', p_approve, 'audience', 'passenger'), '{in_app,push}'
  from people p where p.id = r.person_id and p.profile_id is not null;
  insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
  values (r.company_id, auth.uid(), 'trip_requests', r.id::text, case when p_approve then 'approved' else 'rejected' end,
          jsonb_build_object('kind', r.kind, 'note', p_note, 'created_task_id', p_created_task_id));
end $$;

-- ---------------------------------------------------------------------
-- 12. triggers + grants
-- ---------------------------------------------------------------------
create trigger trg_tasks_status_passengers after update of status on tasks
  for each row execute function trg_task_status_passengers();

alter publication supabase_realtime add table sos_events, trip_requests;

grant select on trip_share_links, sos_events, trip_requests to authenticated;
grant execute on function rpc_passenger_live(uuid), rpc_create_share_link(uuid), rpc_revoke_share_link(uuid),
  rpc_driver_check_in(uuid, text, double precision, double precision, uuid), rpc_driver_drop_off(uuid, double precision, double precision),
  rpc_passenger_sos(uuid, double precision, double precision, double precision, text), rpc_sos_update(uuid, text, text),
  rpc_passenger_request(jsonb), rpc_withdraw_request(uuid), rpc_decide_request(uuid, boolean, text, uuid, text),
  fn_trip_is_live(uuid) to authenticated;
grant execute on function rpc_shared_trip(text) to anon, authenticated;
revoke execute on function fn_notify_passengers(uuid, text, text, jsonb, uuid), fn_notify_site_staff(uuid, uuid, text, uuid, text, text, jsonb),
  fn_trip_live_payload(uuid, uuid), fn_new_checkin_code(uuid) from public, anon, authenticated;
