-- =====================================================================
--  MASAR — local development seed (loaded by `supabase db reset`)
--
--  One demo company, four sites, three airports, four drivers, four vehicles,
--  today's board (mirrors design/preview.html so every UI state lights up),
--  tomorrow's open work, and two weeks of completed history for reports.
--
--  Every login below uses the password:  Masar!2026
--    owner@masar.dev            owner       — sees everything
--    dispatcher@masar.dev       dispatcher  — Riyadh HQ + Al Yasmin Site
--    dammam@masar.dev           dispatcher  — Dammam Site
--    viewer@masar.dev           viewer      — read-only
--    ahmed@masar.dev            driver      — Ahmed Saleh (Riyadh HQ)
--    khalid@masar.dev           driver      — Khalid Mansour (Dammam Site)
--    yousef@masar.dev           driver      — Yousef Rashid (Jeddah Tower)
--    fahad@masar.dev            driver      — Fahad Al-Qahtani (Riyadh HQ)
--
--  Times are relative to "today" in Asia/Riyadh, so the board is always live.
--  Status changes go through rpc_task_transition (impersonating the driver),
--  never through a raw UPDATE of tasks.status — same rule as the app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- helpers (session-local, dropped with the connection)
-- ---------------------------------------------------------------------
create function pg_temp.ksa(p_day date, p_time text) returns timestamptz
language sql immutable as $$ select (p_day + p_time::time) at time zone 'Asia/Riyadh' $$;

create function pg_temp.act_as(p_user uuid) returns void
language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
$$;

create function pg_temp.today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Riyadh')::date $$;

-- ---------------------------------------------------------------------
-- auth users (+ email identities so password login works)
-- profiles rows are created by the on_auth_user_created trigger
-- ---------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('Masar!2026', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', u.full_name, 'language', u.lang),
       now(), now(), '', '', '', ''
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'owner@masar.dev',      'Majed Al-Harbi',   'en'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'dispatcher@masar.dev', 'Nawaf Al-Anazi',   'en'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'dammam@masar.dev',     'Huda Al-Dossary',  'ar'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'viewer@masar.dev',     'Reem Al-Shehri',   'en'),
  ('10000000-0000-4000-8000-000000000011'::uuid, 'ahmed@masar.dev',      'Ahmed Saleh',      'ar'),
  ('10000000-0000-4000-8000-000000000012'::uuid, 'khalid@masar.dev',     'Khalid Mansour',   'ar'),
  ('10000000-0000-4000-8000-000000000013'::uuid, 'yousef@masar.dev',     'Yousef Rashid',    'en'),
  ('10000000-0000-4000-8000-000000000014'::uuid, 'fahad@masar.dev',      'Fahad Al-Qahtani', 'ar')
) as u(id, email, full_name, lang);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%@masar.dev';

-- ---------------------------------------------------------------------
-- company + settings
-- ---------------------------------------------------------------------
insert into companies (id, name, name_ar, country_code, timezone, default_language) values
  ('00000000-0000-4000-8000-000000000001', 'Masar Demo Contracting', 'مسار للمقاولات (تجريبي)', 'SA', 'Asia/Riyadh', 'en');

insert into company_settings (company_id) values ('00000000-0000-4000-8000-000000000001');

update profiles p set
  company_id = '00000000-0000-4000-8000-000000000001',
  role = r.role::app_role,
  full_name_ar = r.name_ar,
  phone = r.phone
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'owner',      'ماجد الحربي',   '+966 50 100 0001'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'dispatcher', 'نواف العنزي',   '+966 50 100 0002'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'dispatcher', 'هدى الدوسري',   '+966 50 100 0003'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'viewer',     'ريم الشهري',    '+966 50 100 0004'),
  ('10000000-0000-4000-8000-000000000011'::uuid, 'driver',     'أحمد صالح',     '+966 55 200 0011'),
  ('10000000-0000-4000-8000-000000000012'::uuid, 'driver',     'خالد منصور',    '+966 55 200 0012'),
  ('10000000-0000-4000-8000-000000000013'::uuid, 'driver',     'يوسف راشد',     '+966 55 200 0013'),
  ('10000000-0000-4000-8000-000000000014'::uuid, 'driver',     'فهد القحطاني',  '+966 55 200 0014')
) as r(id, role, name_ar, phone)
where p.id = r.id;

