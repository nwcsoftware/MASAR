-- =====================================================================
--  MASAR — Migration 0006: Passenger module, Phase 1
--  (registration & approval, scheduled trips, driver card, trip documents,
--   ratings and the rating workflow)
--
--   1. Role `passenger`. A passenger is a person in the staff directory
--      (people) with a login (people.profile_id). Sign-up goes through
--      rpc_passenger_register (company e-mail domain or join code +
--      employee ID) and stays `pending` until an owner/admin approves
--      (rpc_review_registration). Pending / rejected → no trip data.
--   2. Isolation: RESTRICTIVE policies keep passengers out of every staff
--      table (they AND with the existing permissive ones), so no existing
--      policy has to change. A passenger reads their trips only through
--      rpc_passenger_home (scoped, masked: no driver phone, co-passengers
--      by first name) and their own rows (person, contacts, ratings).
--   3. task_passengers — the indexed link trip ↔ person (and visitors),
--      kept in sync with tasks.passengers by trigger; pickup order and the
--      check-in fields used in Phase 2.
--   4. Trip documents — task_attachments gain title / category / expiry /
--      visible_to_passengers; passengers may open only visible copies of
--      their own trips.
--   5. Ratings — company rating options (seeded EN/AR, editable), one rating
--      per passenger per trip (editable for rating_edit_hours), anonymous
--      to drivers (they see only fn_driver_rating), low ratings alert the
--      owners/admins.
--
--  Enum values added here are compared as text inside functions/policies
--  (a new enum value can't be used in the transaction that adds it).
-- =====================================================================

alter type app_role add value if not exists 'passenger';
alter type notification_type add value if not exists 'passenger_registered';
alter type notification_type add value if not exists 'registration_approved';
alter type notification_type add value if not exists 'registration_rejected';
alter type notification_type add value if not exists 'low_rating';

create or replace function auth_is_passenger() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text = 'passenger' from profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------
-- 1. people become passengers
-- ---------------------------------------------------------------------
alter table people add column profile_id uuid unique references profiles(id) on delete set null;
-- null = directory only (no app account)
alter table people add column registration_status text check (registration_status in ('pending','approved','rejected'));
alter table people add column registration_note text;
alter table people add column photo_url text;
alter table people add column language app_language not null default 'en';
alter table people add column accessibility_needs text;
alter table people add column ride_preferences text[] not null default '{}';

-- the approved passenger's person row (pending / rejected → null)
create or replace function auth_person_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from people where profile_id = auth.uid() and registration_status = 'approved'
$$;

create table emergency_contacts (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references people(id) on delete cascade,
  name        text not null,
  relation    text,
  phone       text not null,
  created_at  timestamptz not null default now()
);
create index emergency_contacts_person_idx on emergency_contacts(person_id);
alter table emergency_contacts enable row level security;
create policy emergency_contacts_own on emergency_contacts for all
  using (exists (select 1 from people p where p.id = person_id and p.profile_id = auth.uid()))
  with check (exists (select 1 from people p where p.id = person_id and p.profile_id = auth.uid()));
create policy emergency_contacts_staff on emergency_contacts for select
  using (auth_is_staff() and exists (select 1 from people p where p.id = person_id and p.company_id = auth_company_id()));

alter table company_settings add column passenger_email_domains text[] not null default '{}';
alter table company_settings add column passenger_join_code text unique;
alter table company_settings add column rating_edit_hours int not null default 24 check (rating_edit_hours between 0 and 720);
alter table company_settings add column low_rating_threshold int not null default 2 check (low_rating_threshold between 1 and 5);

alter table drivers add column nationality text;
-- 1–5, set by a manager (A4); the driving-behaviour score comes from ratings
alter table drivers add column english_rating int check (english_rating between 1 and 5);
-- marks licence types so the driver card can name the licence the driver holds
alter table document_types add column is_driving_licence boolean not null default false;
update document_types set is_driving_licence = true where name ilike '%licen%';

-- ---------------------------------------------------------------------
-- 2. isolation: passengers are kept out of staff data
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'company_settings','sites','user_sites','airports','site_airports','drivers','vehicles',
    'driver_availability','driver_locations','recurrence_rules','tasks','task_stops','task_assignments',
    'flight_details','task_delays','task_events','task_attachments','task_links','task_conflicts',
    'holidays','driver_day_summary','audit_log','grade_groups','document_types','job_titles',
    'job_title_documents','driver_documents'
  ] loop
    execute format('create policy %I on %I as restrictive for all using (not (select auth_is_passenger())) with check (not (select auth_is_passenger()))',
                   t || '_no_passengers', t);
  end loop;
