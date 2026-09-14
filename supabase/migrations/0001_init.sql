-- =====================================================================
--  MASAR — Driver & Trip Management
--  Migration 0001: full initial schema for Supabase (Postgres 15+)
--  Run with:  supabase db reset   (local)  |  supabase db push (remote)
--  Portable: no PostGIS required (lat/lng doubles + haversine function).
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
-- pg_cron / pg_net are enabled from the Supabase dashboard (Database → Extensions)

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type app_role        as enum ('owner','admin','dispatcher','driver','viewer');
create type app_language    as enum ('en','ar');
create type site_type       as enum ('construction_site','office','warehouse','other');
create type task_category   as enum ('daily_routine','airport','document_delivery','escort');
create type task_status     as enum ('draft','scheduled','assigned','acknowledged','en_route',
                                     'in_progress','delayed','completed','cancelled','declined','no_show');
create type task_priority   as enum ('low','normal','high','urgent');
create type flight_direction as enum ('arrival','departure');
create type delay_reason    as enum ('flight_delayed','traffic','passenger_late','vehicle_issue','weather','other');
create type conflict_type   as enum ('driver_overlap','driver_multi_location_same_day','vehicle_overlap',
                                     'driver_over_hours','outside_working_hours','driver_unavailable');
create type conflict_severity as enum ('info','warning','blocking');
create type task_event_type as enum ('created','updated','assigned','unassigned','acknowledged','declined',
                                     'reminder_sent','started','arrived','delayed','resumed','completed',
                                     'cancelled','no_show','conflict_overridden','note_added','attachment_added',
                                     'location_snapshot');
create type notification_type as enum ('task_assigned','task_reminder','task_start_prompt','task_complete_prompt',
                                       'task_updated','task_cancelled','driver_not_acknowledged','task_not_started',
                                       'task_delayed','task_completed','driver_no_show','driver_offline',
                                       'airport_share_hint','conflict_detected','system');
create type notification_channel as enum ('in_app','push','email');
create type availability_type as enum ('leave','sick','off_day','training','other');
create type task_link_relation as enum ('shared_ride','follow_up','return_trip','duplicate_of');
create type driver_status    as enum ('offline','idle','en_route','in_progress','delayed');

-- ---------------------------------------------------------------------
-- 2. UTILITY FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function fn_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Haversine distance in km
create or replace function fn_distance_km(lat1 double precision, lng1 double precision,
                                          lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371.0 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ---------------------------------------------------------------------
-- 3. CORE TENANCY
-- ---------------------------------------------------------------------
create table companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  name_ar          text,
  country_code     char(2) not null default 'SA',
  timezone         text not null default 'Asia/Riyadh',
  default_language app_language not null default 'en',
  logo_url         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table company_settings (
  company_id               uuid primary key references companies(id) on delete cascade,
  reminder_offsets_min     int[]  not null default '{1440,120,30}',   -- 24h, 2h, 30m
  start_prompt_after_min   int    not null default 5,
  complete_prompt_after_min int   not null default 10,
  ack_deadline_min         int    not null default 120,   -- must acknowledge N min before start
  grace_min                int    not null default 15,    -- dispatcher alert if not started
  no_show_after_min        int    not null default 60,
  far_location_km          numeric(6,1) not null default 50,   -- multi-location warning threshold
  airport_share_window_min int    not null default 90,
  standard_day_min         int    not null default 480,   -- 8h
  weekly_max_min           int    not null default 2880,  -- 48h
  max_daily_driving_min    int    not null default 600,   -- 10h
  weekend_days             int[]  not null default '{5,6}', -- 0=Sun … 5=Fri,6=Sat
  offline_alert_after_min  int    not null default 10,
  location_interval_sec    int    not null default 30,
  eastern_arabic_digits    boolean not null default false,
  flight_api_enabled       boolean not null default false,
  updated_at               timestamptz not null default now()
);

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  company_id   uuid references companies(id) on delete cascade,
  role         app_role not null default 'viewer',
  full_name    text not null,
  full_name_ar text,
  email        text,
  phone        text,
  language     app_language not null default 'en',
  avatar_url   text,
  is_active    boolean not null default true,
  notif_in_app boolean not null default true,
  notif_push   boolean not null default true,
  notif_email  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index profiles_company_idx on profiles(company_id);

create table sites (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  code            text,
  name            text not null,
  name_ar         text,
  type            site_type not null default 'construction_site',
  address         text,
  address_ar      text,
  city            text,
  lat             double precision,
  lng             double precision,
  google_place_id text,
  contact_name    text,
  contact_phone   text,
  work_start      time default '07:00',
  work_end        time default '17:00',
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, code)
);
create index sites_company_idx on sites(company_id);

-- which sites a (non-driver) user may operate on
create table user_sites (
  user_id  uuid not null references profiles(id) on delete cascade,
  site_id  uuid not null references sites(id) on delete cascade,
  primary key (user_id, site_id)
);

-- ---------------------------------------------------------------------
-- 4. AIRPORTS
-- ---------------------------------------------------------------------
create table airports (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  iata          text,
  icao          text,
  name          text not null,
  name_ar       text,
  city          text,
  city_ar       text,
  country_code  char(2),
  lat           double precision not null,
  lng           double precision not null,
  google_place_id text,
  is_international boolean default true,
  terminals     text[] default '{}',
  source        text default 'ai',           -- ai | manual | google
  created_at    timestamptz not null default now(),
  unique (company_id, iata)
);

create table site_airports (
  site_id            uuid not null references sites(id) on delete cascade,
  airport_id         uuid not null references airports(id) on delete cascade,
  is_default         boolean not null default false,
  distance_km        numeric(7,1),
  drive_minutes      int,
  default_buffer_min int not null default 30,
  created_at         timestamptz not null default now(),
  primary key (site_id, airport_id)
);