-- ---------------------------------------------------------------------
-- sites, airports, scopes
-- ---------------------------------------------------------------------
insert into sites (id, company_id, code, name, name_ar, type, address, address_ar, city, lat, lng,
                   contact_name, contact_phone, work_start, work_end) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'RHQ', 'Riyadh HQ',      'المقر الرئيسي – الرياض', 'office',
   'Olaya St, Al Olaya, Riyadh', 'شارع العليا، حي العليا، الرياض', 'Riyadh', 24.6948, 46.6857, 'Nawaf Al-Anazi', '+966 50 100 0002', '07:30', '17:00'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'YAS', 'Al Yasmin Site', 'موقع الياسمين', 'construction_site',
   'Al Yasmin District, Riyadh', 'حي الياسمين، الرياض', 'Riyadh', 24.8236, 46.6407, 'Eng. Omar Fawzi', '+966 50 300 0001', '06:30', '16:30'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'DMM', 'Dammam Site',    'موقع الدمام', 'construction_site',
   'King Saud St, Dammam', 'شارع الملك سعود، الدمام', 'Dammam', 26.4207, 50.0888, 'Huda Al-Dossary', '+966 50 100 0003', '06:30', '16:30'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'JED', 'Jeddah Tower',   'برج جدة', 'construction_site',
   'North Obhur, Jeddah', 'أبحر الشمالية، جدة', 'Jeddah', 21.7350, 39.0850, 'Eng. Faisal Nasser', '+966 50 300 0002', '06:30', '16:30');

insert into user_sites (user_id, site_id) values
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003');

insert into airports (id, company_id, iata, icao, name, name_ar, city, city_ar, country_code, lat, lng, terminals, source) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'RUH', 'OERK', 'King Khalid International Airport', 'مطار الملك خالد الدولي', 'Riyadh', 'الرياض', 'SA', 24.9576, 46.6988, '{1,2,3,4,5}', 'manual'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'DMM', 'OEDF', 'King Fahd International Airport',   'مطار الملك فهد الدولي',  'Dammam', 'الدمام', 'SA', 26.4712, 49.7979, '{}', 'manual'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'JED', 'OEJN', 'King Abdulaziz International Airport', 'مطار الملك عبدالعزيز الدولي', 'Jeddah', 'جدة', 'SA', 21.6796, 39.1565, '{1,North}', 'manual');

-- road distance ≈ haversine × 1.3, ~70 km/h average
insert into site_airports (site_id, airport_id, is_default, distance_km, drive_minutes, default_buffer_min)
select s.id, a.id, true,
       round((fn_distance_km(s.lat, s.lng, a.lat, a.lng) * 1.3)::numeric, 1),
       greatest(15, round(fn_distance_km(s.lat, s.lng, a.lat, a.lng) * 1.3 / 70 * 60)::int),
       30
from sites s join airports a on a.city = s.city;

-- ---------------------------------------------------------------------
-- drivers, vehicles, availability, holidays
-- ---------------------------------------------------------------------
insert into drivers (id, company_id, profile_id, home_site_id, employee_no, full_name, full_name_ar, phone,
                     licence_no, licence_expiry, max_daily_driving_min, shift_start, shift_end) values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011',
   '20000000-0000-4000-8000-000000000001', 'D-001', 'Ahmed Saleh', 'أحمد صالح', '+966 55 200 0011', 'SA-1029384', current_date + 400, null, '07:00', '17:00'),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000012',
   '20000000-0000-4000-8000-000000000003', 'D-002', 'Khalid Mansour', 'خالد منصور', '+966 55 200 0012', 'SA-5647382', current_date + 45, null, '07:00', '17:00'),
  ('40000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000013',
   '20000000-0000-4000-8000-000000000004', 'D-003', 'Yousef Rashid', 'يوسف راشد', '+966 55 200 0013', 'SA-8899001', current_date + 800, 300, '07:00', '17:00'),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000014',
   '20000000-0000-4000-8000-000000000001', 'D-004', 'Fahad Al-Qahtani', 'فهد القحطاني', '+966 55 200 0014', 'SA-1122334', current_date + 220, null, '06:00', '15:00');

insert into vehicles (id, company_id, site_id, plate_no, make, model, year, color, seats, odometer_km) values
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '1234 RAB', 'Toyota',  'Camry',        2024, 'White',  4,  38200),
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '5678 KSA', 'Toyota',  'Hiace',        2023, 'White', 12,  71450),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '4321 DMM', 'Hyundai', 'H1',           2022, 'Silver', 8, 102300),
  ('50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', '8765 JED', 'Toyota',  'Land Cruiser', 2024, 'Black',  7,  15800);