end $$;

-- own rows only
create policy profiles_passenger_self on profiles as restrictive for all
  using (not auth_is_passenger() or id = auth.uid()) with check (not auth_is_passenger() or id = auth.uid());
create policy people_passenger_self on people as restrictive for all
  using (not auth_is_passenger() or profile_id = auth.uid()) with check (not auth_is_passenger() or profile_id = auth.uid());
-- a passenger never edits their own directory row directly (rpc_update_my_profile)
create policy people_passenger_no_write on people as restrictive for update using (not auth_is_passenger());

-- ---------------------------------------------------------------------
-- 3. trip ↔ passenger link
-- ---------------------------------------------------------------------
create table task_passengers (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references tasks(id) on delete cascade,
  company_id     uuid not null references companies(id) on delete cascade,
  person_id      uuid references people(id) on delete set null,   -- null = one-time visitor
  name           text not null,
  pickup_order   int not null,
  pickup_stop_seq  int,
  dropoff_stop_seq int,
  checkin_code   text,                                             -- Phase 2
  checked_in_at  timestamptz,
  dropped_off_at timestamptz,
  created_at     timestamptz not null default now()
);
create index task_passengers_task_idx on task_passengers(task_id);
create index task_passengers_person_idx on task_passengers(person_id);
alter table task_passengers enable row level security;
create policy task_passengers_staff on task_passengers for select using (auth_can_see_task(task_id));
create policy task_passengers_own on task_passengers for select using (person_id = auth_person_id());