-- ---------------------------------------------------------------------
-- 5. DRIVERS & VEHICLES
-- ---------------------------------------------------------------------
create table drivers (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  profile_id            uuid unique references profiles(id) on delete set null,
  home_site_id          uuid references sites(id) on delete set null,
  employee_no           text,
  full_name             text not null,
  full_name_ar          text,
  phone                 text,
  licence_no            text,
  licence_expiry        date,
  photo_url             text,
  max_daily_driving_min int,                 -- null → company default
  shift_start           time default '07:00',
  shift_end             time default '17:00',
  current_status        driver_status not null default 'offline',
  last_seen_at          timestamptz,
  is_active             boolean not null default true,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, employee_no)
);
create index drivers_company_idx on drivers(company_id);
create index drivers_home_site_idx on drivers(home_site_id);

create table vehicles (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  site_id      uuid references sites(id) on delete set null,
  plate_no     text not null,
  make         text,
  model        text,
  year         int,
  color        text,
  seats        int default 4,
  odometer_km  int default 0,
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, plate_no)
);

create table driver_availability (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references drivers(id) on delete cascade,
  type       availability_type not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index driver_availability_idx on driver_availability(driver_id, starts_at, ends_at);

-- High-volume, pruned to 90 days by pg_cron
create table driver_locations (
  id           bigint generated always as identity primary key,
  driver_id    uuid not null references drivers(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  task_id      uuid,                       -- soft ref (task may be deleted)
  lat          double precision not null,
  lng          double precision not null,
  accuracy_m   real,
  speed_kmh    real,
  heading      real,
  battery_pct  smallint,
  recorded_at  timestamptz not null default now()
);
create index driver_locations_driver_time_idx on driver_locations(driver_id, recorded_at desc);
create index driver_locations_company_time_idx on driver_locations(company_id, recorded_at desc);

-- ---------------------------------------------------------------------
-- 6. TASKS
-- ---------------------------------------------------------------------
create table recurrence_rules (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  rrule        text not null,                -- RFC 5545, e.g. FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH
  starts_on    date not null,
  ends_on      date,
  generated_until date,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table tasks (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references companies(id) on delete cascade,
  site_id                uuid not null references sites(id),           -- requesting site
  category               task_category not null,
  status                 task_status not null default 'scheduled',
  priority               task_priority not null default 'normal',
  title                  text not null,
  description            text,
  scheduled_start        timestamptz not null,
  scheduled_end          timestamptz,                                   -- computed if null
  estimated_duration_min int,
  estimated_distance_km  numeric(8,1),
  actual_start_at        timestamptz,
  actual_end_at          timestamptz,
  actual_distance_km     numeric(8,1),
  odometer_start_km      int,
  odometer_end_km        int,
  passengers             jsonb not null default '[]',   -- [{name, phone, note}]
  requested_by           uuid references profiles(id),
  created_by             uuid references profiles(id),
  recurrence_rule_id     uuid references recurrence_rules(id) on delete set null,
  recurrence_date        date,                                          -- instance date when generated
  remind_offsets_min     int[],                                          -- null → company default
  cancel_reason          text,
  completion_notes       text,
  conflicts_overridden   boolean not null default false,
  override_reason        text,
  override_by            uuid references profiles(id),
  metadata               jsonb not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (scheduled_end is null or scheduled_end > scheduled_start),
  check (actual_end_at is null or actual_start_at is null or actual_end_at >= actual_start_at)
);
create index tasks_company_start_idx on tasks(company_id, scheduled_start);
create index tasks_site_start_idx    on tasks(site_id, scheduled_start);
create index tasks_status_idx        on tasks(company_id, status);
create index tasks_recurrence_idx    on tasks(recurrence_rule_id, recurrence_date);

-- ordered stops (first stop = origin)
create table task_stops (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references tasks(id) on delete cascade,
  seq               int  not null,
  label             text,
  address           text,
  lat               double precision,
  lng               double precision,
  google_place_id   text,
  site_id           uuid references sites(id) on delete set null,
  airport_id        uuid references airports(id) on delete set null,
  planned_arrival_at timestamptz,
  dwell_min         int not null default 0,
  leg_distance_km   numeric(8,1),     -- from previous stop
  leg_duration_min  int,
  actual_arrival_at timestamptz,
  actual_departure_at timestamptz,
  contact_name      text,
  contact_phone     text,
  notes             text,
  unique (task_id, seq)
);

create table task_assignments (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references tasks(id) on delete cascade,
  driver_id         uuid not null references drivers(id),
  vehicle_id        uuid references vehicles(id) on delete set null,
  is_primary        boolean not null default true,
  assigned_by       uuid references profiles(id),
  assigned_at       timestamptz not null default now(),
  acknowledged_at   timestamptz,
  declined_at       timestamptz,
  decline_reason    text,
  eta_next_stop_at  timestamptz,
  eta_updated_at    timestamptz,
  unique (task_id, driver_id)
);
create index task_assignments_driver_idx on task_assignments(driver_id);
create unique index task_assignments_one_primary on task_assignments(task_id) where is_primary;

create table flight_details (
  task_id            uuid primary key references tasks(id) on delete cascade,
  airport_id         uuid references airports(id),
  direction          flight_direction not null,
  airline            text,
  flight_no          text,
  terminal           text,
  scheduled_time     timestamptz not null,   -- STA / STD
  estimated_time     timestamptz,            -- after delays
  actual_time        timestamptz,
  buffer_min         int not null default 30,
  flight_status      text,                   -- from provider: scheduled|active|landed|delayed|cancelled
  provider_payload   jsonb,
  updated_at         timestamptz not null default now()
);

create table task_delays (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references tasks(id) on delete cascade,
  reported_by      uuid references profiles(id),
  reason           delay_reason not null,
  delay_min        int,
  note             text,
  previous_status  task_status not null,
  new_estimated_start timestamptz,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index task_delays_task_idx on task_delays(task_id);

create table task_events (
  id           uuid primary key default gen_random_uuid(),   -- client-generated for idempotent offline replay
  task_id      uuid not null references tasks(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  type         task_event_type not null,
  actor_id     uuid references profiles(id),
  from_status  task_status,
  to_status    task_status,
  lat          double precision,
  lng          double precision,
  payload      jsonb not null default '{}',
  client_ts    timestamptz,                                    -- when the action happened on the device
  created_at   timestamptz not null default now()
);
create index task_events_task_idx on task_events(task_id, created_at);

create table task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  storage_path text not null,                -- bucket: task-attachments
  kind         text not null default 'photo', -- photo | signature | document
  caption      text,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create table task_links (
  task_id         uuid not null references tasks(id) on delete cascade,
  related_task_id uuid not null references tasks(id) on delete cascade,
  relation        task_link_relation not null,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  primary key (task_id, related_task_id, relation),
  check (task_id <> related_task_id)
);

create table task_conflicts (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references tasks(id) on delete cascade,
  other_task_id    uuid references tasks(id) on delete cascade,
  driver_id        uuid references drivers(id) on delete cascade,
  vehicle_id       uuid references vehicles(id) on delete cascade,
  type             conflict_type not null,
  severity         conflict_severity not null default 'warning',
  details          jsonb not null default '{}',
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index task_conflicts_task_idx on task_conflicts(task_id) where resolved_at is null;

-- ---------------------------------------------------------------------
-- 7. NOTIFICATIONS
-- ---------------------------------------------------------------------
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  type          notification_type not null,
  task_id       uuid references tasks(id) on delete cascade,
  title         text not null,
  body          text,
  data          jsonb not null default '{}',
  actions       jsonb not null default '[]',   -- [{id:'ack', label:'Acknowledge'}]
  channels      notification_channel[] not null default '{in_app}',
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  read_at       timestamptz,
  acted_at      timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);
create index notifications_pending_idx on notifications(scheduled_for) where sent_at is null;

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  platform    text,                 -- web | tauri-desktop | android | ios
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

-- ---------------------------------------------------------------------
-- 8. HOURS / OVERTIME
-- ---------------------------------------------------------------------
create table holidays (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  date        date not null,
  name        text not null,
  name_ar     text,
  unique (company_id, date)
);

create table driver_day_summary (
  driver_id           uuid not null references drivers(id) on delete cascade,
  company_id          uuid not null references companies(id) on delete cascade,
  date                date not null,
  first_start_at      timestamptz,
  last_end_at         timestamptz,
  tasks_count         int not null default 0,
  tasks_by_category   jsonb not null default '{}',
  driving_min         int not null default 0,      -- sum of task actual durations
  working_min         int not null default 0,      -- last_end - first_start
  overtime_min        int not null default 0,
  distance_km         numeric(8,1) not null default 0,
  is_weekend          boolean not null default false,
  is_holiday          boolean not null default false,
  computed_at         timestamptz not null default now(),
  primary key (driver_id, date)
);
create index driver_day_summary_company_date_idx on driver_day_summary(company_id, date);

create table audit_log (
  id          bigint generated always as identity primary key,
  company_id  uuid,
  actor_id    uuid,
  table_name  text not null,
  row_id      text,
  action      text not null,      -- insert | update | delete
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_company_idx on audit_log(company_id, created_at desc);

-- ---------------------------------------------------------------------
-- 9. updated_at TRIGGERS
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['companies','company_settings','profiles','sites','drivers','vehicles','tasks','flight_details']
  loop
    execute format('create trigger trg_%s_updated_at before update on %I for each row execute function fn_set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 10. AUTH HELPERS (security definer, used by RLS)
-- ---------------------------------------------------------------------
create or replace function auth_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_driver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from drivers where profile_id = auth.uid()
$$;

create or replace function auth_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','admin','dispatcher') from profiles where id = auth.uid()), false)
$$;

create or replace function auth_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner','admin') from profiles where id = auth.uid()), false)
$$;

-- dispatcher may act on a site if admin, or listed in user_sites (empty list ⇒ all sites)
create or replace function auth_can_access_site(p_site uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_is_admin()
      or not exists (select 1 from user_sites where user_id = auth.uid())
      or exists (select 1 from user_sites where user_id = auth.uid() and site_id = p_site)
$$;

-- create profile row on signup (company assigned later by owner/invite)
create or replace function fn_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, language)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          new.email,
          coalesce((new.raw_user_meta_data->>'language')::app_language, 'en'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function fn_handle_new_user();

-- ---------------------------------------------------------------------
-- 11. BUSINESS FUNCTIONS
-- ---------------------------------------------------------------------

-- Effective start for reminders: delayed estimate if any, else scheduled
create or replace function fn_task_effective_start(p_task uuid) returns timestamptz
language sql stable as $$
  select coalesce(
    (select new_estimated_start from task_delays where task_id = p_task and resolved_at is null
       order by created_at desc limit 1),
    (select scheduled_start from tasks where id = p_task))
$$;

-- Effective end: scheduled_end or start + estimated duration (default 60 min)
create or replace function fn_task_effective_end(p_task uuid) returns timestamptz
language sql stable as $$
  select coalesce(t.scheduled_end,
                  fn_task_effective_start(p_task) + make_interval(mins => coalesce(t.estimated_duration_min, 60)))
  from tasks t where t.id = p_task
$$;

-- Conflict check: returns rows describing every conflict for a proposed assignment.
-- p_task may be an existing task (excluded from overlap with itself).
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
  v_company     uuid;
  v_start       timestamptz;
  v_end         timestamptz;
  v_settings    company_settings%rowtype;
  v_driver      drivers%rowtype;
  v_day_start   timestamptz;
  v_day_end     timestamptz;
  v_first_lat   double precision;
  v_first_lng   double precision;
  v_planned_min int;
  v_max_min     int;
  r             record;
begin
  select company_id, coalesce(p_start, scheduled_start), coalesce(p_end, fn_task_effective_end(id))
    into v_company, v_start, v_end from tasks where id = p_task_id;
  if v_company is null then
    raise exception 'task % not found', p_task_id;
  end if;
  select * into v_settings from company_settings where company_id = v_company;
  select * into v_driver   from drivers where id = p_driver_id;

  -- 1. driver overlap (± 15 min travel padding)
  for r in
    select t.id, t.title, t.scheduled_start, fn_task_effective_end(t.id) as eff_end, s.name as site_name
    from task_assignments a
    join tasks t on t.id = a.task_id
    join sites s on s.id = t.site_id
    where a.driver_id = p_driver_id
      and t.id <> p_task_id
      and t.status not in ('cancelled','completed','declined','no_show','draft')
      and tstzrange(t.scheduled_start - interval '15 min', fn_task_effective_end(t.id) + interval '15 min')
          && tstzrange(v_start, v_end)
  loop
    type := 'driver_overlap'; severity := 'blocking'; other_task_id := r.id;
    details := jsonb_build_object('title', r.title, 'site', r.site_name,
                                  'start', r.scheduled_start, 'end', r.eff_end);
    return next;
  end loop;

  -- 2. multi-location same day (first stops far apart)
  v_day_start := date_trunc('day', v_start at time zone 'UTC');
  v_day_end   := v_day_start + interval '1 day';
  select lat, lng into v_first_lat, v_first_lng from task_stops where task_id = p_task_id order by seq limit 1;
  if v_first_lat is not null then
    for r in
      select t.id, t.title, st.lat, st.lng, s.name as site_name
      from task_assignments a
      join tasks t on t.id = a.task_id
      join sites s on s.id = t.site_id
      join lateral (select lat, lng from task_stops where task_id = t.id order by seq limit 1) st on true
      where a.driver_id = p_driver_id and t.id <> p_task_id
        and t.status not in ('cancelled','completed','declined','no_show','draft')
        and t.scheduled_start >= v_day_start and t.scheduled_start < v_day_end
        and st.lat is not null
        and fn_distance_km(v_first_lat, v_first_lng, st.lat, st.lng) > v_settings.far_location_km
    loop
      type := 'driver_multi_location_same_day'; severity := 'warning'; other_task_id := r.id;
      details := jsonb_build_object('title', r.title, 'site', r.site_name,
                 'distance_km', round(fn_distance_km(v_first_lat, v_first_lng, r.lat, r.lng)::numeric, 1));
      return next;
    end loop;
  end if;

  -- 3. vehicle overlap
  if p_vehicle_id is not null then
    for r in
      select t.id, t.title from task_assignments a join tasks t on t.id = a.task_id
      where a.vehicle_id = p_vehicle_id and t.id <> p_task_id
        and t.status not in ('cancelled','completed','declined','no_show','draft')
        and tstzrange(t.scheduled_start, fn_task_effective_end(t.id)) && tstzrange(v_start, v_end)
    loop
      type := 'vehicle_overlap'; severity := 'warning'; other_task_id := r.id;
      details := jsonb_build_object('title', r.title);
      return next;
    end loop;
  end if;

  -- 4. driver over hours for the day
  select coalesce(sum(extract(epoch from (fn_task_effective_end(t.id) - t.scheduled_start)) / 60), 0)::int
    into v_planned_min
  from task_assignments a join tasks t on t.id = a.task_id
  where a.driver_id = p_driver_id and t.id <> p_task_id
    and t.status not in ('cancelled','declined','no_show','draft')
    and t.scheduled_start >= v_day_start and t.scheduled_start < v_day_end;
  v_planned_min := v_planned_min + (extract(epoch from (v_end - v_start)) / 60)::int;
  v_max_min := coalesce(v_driver.max_daily_driving_min, v_settings.max_daily_driving_min);
  if v_planned_min > v_max_min then
    type := 'driver_over_hours'; severity := 'warning'; other_task_id := null;
    details := jsonb_build_object('planned_min', v_planned_min, 'max_min', v_max_min);
    return next;
  end if;

  -- 5. outside working hours (shift, in company timezone)
  if v_driver.shift_start is not null and v_driver.shift_end is not null then
    if (v_start at time zone (select timezone from companies where id = v_company))::time < v_driver.shift_start
       or (v_end at time zone (select timezone from companies where id = v_company))::time > v_driver.shift_end then
      type := 'outside_working_hours'; severity := 'info'; other_task_id := null;
      details := jsonb_build_object('shift_start', v_driver.shift_start, 'shift_end', v_driver.shift_end);
      return next;
    end if;
  end if;

  -- 6. driver unavailable
  for r in
    select da.id, da.type as atype, da.starts_at, da.ends_at from driver_availability da
    where da.driver_id = p_driver_id and tstzrange(da.starts_at, da.ends_at) && tstzrange(v_start, v_end)
  loop
    type := 'driver_unavailable'; severity := 'blocking'; other_task_id := null;
    details := jsonb_build_object('availability', r.atype, 'from', r.starts_at, 'to', r.ends_at);
    return next;
  end loop;
  return;
end $$;

-- Persist conflicts for a task (called after assignment insert/update)
create or replace function fn_refresh_task_conflicts(p_task_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  update task_conflicts set resolved_at = now() where task_id = p_task_id and resolved_at is null;
  for a in select driver_id, vehicle_id from task_assignments where task_id = p_task_id loop
    insert into task_conflicts (task_id, other_task_id, driver_id, vehicle_id, type, severity, details)
    select p_task_id, c.other_task_id, a.driver_id, a.vehicle_id, c.type, c.severity, c.details
    from fn_check_task_conflicts(p_task_id, a.driver_id, a.vehicle_id) c;
  end loop;
end $$;

create or replace function trg_task_assignment_conflicts() returns trigger
language plpgsql as $$
begin
  perform fn_refresh_task_conflicts(coalesce(new.task_id, old.task_id));
  return coalesce(new, old);
end $$;
create trigger trg_assignments_conflicts after insert or update or delete on task_assignments
  for each row execute function trg_task_assignment_conflicts();

create or replace function trg_task_time_conflicts() returns trigger
language plpgsql as $$
begin
  if new.scheduled_start is distinct from old.scheduled_start
     or new.scheduled_end is distinct from old.scheduled_end
     or new.estimated_duration_min is distinct from old.estimated_duration_min then
    perform fn_refresh_task_conflicts(new.id);
  end if;
  return new;
end $$;
create trigger trg_tasks_time_conflicts after update on tasks
  for each row execute function trg_task_time_conflicts();

-- Similar airport trips across sites (cross-site sharing hint)
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
    and abs(extract(epoch from (f.scheduled_time - p_time)) / 60)
        <= (select airport_share_window_min from company_settings where company_id = auth_company_id())
  order by minutes_apart
$$;

-- Driver status transitions (single entry point, validates state machine)
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

  -- keep driver live status in sync
  if v_driver is not null then
    update drivers set current_status = case v_to
        when 'en_route' then 'en_route'::driver_status
        when 'in_progress' then 'in_progress'
        when 'delayed' then 'delayed'
        else 'idle' end,
      last_seen_at = now()
    where id = v_driver;
  end if;

  -- refresh day summary on completion
  if v_to = 'completed' then
    perform fn_refresh_driver_day_summary(a.driver_id, (t.scheduled_start at time zone
             (select timezone from companies where id = t.company_id))::date)
    from task_assignments a where a.task_id = p_task_id;
  end if;
  return t;
end $$;

-- Driver location reporting
create or replace function rpc_report_location(
  p_lat double precision, p_lng double precision,
  p_accuracy double precision default null, p_speed_kmh double precision default null, p_heading double precision default null,
  p_battery int default null, p_task_id uuid default null, p_recorded_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = public as $$
declare v_driver uuid := auth_driver_id();
begin
  if v_driver is null then raise exception 'not a driver'; end if;
  insert into driver_locations (driver_id, company_id, task_id, lat, lng, accuracy_m, speed_kmh, heading, battery_pct, recorded_at)
  values (v_driver, auth_company_id(), p_task_id, p_lat, p_lng, p_accuracy, p_speed_kmh, p_heading, p_battery, p_recorded_at);
  update drivers set last_seen_at = now(),
                     current_status = case when current_status = 'offline' then 'idle' else current_status end
   where id = v_driver;
end $$;

-- Latest location per driver (for the live map)
create or replace view v_driver_latest_location as
select distinct on (l.driver_id)
  l.driver_id, d.company_id, d.full_name, d.full_name_ar, d.current_status, d.last_seen_at, d.home_site_id,
  l.lat, l.lng, l.speed_kmh, l.heading, l.battery_pct, l.recorded_at, l.task_id
from driver_locations l
join drivers d on d.id = l.driver_id
order by l.driver_id, l.recorded_at desc;

-- Day summary recomputation
create or replace function fn_refresh_driver_day_summary(p_driver uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_tz text; v_settings company_settings%rowtype;
  v_first timestamptz; v_last timestamptz; v_driving int; v_working int; v_km numeric; v_count int; v_bycat jsonb;
  v_weekend boolean; v_holiday boolean; v_overtime int;
begin
  select company_id into v_company from drivers where id = p_driver;
  select timezone into v_tz from companies where id = v_company;
  select * into v_settings from company_settings where company_id = v_company;

  select min(t.actual_start_at), max(t.actual_end_at),
         coalesce(sum(extract(epoch from (t.actual_end_at - t.actual_start_at)) / 60), 0)::int,
         coalesce(sum(t.actual_distance_km), 0), count(*),
         coalesce(jsonb_object_agg(t.category, c.n), '{}')
    into v_first, v_last, v_driving, v_km, v_count, v_bycat
  from tasks t
  join task_assignments a on a.task_id = t.id and a.driver_id = p_driver
  join lateral (select count(*) n from tasks t2 join task_assignments a2 on a2.task_id = t2.id
                where a2.driver_id = p_driver and t2.category = t.category and t2.status = 'completed'
                  and (t2.scheduled_start at time zone v_tz)::date = p_date) c on true
  where t.status = 'completed' and (t.scheduled_start at time zone v_tz)::date = p_date;

  v_working := coalesce(extract(epoch from (v_last - v_first)) / 60, 0)::int;
  v_weekend := extract(dow from p_date)::int = any (v_settings.weekend_days);
  v_holiday := exists (select 1 from holidays where company_id = v_company and date = p_date);
  v_overtime := case when v_weekend or v_holiday then v_working
                     else greatest(v_working - v_settings.standard_day_min, 0) end;

  insert into driver_day_summary (driver_id, company_id, date, first_start_at, last_end_at, tasks_count,
          tasks_by_category, driving_min, working_min, overtime_min, distance_km, is_weekend, is_holiday, computed_at)
  values (p_driver, v_company, p_date, v_first, v_last, v_count, v_bycat, v_driving, v_working, v_overtime, v_km,
          v_weekend, v_holiday, now())
  on conflict (driver_id, date) do update set
    first_start_at = excluded.first_start_at, last_end_at = excluded.last_end_at, tasks_count = excluded.tasks_count,
    tasks_by_category = excluded.tasks_by_category, driving_min = excluded.driving_min, working_min = excluded.working_min,
    overtime_min = excluded.overtime_min, distance_km = excluded.distance_km, is_weekend = excluded.is_weekend,
    is_holiday = excluded.is_holiday, computed_at = now();
end $$;

-- Reminder planning: called by pg_cron every minute (via Edge Function notify-scheduler or directly)
create or replace function fn_plan_due_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; r record; off int; v_start timestamptz;
begin
  for r in
    select t.id, t.company_id, t.title, a.driver_id, d.profile_id,
           coalesce(t.remind_offsets_min, cs.reminder_offsets_min) as offsets
    from tasks t
    join task_assignments a on a.task_id = t.id and a.is_primary
    join drivers d on d.id = a.driver_id
    join company_settings cs on cs.company_id = t.company_id
    where t.status in ('assigned','acknowledged','delayed')
      and d.profile_id is not null
      and t.scheduled_start between now() - interval '1 hour' and now() + interval '25 hours'
  loop
    v_start := fn_task_effective_start(r.id);
    foreach off in array r.offsets loop
      if v_start - make_interval(mins => off) <= now()
         and not exists (select 1 from notifications n where n.task_id = r.id and n.user_id = r.profile_id
                           and n.type = 'task_reminder' and (n.data->>'offset_min')::int = off) then
        insert into notifications (company_id, user_id, type, task_id, title, body, data, channels, actions)
        values (r.company_id, r.profile_id, 'task_reminder', r.id, r.title, null,
                jsonb_build_object('offset_min', off, 'starts_at', v_start), '{in_app,push}',
                '[{"id":"open","label":"Open"}]');
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;
  return v_count;
end $$;

-- Auto no-show + start/complete prompts (pg_cron every minute)
create or replace function fn_task_watchdog() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- "Did you start?" prompt
  insert into notifications (company_id, user_id, type, task_id, title, data, channels, actions)
  select t.company_id, d.profile_id, 'task_start_prompt', t.id, t.title,
         jsonb_build_object('prompt','start'), '{in_app,push}',
         '[{"id":"start","label":"Yes, started"},{"id":"delay","label":"Delayed"}]'
  from tasks t join task_assignments a on a.task_id = t.id and a.is_primary
  join drivers d on d.id = a.driver_id join company_settings cs on cs.company_id = t.company_id
  where t.status in ('assigned','acknowledged') and d.profile_id is not null
    and now() >= fn_task_effective_start(t.id) + make_interval(mins => cs.start_prompt_after_min)
    and not exists (select 1 from notifications n where n.task_id = t.id and n.type = 'task_start_prompt');

  -- "Did you finish?" prompt
  insert into notifications (company_id, user_id, type, task_id, title, data, channels, actions)
  select t.company_id, d.profile_id, 'task_complete_prompt', t.id, t.title,
         jsonb_build_object('prompt','complete'), '{in_app,push}',
         '[{"id":"complete","label":"Yes, completed"},{"id":"delay","label":"Still going"}]'
  from tasks t join task_assignments a on a.task_id = t.id and a.is_primary
  join drivers d on d.id = a.driver_id join company_settings cs on cs.company_id = t.company_id
  where t.status in ('en_route','in_progress') and d.profile_id is not null
    and now() >= fn_task_effective_end(t.id) + make_interval(mins => cs.complete_prompt_after_min)
    and not exists (select 1 from notifications n where n.task_id = t.id and n.type = 'task_complete_prompt');

  -- dispatcher alert: not acknowledged
  insert into notifications (company_id, user_id, type, task_id, title, data, channels)
  select t.company_id, p.id, 'driver_not_acknowledged', t.id, t.title, jsonb_build_object('driver_id', a.driver_id), '{in_app,push}'
  from tasks t join task_assignments a on a.task_id = t.id and a.is_primary
  join company_settings cs on cs.company_id = t.company_id
  join profiles p on p.company_id = t.company_id and p.role in ('dispatcher','admin','owner') and auth_can_access_site_for(p.id, t.site_id)
  where t.status = 'assigned' and now() >= t.scheduled_start - make_interval(mins => cs.ack_deadline_min)
    and not exists (select 1 from notifications n where n.task_id = t.id and n.type = 'driver_not_acknowledged' and n.user_id = p.id);

  -- dispatcher alert: not started
  insert into notifications (company_id, user_id, type, task_id, title, data, channels)
  select t.company_id, p.id, 'task_not_started', t.id, t.title, '{}', '{in_app,push}'
  from tasks t join company_settings cs on cs.company_id = t.company_id
  join profiles p on p.company_id = t.company_id and p.role in ('dispatcher','admin','owner') and auth_can_access_site_for(p.id, t.site_id)
  where t.status in ('assigned','acknowledged') and now() >= fn_task_effective_start(t.id) + make_interval(mins => cs.grace_min)
    and not exists (select 1 from notifications n where n.task_id = t.id and n.type = 'task_not_started' and n.user_id = p.id);

  -- auto no-show
  with ns as (
    update tasks t set status = 'no_show'
    from company_settings cs
    where cs.company_id = t.company_id and t.status in ('assigned','acknowledged')
      and now() >= fn_task_effective_start(t.id) + make_interval(mins => cs.no_show_after_min)
    returning t.id, t.company_id, t.status
  )
  insert into task_events (task_id, company_id, type, to_status) select id, company_id, 'no_show', 'no_show' from ns;

  -- driver offline while task active
  update drivers d set current_status = 'offline'
  from company_settings cs
  where cs.company_id = d.company_id and d.current_status <> 'offline'
    and d.last_seen_at < now() - make_interval(mins => cs.offline_alert_after_min);
end $$;

-- site access check for an arbitrary user (used by watchdog fan-out)
create or replace function auth_can_access_site_for(p_user uuid, p_site uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select role in ('owner','admin') from profiles where id = p_user)
      or not exists (select 1 from user_sites where user_id = p_user)
      or exists (select 1 from user_sites where user_id = p_user and site_id = p_site)
$$;

-- Notify-on-assignment trigger
create or replace function trg_notify_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_profile uuid; v_title text; v_company uuid;
begin
  select profile_id into v_profile from drivers where id = new.driver_id;
  select title, company_id into v_title, v_company from tasks where id = new.task_id;
  if v_profile is not null then
    insert into notifications (company_id, user_id, type, task_id, title, channels, actions)
    values (v_company, v_profile, 'task_assigned', new.task_id, v_title, '{in_app,push}',
            '[{"id":"acknowledge","label":"Acknowledge"},{"id":"decline","label":"Decline"}]');
  end if;
  update tasks set status = 'assigned' where id = new.task_id and status in ('draft','scheduled');
  insert into task_events (task_id, company_id, type, actor_id, to_status, payload)
  values (new.task_id, v_company, 'assigned', new.assigned_by, 'assigned', jsonb_build_object('driver_id', new.driver_id));
  return new;
end $$;
create trigger trg_assignment_notify after insert on task_assignments
  for each row execute function trg_notify_assignment();

-- Prune locations older than 90 days (pg_cron daily)
create or replace function fn_prune_locations() returns void
language sql security definer set search_path = public as $$
  delete from driver_locations where recorded_at < now() - interval '90 days';
$$;

-- ---------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table companies          enable row level security;
alter table company_settings   enable row level security;
alter table profiles           enable row level security;
alter table sites              enable row level security;
alter table user_sites         enable row level security;
alter table airports           enable row level security;
alter table site_airports      enable row level security;
alter table drivers            enable row level security;
alter table vehicles           enable row level security;
alter table driver_availability enable row level security;
alter table driver_locations   enable row level security;
alter table recurrence_rules   enable row level security;
alter table tasks              enable row level security;
alter table task_stops         enable row level security;
alter table task_assignments   enable row level security;
alter table flight_details     enable row level security;
alter table task_delays        enable row level security;
alter table task_events        enable row level security;
alter table task_attachments   enable row level security;
alter table task_links         enable row level security;
alter table task_conflicts     enable row level security;
alter table notifications      enable row level security;
alter table push_subscriptions enable row level security;
alter table holidays           enable row level security;
alter table driver_day_summary enable row level security;
alter table audit_log          enable row level security;

-- companies
create policy companies_select on companies for select using (id = auth_company_id());
create policy companies_insert on companies for insert with check (auth.uid() is not null);
create policy companies_update on companies for update using (id = auth_company_id() and auth_is_admin());

create policy settings_select on company_settings for select using (company_id = auth_company_id());
create policy settings_write  on company_settings for all using (company_id = auth_company_id() and auth_is_admin())
                                                   with check (company_id = auth_company_id() and auth_is_admin());

-- profiles: own row always; company members visible to each other; admins edit
create policy profiles_select on profiles for select using (id = auth.uid() or company_id = auth_company_id());
create policy profiles_update_self on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin on profiles for all using (company_id = auth_company_id() and auth_is_admin())
                                              with check (company_id = auth_company_id() and auth_is_admin());

-- sites
create policy sites_select on sites for select using (company_id = auth_company_id());
create policy sites_write  on sites for all using (company_id = auth_company_id() and auth_is_admin())
                                        with check (company_id = auth_company_id() and auth_is_admin());

create policy user_sites_select on user_sites for select using (user_id = auth.uid() or auth_is_admin());
create policy user_sites_admin  on user_sites for all using (auth_is_admin()) with check (auth_is_admin());

-- airports
create policy airports_select on airports for select using (company_id = auth_company_id());
create policy airports_write  on airports for all using (company_id = auth_company_id() and auth_is_staff())
                                              with check (company_id = auth_company_id() and auth_is_staff());
create policy site_airports_select on site_airports for select
  using (exists (select 1 from sites s where s.id = site_id and s.company_id = auth_company_id()));
create policy site_airports_write on site_airports for all
  using (exists (select 1 from sites s where s.id = site_id and s.company_id = auth_company_id()) and auth_is_staff())
  with check (exists (select 1 from sites s where s.id = site_id and s.company_id = auth_company_id()) and auth_is_staff());

-- drivers: staff full; driver sees self; viewer sees list
create policy drivers_select on drivers for select using (company_id = auth_company_id());
create policy drivers_write  on drivers for all using (company_id = auth_company_id() and auth_is_admin())
                                            with check (company_id = auth_company_id() and auth_is_admin());
create policy drivers_self_update on drivers for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy vehicles_select on vehicles for select using (company_id = auth_company_id());
create policy vehicles_write  on vehicles for all using (company_id = auth_company_id() and auth_is_staff())
                                              with check (company_id = auth_company_id() and auth_is_staff());

create policy availability_select on driver_availability for select
  using (exists (select 1 from drivers d where d.id = driver_id and d.company_id = auth_company_id()));
create policy availability_write on driver_availability for all
  using (auth_is_staff() and exists (select 1 from drivers d where d.id = driver_id and d.company_id = auth_company_id()))
  with check (auth_is_staff() and exists (select 1 from drivers d where d.id = driver_id and d.company_id = auth_company_id()));

-- locations: company can read; only rpc inserts (security definer), drivers may insert own too
create policy locations_select on driver_locations for select using (company_id = auth_company_id());
create policy locations_insert on driver_locations for insert
  with check (company_id = auth_company_id() and driver_id = auth_driver_id());

create policy recurrence_select on recurrence_rules for select using (company_id = auth_company_id());
create policy recurrence_write  on recurrence_rules for all using (company_id = auth_company_id() and auth_is_staff())
                                                        with check (company_id = auth_company_id() and auth_is_staff());

-- tasks: staff by site scope; drivers only assigned; viewers all
create policy tasks_select on tasks for select using (
  company_id = auth_company_id() and (
    auth_role() in ('owner','admin','viewer')
    or (auth_role() = 'dispatcher' and auth_can_access_site(site_id))
    or exists (select 1 from task_assignments a where a.task_id = id and a.driver_id = auth_driver_id())
  ));
create policy tasks_insert on tasks for insert with check (
  company_id = auth_company_id() and auth_is_staff() and auth_can_access_site(site_id));
create policy tasks_update on tasks for update using (
  company_id = auth_company_id() and auth_is_staff() and auth_can_access_site(site_id));
create policy tasks_delete on tasks for delete using (company_id = auth_company_id() and auth_is_admin());

-- child tables inherit via task visibility
create or replace function auth_can_see_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tasks t where t.id = p_task and t.company_id = auth_company_id() and (
    (select role from profiles where id = auth.uid()) in ('owner','admin','viewer')
    or ((select role from profiles where id = auth.uid()) = 'dispatcher' and auth_can_access_site(t.site_id))
    or exists (select 1 from task_assignments a where a.task_id = t.id and a.driver_id = auth_driver_id())))
$$;
create or replace function auth_can_edit_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tasks t where t.id = p_task and t.company_id = auth_company_id()
                 and auth_is_staff() and auth_can_access_site(t.site_id))
$$;

create policy stops_select on task_stops for select using (auth_can_see_task(task_id));
create policy stops_write  on task_stops for all using (auth_can_edit_task(task_id)) with check (auth_can_edit_task(task_id));
create policy stops_driver_update on task_stops for update using (
  exists (select 1 from task_assignments a where a.task_id = task_stops.task_id and a.driver_id = auth_driver_id()));

create policy assignments_select on task_assignments for select using (auth_can_see_task(task_id));
create policy assignments_write  on task_assignments for all using (auth_can_edit_task(task_id)) with check (auth_can_edit_task(task_id));

create policy flight_select on flight_details for select using (auth_can_see_task(task_id));
create policy flight_write  on flight_details for all using (auth_can_edit_task(task_id)) with check (auth_can_edit_task(task_id));

create policy delays_select on task_delays for select using (auth_can_see_task(task_id));
create policy delays_insert on task_delays for insert with check (auth_can_see_task(task_id));

create policy events_select on task_events for select using (auth_can_see_task(task_id));
create policy events_insert on task_events for insert with check (auth_can_see_task(task_id) and company_id = auth_company_id());

create policy attachments_select on task_attachments for select using (auth_can_see_task(task_id));
create policy attachments_insert on task_attachments for insert with check (auth_can_see_task(task_id));
create policy attachments_delete on task_attachments for delete using (auth_can_edit_task(task_id) or uploaded_by = auth.uid());

create policy links_select on task_links for select using (auth_can_see_task(task_id));
create policy links_write  on task_links for all using (auth_can_edit_task(task_id)) with check (auth_can_edit_task(task_id));

create policy conflicts_select on task_conflicts for select using (auth_can_see_task(task_id));
create policy conflicts_update on task_conflicts for update using (auth_can_edit_task(task_id));

-- notifications: own only
create policy notifications_select on notifications for select using (user_id = auth.uid());
create policy notifications_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy holidays_select on holidays for select using (company_id = auth_company_id());
create policy holidays_write  on holidays for all using (company_id = auth_company_id() and auth_is_admin())
                                              with check (company_id = auth_company_id() and auth_is_admin());

create policy summary_select on driver_day_summary for select using (
  company_id = auth_company_id() and (auth_role() <> 'driver' or driver_id = auth_driver_id()));

create policy audit_select on audit_log for select using (company_id = auth_company_id() and auth_is_admin());

-- ---------------------------------------------------------------------
-- 13. REALTIME
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table tasks, task_assignments, task_conflicts, notifications, drivers, driver_locations;

-- ---------------------------------------------------------------------
-- 14. STORAGE BUCKETS
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars own write"   on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid() is not null);
create policy "attachments company read" on storage.objects for select
  using (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = auth_company_id()::text);
create policy "attachments company write" on storage.objects for insert
  with check (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = auth_company_id()::text);

-- ---------------------------------------------------------------------
-- 15. SCHEDULED JOBS (requires pg_cron enabled in dashboard; run once)
-- ---------------------------------------------------------------------
-- select cron.schedule('masar-reminders',  '* * * * *',  $$select fn_plan_due_reminders()$$);
-- select cron.schedule('masar-watchdog',   '* * * * *',  $$select fn_task_watchdog()$$);
-- select cron.schedule('masar-prune-loc',  '0 3 * * *',  $$select fn_prune_locations()$$);
-- Push delivery: Edge Function `send-push` polls notifications where sent_at is null and 'push' = any(channels).

-- ---------------------------------------------------------------------
-- 16. GRANTS
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