insert into driver_availability (driver_id, type, starts_at, ends_at, note, created_by) values
  ('40000000-0000-4000-8000-000000000004', 'leave',
   pg_temp.ksa(pg_temp.today() + 7, '00:00'), pg_temp.ksa(pg_temp.today() + 10, '00:00'),
   'Annual leave', '10000000-0000-4000-8000-000000000001');

insert into holidays (company_id, date, name, name_ar)
select '00000000-0000-4000-8000-000000000001', make_date(y, m, d), n, n_ar
from generate_series(extract(year from current_date)::int, extract(year from current_date)::int + 1) y,
     (values (2, 22, 'Founding Day', 'يوم التأسيس'), (9, 23, 'Saudi National Day', 'اليوم الوطني')) h(m, d, n, n_ar);

insert into recurrence_rules (id, company_id, rrule, starts_on, generated_until) values
  ('70000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
   'FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH', pg_temp.today() - 30, pg_temp.today() + 1);

-- ---------------------------------------------------------------------
-- history: 13 past days of completed work (feeds driver_day_summary)
-- ---------------------------------------------------------------------
do $$
declare
  v_company constant uuid := '00000000-0000-4000-8000-000000000001';
  v_day     date;
  v_task    uuid;
  v_n       int;
  d         record;
  j         record;
  v_jitter  int;
begin
  for v_day in select g::date from generate_series(pg_temp.today() - 13, pg_temp.today() - 1, interval '1 day') g loop
    continue when extract(dow from v_day)::int in (5, 6);   -- company weekend: Fri, Sat
    for d in
      select dr.id, dr.profile_id, dr.home_site_id, s.lat, s.lng, s.name as site_name,
             row_number() over (order by dr.employee_no) as n
      from drivers dr join sites s on s.id = dr.home_site_id
    loop
      v_n := (extract(doy from v_day)::int + d.n::int);
      for j in
        select * from (values
          (1, 'daily_routine'::task_category, 'Site rounds', '08:00', '10:00', 22.0),
          (2, (array['airport','document_delivery','escort']::task_category[])[1 + v_n % 3],
              (array['Airport transfer','Document run','Staff escort'])[1 + v_n % 3], '11:00', '13:30', 41.5),
          (3, 'escort'::task_category, 'Evening escort', '16:30', '19:30', 18.0)
        ) as x(seq, cat, title, t_start, t_end, km)
        where x.seq < 3 or v_n % 3 = 0          -- every third day runs late → overtime
      loop
        insert into tasks (company_id, site_id, category, title, scheduled_start, scheduled_end,
                           estimated_distance_km, created_by)
        values (v_company, d.home_site_id, j.cat, j.title,
                pg_temp.ksa(v_day, j.t_start), pg_temp.ksa(v_day, j.t_end), j.km,
                '10000000-0000-4000-8000-000000000001')
        returning id into v_task;
        insert into task_stops (task_id, seq, label, lat, lng, site_id)
        values (v_task, 1, d.site_name, d.lat, d.lng, d.home_site_id);
        insert into task_assignments (task_id, driver_id, assigned_by, acknowledged_at)
        values (v_task, d.id, '10000000-0000-4000-8000-000000000001', pg_temp.ksa(v_day, '07:00'));

        perform pg_temp.act_as(d.profile_id);
        perform rpc_task_transition(v_task, 'start', '{}');
        perform rpc_task_transition(v_task, 'complete', jsonb_build_object('distance_km', j.km + (v_n % 7)));

        -- the RPC stamps now(); move actuals back onto the historical day
        v_jitter := (v_n * 7 + j.seq * 3) % 20 - 5;
        update tasks set
          actual_start_at = pg_temp.ksa(v_day, j.t_start) + make_interval(mins => v_jitter),
          actual_end_at   = pg_temp.ksa(v_day, j.t_end)   + make_interval(mins => v_jitter + (v_n % 4) * 10)
        where id = v_task;
      end loop;
      perform fn_refresh_driver_day_summary(d.id, v_day);
    end loop;
  end loop;
  perform set_config('request.jwt.claims', '', false);
end $$;

-- history assignments generated "task_assigned" inbox items; drop them
delete from notifications;