-- rebuild from tasks.passengers, keeping check-in state per person / name
create or replace function fn_sync_task_passengers(p_task_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t tasks%rowtype;
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
end $$;

create or replace function trg_task_passengers_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.passengers is distinct from old.passengers then
    perform fn_sync_task_passengers(new.id);
  end if;
  return new;
end $$;
create trigger trg_tasks_passengers_sync after insert or update of passengers on tasks
  for each row execute function trg_task_passengers_sync();

select fn_sync_task_passengers(id) from tasks;

-- ---------------------------------------------------------------------
-- 4. trip documents
-- ---------------------------------------------------------------------
-- a document can be recorded before its copy is uploaded
alter table task_attachments alter column storage_path drop not null;
alter table task_attachments add column title text;
-- hotel_booking | gate_pass | flight_ticket | visa | other (labels translated in the app)
alter table task_attachments add column category text not null default 'other';
alter table task_attachments add column expires_on date;
alter table task_attachments add column visible_to_passengers boolean not null default false;
alter table task_attachments add column file_name text;
alter table task_attachments add column file_type text;
alter table task_attachments add column file_size int;
create policy attachments_update on task_attachments for update
  using (auth_can_edit_task(task_id)) with check (auth_can_edit_task(task_id));

-- passengers open only copies marked visible on their own trips (definer:
-- the passenger can't read task_attachments / task_passengers themselves)
create or replace function fn_passenger_can_read_attachment(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from task_attachments a join task_passengers tp on tp.task_id = a.task_id
                 where a.storage_path = p_path and a.visible_to_passengers and tp.person_id = auth_person_id())
$$;
create policy "attachments passenger read" on storage.objects for select using (
  bucket_id = 'task-attachments' and fn_passenger_can_read_attachment(name));
-- … and nothing else in the staff buckets
create policy "staff buckets no passengers" on storage.objects as restrictive for select using (
  bucket_id not in ('task-attachments', 'driver-documents') or not (select auth_is_passenger())
  or (bucket_id = 'task-attachments' and fn_passenger_can_read_attachment(name)));

-- ---------------------------------------------------------------------
-- 5. ratings
-- ---------------------------------------------------------------------
create table rating_options (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  -- driving & trip & road: pick one; cleanliness & vehicle: pick any
  category    text not null check (category in ('driving','trip','road','cleanliness','vehicle')),
  code        text not null,
  label       text not null,
  label_ar    text,
  -- 1–5 contribution to the driver's driving-behaviour score (driving options)
  score       int check (score between 1 and 5),
  -- choosing it alerts the owners (e.g. phone use, safety concern)
  alerts      boolean not null default false,
  sort        int not null default 0,
  is_active   boolean not null default true,
  unique (company_id, category, code)
);
alter table rating_options enable row level security;
create policy rating_options_select on rating_options for select using (company_id = auth_company_id());
create policy rating_options_admin on rating_options for all
  using (company_id = auth_company_id() and auth_is_admin()) with check (company_id = auth_company_id() and auth_is_admin());

create or replace function fn_seed_rating_options(p_company uuid) returns void
language sql security definer set search_path = public as $$
  insert into rating_options (company_id, category, code, label, label_ar, score, alerts, sort)
  select p_company, o.category, o.code, o.label, o.label_ar, o.score, o.alerts, o.sort
  from (values
    ('driving', 'smooth',        'Smooth and safe driving',                     'قيادة سلسة وآمنة',                  5, false, 1),
    ('driving', 'speeding',      'Speeding',                                    'سرعة زائدة',                         2, false, 2),
    ('driving', 'harsh',         'Harsh braking or acceleration',               'فرملة أو تسارع مفاجئ',               2, false, 3),
    ('driving', 'phone',         'Phone use while driving',                     'استخدام الهاتف أثناء القيادة',        1, true,  4),
    ('driving', 'ignored_rules', 'Ignored traffic rules or signals',            'تجاهل قواعد أو إشارات المرور',        1, false, 5),
    ('trip',    'on_time',       'On time and as planned',                      'في الموعد وكما هو مخطط',             null, false, 1),
    ('trip',    'delayed',       'Delayed pickup or arrival',                   'تأخر في الاستلام أو الوصول',          null, false, 2),
    ('trip',    'wrong_route',   'Wrong route or unnecessary detour',           'طريق خاطئ أو التفاف غير ضروري',       null, false, 3),
    ('trip',    'comfortable',   'Comfortable and pleasant trip',               'رحلة مريحة وممتعة',                  null, false, 4),
    ('trip',    'unprofessional','Unprofessional driver conduct',               'سلوك غير مهني من السائق',             null, false, 5),
    ('road',    'clear',         'Clear roads',                                 'طرق خالية',                          null, false, 1),
    ('road',    'congestion',    'Heavy traffic congestion',                    'ازدحام مروري شديد',                  null, false, 2),
    ('road',    'roadworks',     'Roadworks or diversions',                     'أعمال طرق أو تحويلات',                null, false, 3),
    ('road',    'poor_road',     'Poor road condition',                         'حالة الطريق سيئة',                   null, false, 4),
    ('road',    'weather',       'Weather impact (rain, fog, sandstorm)',       'تأثير الطقس (مطر، ضباب، عاصفة رملية)', null, false, 5),
    ('cleanliness', 'clean',     'Clean and tidy',                              'نظيفة ومرتبة',                       null, false, 1),
    ('cleanliness', 'odor',      'Unpleasant odor',                             'رائحة غير مستحبة',                   null, false, 2),
    ('cleanliness', 'dirty_seats','Dirty seats or floor',                       'مقاعد أو أرضية متسخة',               null, false, 3),
    ('cleanliness', 'trash',     'Trash left inside',                           'نفايات متروكة بالداخل',              null, false, 4),
    ('cleanliness', 'dirty_ext', 'Dirty exterior',                              'الهيكل الخارجي متسخ',                null, false, 5),
    ('vehicle', 'excellent',     'Excellent condition',                         'حالة ممتازة',                        null, false, 1),
    ('vehicle', 'worn',          'Old or worn out',                             'قديمة أو مستهلكة',                   null, false, 2),
    ('vehicle', 'body_damage',   'Visible body damage',                         'أضرار ظاهرة في الهيكل',              null, false, 3),
    ('vehicle', 'interior',      'Interior malfunction (AC, seats, windows)',   'عطل داخلي (تكييف، مقاعد، نوافذ)',      null, false, 4),
    ('vehicle', 'safety',        'Safety concern (seatbelts, tires, lights)',   'مشكلة سلامة (أحزمة، إطارات، أضواء)',  null, true,  5)
  ) as o(category, code, label, label_ar, score, alerts, sort)
  on conflict (company_id, category, code) do nothing
$$;

select fn_seed_rating_options(id) from companies;
create or replace function trg_company_rating_options() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform fn_seed_rating_options(new.id);
  return new;
end $$;
create trigger trg_companies_rating_options after insert on companies
  for each row execute function trg_company_rating_options();

create table trip_ratings (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  task_id        uuid not null references tasks(id) on delete cascade,
  person_id      uuid not null references people(id) on delete cascade,
  driver_id      uuid references drivers(id) on delete set null,
  vehicle_id     uuid references vehicles(id) on delete set null,
  stars          int not null check (stars between 1 and 5),
  comment        text,
  photo_paths    text[] not null default '{}',
  is_low         boolean not null default false,
  editable_until timestamptz not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (task_id, person_id)
);
create index trip_ratings_driver_idx on trip_ratings(driver_id, created_at desc);
create table trip_rating_choices (
  rating_id uuid not null references trip_ratings(id) on delete cascade,
  option_id uuid not null references rating_options(id) on delete cascade,
  primary key (rating_id, option_id)
);

-- identities only for owners/admins (A2) and the passenger themself; writes via rpc_submit_rating
alter table trip_ratings enable row level security;
alter table trip_rating_choices enable row level security;
create policy trip_ratings_select on trip_ratings for select using (
  company_id = auth_company_id() and (auth_is_admin() or person_id = auth_person_id()));
create policy trip_rating_choices_select on trip_rating_choices for select using (
  exists (select 1 from trip_ratings r where r.id = rating_id and r.company_id = auth_company_id()
          and (auth_is_admin() or r.person_id = auth_person_id())));

insert into storage.buckets (id, name, public) values ('rating-photos', 'rating-photos', false) on conflict (id) do nothing;
create policy "rating photos write" on storage.objects for insert with check (
  bucket_id = 'rating-photos' and (storage.foldername(name))[1] = auth_company_id()::text
  and (storage.foldername(name))[2] = auth_person_id()::text);
create policy "rating photos read" on storage.objects for select using (
  bucket_id = 'rating-photos' and (storage.foldername(name))[1] = auth_company_id()::text
  and (auth_is_admin() or (storage.foldername(name))[2] = auth_person_id()::text));

-- the driver's public scores — averages only, never who rated
create or replace function fn_driver_rating(p_driver_id uuid)
returns table (ratings int, stars numeric, driving numeric)
language sql stable security definer set search_path = public as $$
  select count(*)::int,
         round(avg(r.stars)::numeric, 1),
         round((select avg(o.score) from trip_rating_choices c join rating_options o on o.id = c.option_id
                join trip_ratings r2 on r2.id = c.rating_id
                where r2.driver_id = p_driver_id and o.category = 'driving' and o.score is not null)::numeric, 1)
  from trip_ratings r
  where r.driver_id = p_driver_id
    and exists (select 1 from drivers d where d.id = p_driver_id and d.company_id = auth_company_id())
$$;

-- ---------------------------------------------------------------------
-- registration
-- ---------------------------------------------------------------------
-- The caller has just signed up (profile without a company). The company is
-- found by the e-mail domain allow-list, or by join code + employee ID.
create or replace function rpc_passenger_register(
  p_full_name   text,
  p_phone       text default null,
  p_employee_no text default null,
  p_join_code   text default null,
  p_language    text default 'en'
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
  v_company uuid;
  v_domain  text;
  v_person  people%rowtype;
begin
  select * into v_profile from profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'errors.unauthorized' using errcode = '42501'; end if;
  if v_profile.company_id is not null then raise exception 'passenger.errors.alreadyRegistered'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'people.errors.name'; end if;

  v_domain := lower(split_part(v_profile.email, '@', 2));
  if nullif(trim(p_join_code), '') is not null then
    select company_id into v_company from company_settings where upper(passenger_join_code) = upper(trim(p_join_code));
    if v_company is null then raise exception 'passenger.errors.joinCode'; end if;
    if nullif(trim(p_employee_no), '') is null then raise exception 'passenger.errors.employeeNo'; end if;
  else
    select company_id into v_company from company_settings where v_domain = any (passenger_email_domains) limit 1;
    if v_company is null then raise exception 'passenger.errors.domain'; end if;
  end if;

  -- the directory entry: by employee ID, else by e-mail; else a new person
  select * into v_person from people
  where company_id = v_company and profile_id is null
    and ((nullif(trim(p_employee_no), '') is not null and employee_no = trim(p_employee_no))
         or (nullif(trim(p_employee_no), '') is null and lower(email) = lower(v_profile.email)))
  limit 1;
  if v_person.id is null and nullif(trim(p_join_code), '') is not null then
    raise exception 'passenger.errors.employeeNotFound';
  end if;
  if v_person.id is null then
    insert into people (company_id, full_name, phone, email, source, created_by)
    values (v_company, trim(p_full_name), nullif(trim(p_phone), ''), v_profile.email, 'self', auth.uid())
    returning * into v_person;
  end if;

  update people set profile_id = auth.uid(), registration_status = 'pending',
                    phone = coalesce(phone, nullif(trim(p_phone), '')), email = coalesce(email, v_profile.email),
                    language = case when p_language = 'ar' then 'ar'::app_language else 'en'::app_language end
  where id = v_person.id;
  update profiles set company_id = v_company, role = 'passenger', full_name = trim(p_full_name),
                      phone = nullif(trim(p_phone), ''),
                      language = case when p_language = 'ar' then 'ar'::app_language else 'en'::app_language end
  where id = auth.uid();

  insert into notifications (company_id, user_id, type, title, body, data, channels)
  select v_company, p.id, 'passenger_registered', trim(p_full_name), v_profile.email,
         jsonb_build_object('person_id', v_person.id), '{in_app,push}'
  from profiles p where p.company_id = v_company and p.role in ('owner','admin') and p.is_active;
  return 'pending';
end $$;

create or replace function rpc_review_registration(p_person_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_person people%rowtype;
begin
  if not auth_is_admin() then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  select * into v_person from people where id = p_person_id and company_id = auth_company_id();
  if v_person.id is null or v_person.profile_id is null then raise exception 'errors.invalidInput'; end if;
  update people set registration_status = case when p_approve then 'approved' else 'rejected' end,
                    registration_note = nullif(trim(p_note), '')
  where id = p_person_id;
  insert into notifications (company_id, user_id, type, title, body, channels)
  values (v_person.company_id, v_person.profile_id,
          (case when p_approve then 'registration_approved' else 'registration_rejected' end)::notification_type,
          v_person.full_name, nullif(trim(p_note), ''), '{in_app,push}');
  insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
  values (v_person.company_id, auth.uid(), 'people', p_person_id::text,
          case when p_approve then 'registration_approved' else 'registration_rejected' end, jsonb_build_object('note', p_note));
end $$;

-- a passenger edits their own preferences (not their grade, not their company)
create or replace function rpc_update_my_profile(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from people where profile_id = auth.uid();
  if v_id is null then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  update people set
    phone = coalesce(nullif(trim(p->>'phone'), ''), phone),
    language = case when p->>'language' = 'ar' then 'ar'::app_language when p->>'language' = 'en' then 'en'::app_language else language end,
    accessibility_needs = case when p ? 'accessibility_needs' then nullif(trim(p->>'accessibility_needs'), '') else accessibility_needs end,
    ride_preferences = case when p ? 'ride_preferences'
                            then array(select jsonb_array_elements_text(p->'ride_preferences')) else ride_preferences end,
    photo_url = case when p ? 'photo_url' then nullif(p->>'photo_url', '') else photo_url end
  where id = v_id;
  if p ? 'language' then
    update profiles set language = case when p->>'language' = 'ar' then 'ar'::app_language else 'en'::app_language end where id = auth.uid();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- the passenger's view of their trips (scoped + masked)
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
      -- A3: no driver number; during the active window the site's dispatch line
      'contact_phone', case when t.status in ('acknowledged','en_route','in_progress','delayed')
                              and now() between t.scheduled_start - interval '1 hour' and coalesce(t.scheduled_end, t.scheduled_start) + interval '1 hour'
                            then s.contact_phone end,
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
                    from trip_ratings r where r.task_id = t.id and r.person_id = v_person.id)
    ) as trip
    from tasks t
    join task_passengers tp on tp.task_id = t.id and tp.person_id = v_person.id
    join sites s on s.id = t.site_id
    where t.status not in ('draft')
      and t.scheduled_start > now() - interval '60 days'
  ) q;

  return jsonb_build_object('status', 'approved', 'person_id', v_person.id, 'trips', v_trips);
end $$;

-- ---------------------------------------------------------------------
-- rating submission (one per passenger per trip, editable for a while)
-- ---------------------------------------------------------------------
create or replace function rpc_submit_rating(
  p_task_id     uuid,
  p_stars       int,
  p_option_ids  uuid[] default '{}',
  p_comment     text default null,
  p_photo_paths text[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_person   uuid := auth_person_id();
  t          tasks%rowtype;
  a          task_assignments%rowtype;
  v_settings company_settings%rowtype;
  v_rating   trip_ratings%rowtype;
  v_low      boolean;
  v_reason   text;
begin
  if v_person is null then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  select * into t from tasks where id = p_task_id;
  if t.id is null or not exists (select 1 from task_passengers where task_id = t.id and person_id = v_person) then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if t.status <> 'completed' then raise exception 'rating.errors.notFinished'; end if;
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'rating.errors.stars'; end if;
  -- options belong to the company, and single-choice groups get at most one
  if exists (select 1 from unnest(coalesce(p_option_ids, '{}')) o
             where not exists (select 1 from rating_options r where r.id = o and r.company_id = t.company_id and r.is_active)) then
    raise exception 'errors.invalidInput';
  end if;
  if exists (select 1 from rating_options r where r.id = any (coalesce(p_option_ids, '{}'))
             and r.category in ('driving','trip','road') group by r.category having count(*) > 1) then
    raise exception 'rating.errors.oneChoice';
  end if;
  if exists (select 1 from unnest(coalesce(p_photo_paths, '{}')) p
             where split_part(p, '/', 1) <> t.company_id::text or split_part(p, '/', 2) <> v_person::text) then
    raise exception 'errors.invalidInput';
  end if;

  select * into v_settings from company_settings where company_id = t.company_id;
  select * into a from task_assignments where task_id = t.id and is_primary;
  select * into v_rating from trip_ratings where task_id = t.id and person_id = v_person;
  if v_rating.id is not null and now() > v_rating.editable_until then raise exception 'rating.errors.locked'; end if;

  select string_agg(r.code, ',') into v_reason from rating_options r where r.id = any (coalesce(p_option_ids, '{}')) and r.alerts;
  v_low := p_stars <= v_settings.low_rating_threshold or v_reason is not null;

  if v_rating.id is null then
    insert into trip_ratings (company_id, task_id, person_id, driver_id, vehicle_id, stars, comment, photo_paths, is_low, editable_until)
    values (t.company_id, t.id, v_person, a.driver_id, a.vehicle_id, p_stars, nullif(trim(p_comment), ''),
            coalesce(p_photo_paths, '{}'), v_low, now() + make_interval(hours => v_settings.rating_edit_hours))
    returning * into v_rating;
  else
    update trip_ratings set stars = p_stars, comment = nullif(trim(p_comment), ''), photo_paths = coalesce(p_photo_paths, '{}'),
                            is_low = v_low, updated_at = now()
    where id = v_rating.id;
  end if;
  delete from trip_rating_choices where rating_id = v_rating.id;
  insert into trip_rating_choices (rating_id, option_id) select v_rating.id, unnest(coalesce(p_option_ids, '{}'));

  -- §14: low ratings alert the owners/admins (once per rating)
  if v_low and not exists (select 1 from notifications where type::text = 'low_rating' and data->>'rating_id' = v_rating.id::text) then
    insert into notifications (company_id, user_id, type, task_id, title, body, data, channels)
    select t.company_id, p.id, 'low_rating', t.id, t.title, coalesce(v_reason, p_stars::text || '★'),
           jsonb_build_object('rating_id', v_rating.id, 'driver_id', a.driver_id, 'stars', p_stars, 'reasons', v_reason), '{in_app,push}'
    from profiles p where p.company_id = t.company_id and p.role in ('owner','admin') and p.is_active;
  end if;
  insert into audit_log (company_id, actor_id, table_name, row_id, action, new_data)
  values (t.company_id, auth.uid(), 'trip_ratings', v_rating.id::text, 'rating_submitted',
          jsonb_build_object('stars', p_stars, 'low', v_low));
  return v_rating.id;
end $$;

grant select, insert, update, delete on emergency_contacts, task_passengers, rating_options, trip_ratings, trip_rating_choices to authenticated;
grant execute on function auth_is_passenger(), auth_person_id(), fn_passenger_can_read_attachment(text), fn_driver_rating(uuid), rpc_passenger_register(text, text, text, text, text),
  rpc_review_registration(uuid, boolean, text), rpc_update_my_profile(jsonb), rpc_passenger_home(), rpc_submit_rating(uuid, int, uuid[], text, text[])
  to authenticated;
revoke execute on function fn_sync_task_passengers(uuid), fn_seed_rating_options(uuid) from public, anon, authenticated;