-- ---------------------------------------------------------------------
-- today's board  (ids 6…01–6…09) and tomorrow (6…11–6…14)
-- ---------------------------------------------------------------------
insert into tasks (id, company_id, site_id, category, priority, title, description, scheduled_start, scheduled_end,
                   estimated_duration_min, estimated_distance_km, passengers, recurrence_rule_id, recurrence_date, created_by)
values
  -- Ahmed
  ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'daily_routine', 'normal', 'Office shuttle', 'Morning staff shuttle HQ → Al Yasmin',
   pg_temp.ksa(pg_temp.today(), '08:00'), pg_temp.ksa(pg_temp.today(), '10:00'), 120, 24.5, '[]',
   '70000000-0000-4000-8000-000000000001', pg_temp.today(), '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'airport', 'high', 'Pick up Eng. Sara Al-Otaibi', 'Arrival from Jeddah, take to Al Yasmin Site office',
   pg_temp.ksa(pg_temp.today(), '12:45'), pg_temp.ksa(pg_temp.today(), '16:10'), 205, 61.0,
   '[{"name":"Eng. Sara Al-Otaibi","phone":"+966 55 010 2030"}]', null, null, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'escort', 'normal', 'Escort Mr. Hamad to SAB Bank', 'Wait and return',
   pg_temp.ksa(pg_temp.today(), '17:00'), pg_temp.ksa(pg_temp.today(), '18:00'), 60, 9.0,
   '[{"name":"Mr. Hamad Al-Mutairi","phone":"+966 50 400 1122"}]', null, null, '10000000-0000-4000-8000-000000000002'),
  -- Khalid
  ('60000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003',
   'document_delivery', 'normal', 'Documents to Ministry of Labor', 'Contract renewals — get stamped receipt',
   pg_temp.ksa(pg_temp.today(), '09:00'), pg_temp.ksa(pg_temp.today(), '10:30'), 90, 14.0, '[]', null, null,
   '10000000-0000-4000-8000-000000000003'),
  ('60000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003',
   'airport', 'normal', 'DMM arrival · MS 691', 'Pick up visiting engineers from Cairo',
   pg_temp.ksa(pg_temp.today(), '14:20'), pg_temp.ksa(pg_temp.today(), '17:00'), 160, 72.0,
   '[{"name":"Eng. Mostafa Adel","phone":"+20 100 555 0101"},{"name":"Eng. Rania Samir","phone":"+20 100 555 0102"}]',
   null, null, '10000000-0000-4000-8000-000000000003'),
  -- Yousef (double-booked 12:30–13:00 and over his 5 h limit)
  ('60000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004',
   'escort', 'normal', 'Escort · Al Rajhi Bank', 'Accompany site accountant',
   pg_temp.ksa(pg_temp.today(), '10:30'), pg_temp.ksa(pg_temp.today(), '13:00'), 150, 22.0,
   '[{"name":"Mr. Tariq Hassan","phone":"+966 50 400 3344"}]', null, null, '10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004',
   'airport', 'high', 'JED departure · XY 210', 'Drop project manager for Riyadh flight',
   pg_temp.ksa(pg_temp.today(), '12:30'), pg_temp.ksa(pg_temp.today(), '15:40'), 190, 38.0,
   '[{"name":"Eng. Faisal Nasser","phone":"+966 50 300 0002"}]', null, null, '10000000-0000-4000-8000-000000000001'),
  -- Fahad
  ('60000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'daily_routine', 'normal', 'Site rounds', 'Pick up daily reports from Al Yasmin',
   pg_temp.ksa(pg_temp.today(), '08:00'), pg_temp.ksa(pg_temp.today(), '10:00'), 120, 26.0, '[]', null, null,
   '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'document_delivery', 'normal', 'Documents to Chamber of Commerce', 'Certificate of origin',
   pg_temp.ksa(pg_temp.today(), '16:00'), pg_temp.ksa(pg_temp.today(), '17:00'), 60, 11.0, '[]', null, null,
   '10000000-0000-4000-8000-000000000002'),
  -- Al Yasmin: unassigned RUH arrival 30 min after Ahmed's SV 1234 → sharing hint
  ('60000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
   'airport', 'normal', 'Pick up consultant — EK 817', 'Arrival from Dubai',
   pg_temp.ksa(pg_temp.today(), '13:30'), pg_temp.ksa(pg_temp.today(), '15:45'), 135, 48.0,
   '[{"name":"Mr. David Lee","phone":"+971 50 123 4567"}]', null, null, '10000000-0000-4000-8000-000000000002'),
  -- tomorrow
  ('60000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
   'airport', 'normal', 'RUH arrival · QR 1146', 'Pick up new site engineer',
   pg_temp.ksa(pg_temp.today() + 1, '05:10'), pg_temp.ksa(pg_temp.today() + 1, '07:30'), 140, 48.0,
   '[{"name":"Eng. Karim Haddad","phone":"+974 55 111 2233"}]', null, null, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'escort', 'normal', 'Escort finance team to Riyad Bank', null,
   pg_temp.ksa(pg_temp.today() + 1, '10:00'), pg_temp.ksa(pg_temp.today() + 1, '11:30'), 90, 12.0,
   '[{"name":"Finance team (3)"}]', null, null, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'daily_routine', 'normal', 'Office shuttle', 'Morning staff shuttle HQ → Al Yasmin',
   pg_temp.ksa(pg_temp.today() + 1, '08:00'), pg_temp.ksa(pg_temp.today() + 1, '10:00'), 120, 24.5, '[]',
   '70000000-0000-4000-8000-000000000001', pg_temp.today() + 1, '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003',
   'document_delivery', 'low', 'Permits to Dammam Municipality', null,
   pg_temp.ksa(pg_temp.today() + 1, '09:30'), pg_temp.ksa(pg_temp.today() + 1, '11:00'), 90, 9.0, '[]', null, null,
   '10000000-0000-4000-8000-000000000003');

-- stops (first stop = origin)
insert into task_stops (task_id, seq, label, address, lat, lng, site_id, airport_id, planned_arrival_at, dwell_min, leg_distance_km, leg_duration_min)
select t.task_id::uuid, t.seq, t.label, t.address, t.lat, t.lng, t.site_id::uuid, t.airport_id::uuid,
       pg_temp.ksa(pg_temp.today() + t.day_offset, t.at), t.dwell, t.km, t.mins
from (values
  ('60000000-0000-4000-8000-000000000001', 1, 'Riyadh HQ',              'Olaya St',            24.6948, 46.6857, '20000000-0000-4000-8000-000000000001', null, 0, '08:00', 10, null, null),
  ('60000000-0000-4000-8000-000000000001', 2, 'Al Yasmin Site',         'Al Yasmin',           24.8236, 46.6407, '20000000-0000-4000-8000-000000000002', null, 0, '08:40', 20, 24.5, 30),
  ('60000000-0000-4000-8000-000000000002', 1, 'Riyadh HQ',              'Olaya St',            24.6948, 46.6857, '20000000-0000-4000-8000-000000000001', null, 0, '12:45', 0, null, null),
  ('60000000-0000-4000-8000-000000000002', 2, 'RUH Terminal 1 · Arrivals', 'King Khalid Intl', 24.9576, 46.6988, null, '30000000-0000-4000-8000-000000000001', 0, '13:30', 40, 36.0, 45),
  ('60000000-0000-4000-8000-000000000002', 3, 'Al Yasmin Site office',  'Al Yasmin',           24.8236, 46.6407, '20000000-0000-4000-8000-000000000002', null, 0, '15:40', 0, 25.0, 30),
  ('60000000-0000-4000-8000-000000000003', 1, 'Riyadh HQ',              'Olaya St',            24.6948, 46.6857, '20000000-0000-4000-8000-000000000001', null, 0, '17:00', 0, null, null),
  ('60000000-0000-4000-8000-000000000003', 2, 'SAB Bank — Olaya',       'Olaya St, Riyadh',    24.7110, 46.6745, null, null, 0, '17:15', 30, 4.5, 15),
  ('60000000-0000-4000-8000-000000000004', 1, 'Dammam Site',            'King Saud St',        26.4207, 50.0888, '20000000-0000-4000-8000-000000000003', null, 0, '09:00', 0, null, null),
  ('60000000-0000-4000-8000-000000000004', 2, 'Ministry of Labor',      'Dammam',              26.4334, 50.1036, null, null, 0, '09:25', 30, 7.0, 25),
  ('60000000-0000-4000-8000-000000000005', 1, 'Dammam Site',            'King Saud St',        26.4207, 50.0888, '20000000-0000-4000-8000-000000000003', null, 0, '14:20', 0, null, null),
  ('60000000-0000-4000-8000-000000000005', 2, 'DMM · Arrivals',         'King Fahd Intl',      26.4712, 49.7979, null, '30000000-0000-4000-8000-000000000002', 0, '15:00', 45, 36.0, 40),
  ('60000000-0000-4000-8000-000000000005', 3, 'Dammam Site',            'King Saud St',        26.4207, 50.0888, '20000000-0000-4000-8000-000000000003', null, 0, '16:25', 0, 36.0, 40),
  ('60000000-0000-4000-8000-000000000006', 1, 'Jeddah Tower',           'North Obhur',         21.7350, 39.0850, '20000000-0000-4000-8000-000000000004', null, 0, '10:30', 0, null, null),
  ('60000000-0000-4000-8000-000000000006', 2, 'Al Rajhi Bank — Tahlia', 'Tahlia St, Jeddah',   21.5497, 39.1622, null, null, 0, '11:05', 90, 22.0, 35),
  ('60000000-0000-4000-8000-000000000007', 1, 'Jeddah Tower',           'North Obhur',         21.7350, 39.0850, '20000000-0000-4000-8000-000000000004', null, 0, '12:30', 0, null, null),
  ('60000000-0000-4000-8000-000000000007', 2, 'JED North Terminal',     'King Abdulaziz Intl', 21.6796, 39.1565, null, '30000000-0000-4000-8000-000000000003', 0, '13:10', 20, 19.0, 40),
  ('60000000-0000-4000-8000-000000000008', 1, 'Riyadh HQ',              'Olaya St',            24.6948, 46.6857, '20000000-0000-4000-8000-000000000001', null, 0, '08:00', 0, null, null),
  ('60000000-0000-4000-8000-000000000008', 2, 'Al Yasmin Site',         'Al Yasmin',           24.8236, 46.6407, '20000000-0000-4000-8000-000000000002', null, 0, '08:40', 30, 26.0, 40),
  ('60000000-0000-4000-8000-000000000009', 1, 'Riyadh HQ',              'Olaya St',            24.6948, 46.6857, '20000000-0000-4000-8000-000000000001', null, 0, '16:00', 0, null, null),
  ('60000000-0000-4000-8000-000000000009', 2, 'Chamber of Commerce',    'King Fahd Rd, Riyadh', 24.7270, 46.6670, null, null, 0, '16:20', 20, 5.5, 20),
  ('60000000-0000-4000-8000-000000000010', 1, 'Al Yasmin Site',         'Al Yasmin',           24.8236, 46.6407, '20000000-0000-4000-8000-000000000002', null, 0, '13:30', 0, null, null),
  ('60000000-0000-4000-8000-000000000010', 2, 'RUH Terminal 2 · Arrivals', 'King Khalid Intl', 24.9576, 46.6988, null, '30000000-0000-4000-8000-000000000001', 0, '14:05', 45, 24.0, 35),
  ('60000000-0000-4000-8000-000000000011', 1, 'Al Yasmin Site',         'Al Yasmin',           24.8236, 46.6407, '20000000-0000-4000-8000-000000000002', null, 1, '05:10', 0, null, null),
  ('60000000-0000-4000-8000-000000000011', 2, 'RUH Terminal 1 · Arrivals', 'King Khalid Intl', 24.9576, 46.6988, null, '30000000-0000-4000-8000-000000000001', 1, '05:45', 45, 24.0, 35),
  ('60000000-0000-4000-8000-000000000012', 1, 'Riyadh HQ',              'Olaya St',            24.6948, 46.6857, '20000000-0000-4000-8000-000000000001', null, 1, '10:00', 0, null, null),
  ('60000000-0000-4000-8000-000000000012', 2, 'Riyad Bank — King Fahd Rd', 'King Fahd Rd',     24.7136, 46.6753, null, null, 1, '10:15', 45, 6.0, 15),
  ('60000000-0000-4000-8000-000000000013', 1, 'Riyadh HQ',              'Olaya St',            24.6948, 46.6857, '20000000-0000-4000-8000-000000000001', null, 1, '08:00', 10, null, null),
  ('60000000-0000-4000-8000-000000000013', 2, 'Al Yasmin Site',         'Al Yasmin',           24.8236, 46.6407, '20000000-0000-4000-8000-000000000002', null, 1, '08:40', 20, 24.5, 30),
  ('60000000-0000-4000-8000-000000000014', 1, 'Dammam Site',            'King Saud St',        26.4207, 50.0888, '20000000-0000-4000-8000-000000000003', null, 1, '09:30', 0, null, null),
  ('60000000-0000-4000-8000-000000000014', 2, 'Dammam Municipality',    'Dammam',              26.4392, 50.1033, null, null, 1, '09:50', 30, 4.5, 20)
) as t(task_id, seq, label, address, lat, lng, site_id, airport_id, day_offset, at, dwell, km, mins);

insert into flight_details (task_id, airport_id, direction, airline, flight_no, terminal, scheduled_time, buffer_min, flight_status) values
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'arrival',   'Saudia',         'SV 1234', '1',     pg_temp.ksa(pg_temp.today(), '14:00'),     30, 'scheduled'),
  ('60000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002', 'arrival',   'EgyptAir',       'MS 691',  null,    pg_temp.ksa(pg_temp.today(), '15:00'),     10, 'scheduled'),
  ('60000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000003', 'departure', 'flynas',         'XY 210',  'North', pg_temp.ksa(pg_temp.today(), '15:40'),     90, 'scheduled'),
  ('60000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000001', 'arrival',   'Emirates',       'EK 817',  '2',     pg_temp.ksa(pg_temp.today(), '14:30'),     30, 'scheduled'),
  ('60000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000001', 'arrival',   'Qatar Airways',  'QR 1146', '1',     pg_temp.ksa(pg_temp.today() + 1, '06:10'), 30, 'scheduled');

-- assignments (triggers: status → assigned, task_assigned notification, conflicts)
insert into task_assignments (task_id, driver_id, vehicle_id, assigned_by) values
  ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003'),
  ('60000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003'),
  ('60000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000003', null,                                   '10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000004', null,                                   '10000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002');

-- drive today's statuses through the state machine, as each driver
do $$
declare
  c_ahmed  constant uuid := '10000000-0000-4000-8000-000000000011';
  c_khalid constant uuid := '10000000-0000-4000-8000-000000000012';
  c_yousef constant uuid := '10000000-0000-4000-8000-000000000013';
  c_fahad  constant uuid := '10000000-0000-4000-8000-000000000014';
begin
  -- Ahmed: shuttle done; escort acknowledged; SV 1234 under way then flight delayed +40.
  -- (Acknowledge resets the driver's live status to idle, so it must come before the delay.)
  perform pg_temp.act_as(c_ahmed);
  perform rpc_task_transition('60000000-0000-4000-8000-000000000003', 'acknowledge');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000001', 'acknowledge');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000001', 'start', '{"odometer_km":71450}');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000001', 'complete', '{"odometer_km":71475}');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000002', 'acknowledge');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000002', 'start', '{"lat":24.6948,"lng":46.6857}');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000002', 'delay',
          '{"reason":"flight_delayed","delay_min":40,"note":"Saudia updated ETA","lat":24.9550,"lng":46.6990}');

  -- Khalid: delivery done; DMM trip left unacknowledged (dispatcher alert)
  perform pg_temp.act_as(c_khalid);
  perform rpc_task_transition('60000000-0000-4000-8000-000000000004', 'acknowledge');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000004', 'start');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000004', 'complete', '{"distance_km":14.6,"notes":"Receipt photographed"}');

  -- Yousef: escort under way; the overlapping JED departure is still only assigned
  perform pg_temp.act_as(c_yousef);
  perform rpc_task_transition('60000000-0000-4000-8000-000000000006', 'acknowledge');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000006', 'start');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000006', 'arrive');

  -- Fahad: rounds done; afternoon delivery acknowledged
  perform pg_temp.act_as(c_fahad);
  perform rpc_task_transition('60000000-0000-4000-8000-000000000008', 'acknowledge');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000008', 'start');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000008', 'complete', '{"distance_km":26.4}');
  perform rpc_task_transition('60000000-0000-4000-8000-000000000009', 'acknowledge');

  -- last known positions for the live map (Ahmed waiting at RUH, Yousef at the bank, …)
  perform pg_temp.act_as(c_ahmed);
  perform rpc_report_location(24.9550, 46.6990, 8, 0, 90, 76, '60000000-0000-4000-8000-000000000002');
  perform pg_temp.act_as(c_khalid);
  perform rpc_report_location(26.4250, 50.0900, 12, 0, 0, 54, null);
  perform pg_temp.act_as(c_yousef);
  perform rpc_report_location(21.5497, 39.1622, 10, 0, 180, 63, '60000000-0000-4000-8000-000000000006');
  perform pg_temp.act_as(c_fahad);
  perform rpc_report_location(24.6950, 46.6860, 6, 0, 0, 91, null);

  perform set_config('request.jwt.claims', '', false);
end $$;

-- the RPC stamps actuals with now(); place today's finished work at realistic times
update tasks t set actual_start_at = pg_temp.ksa(pg_temp.today(), x.s), actual_end_at = pg_temp.ksa(pg_temp.today(), x.e)
from (values
  ('60000000-0000-4000-8000-000000000001'::uuid, '08:02', '09:58'),
  ('60000000-0000-4000-8000-000000000004'::uuid, '09:05', '10:20'),
  ('60000000-0000-4000-8000-000000000008'::uuid, '07:58', '10:05')
) as x(id, s, e)
where t.id = x.id;
update tasks set actual_start_at = pg_temp.ksa(pg_temp.today(), '12:47') where id = '60000000-0000-4000-8000-000000000002';
update tasks set actual_start_at = pg_temp.ksa(pg_temp.today(), '10:32') where id = '60000000-0000-4000-8000-000000000006';

select fn_refresh_driver_day_summary(d.id, pg_temp.today()) from drivers d;

-- Al Yasmin's EK 817 is deliberately NOT linked to Ahmed's SV 1234: the share
-- hint (FR-15, fn_similar_airport_trips) should surface it in the UI.

-- recompute conflicts for every live task so both sides of an overlap carry the badge;
-- warnings raised while history was being assigned are moot once the work is done
select fn_refresh_task_conflicts(id) from tasks where status not in ('completed', 'cancelled');
update task_conflicts c set resolved_at = now()
from tasks t where t.id = c.task_id and t.status in ('completed', 'cancelled') and c.resolved_at is null;

-- ---------------------------------------------------------------------
-- staff inbox (dispatcher alerts the watchdog would raise)
-- ---------------------------------------------------------------------
insert into notifications (company_id, user_id, type, task_id, title, body, data, channels, created_at)
select '00000000-0000-4000-8000-000000000001', n.user_id::uuid, n.type::notification_type, n.task_id::uuid, n.title, n.body,
       n.data::jsonb, '{in_app,push}', now() - make_interval(mins => n.ago)
from (values
  ('10000000-0000-4000-8000-000000000002', 'task_delayed',            '60000000-0000-4000-8000-000000000002', 'SV 1234 delayed +40 min', 'Ahmed Saleh reported a flight delay', '{"delay_min":40,"reason":"flight_delayed"}', 3),
  ('10000000-0000-4000-8000-000000000002', 'airport_share_hint',      '60000000-0000-4000-8000-000000000010', 'Share RUH trip with SV 1234', 'Ahmed Saleh is at RUH 30 min earlier', '{"related_task_id":"60000000-0000-4000-8000-000000000002","minutes_apart":30}', 12),
  ('10000000-0000-4000-8000-000000000001', 'conflict_detected',       '60000000-0000-4000-8000-000000000007', 'Yousef Rashid double-booked', 'Escort · Al Rajhi Bank overlaps JED · XY 210', '{"type":"driver_overlap"}', 25),
  ('10000000-0000-4000-8000-000000000001', 'task_delayed',            '60000000-0000-4000-8000-000000000002', 'SV 1234 delayed +40 min', 'Ahmed Saleh reported a flight delay', '{"delay_min":40,"reason":"flight_delayed"}', 3),
  ('10000000-0000-4000-8000-000000000003', 'driver_not_acknowledged', '60000000-0000-4000-8000-000000000005', 'Khalid Mansour has not acknowledged', 'DMM arrival · MS 691', '{"driver_id":"40000000-0000-4000-8000-000000000002"}', 40),
  ('10000000-0000-4000-8000-000000000001', 'driver_not_acknowledged', '60000000-0000-4000-8000-000000000005', 'Khalid Mansour has not acknowledged', 'DMM arrival · MS 691', '{"driver_id":"40000000-0000-4000-8000-000000000002"}', 40),
  ('10000000-0000-4000-8000-000000000002', 'task_completed',          '60000000-0000-4000-8000-000000000001', 'Office shuttle completed', 'Ahmed Saleh · 09:58', '{}', 200)
) as n(user_id, type, task_id, title, body, data, ago);
