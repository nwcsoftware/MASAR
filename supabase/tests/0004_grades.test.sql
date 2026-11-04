-- pgTAP — run with `pnpm db:test` (needs the seed loaded).
-- Covers 0004: grade groups (admin-only, no overlaps), the staff directory
-- (import upsert, drivers can't browse it), passenger snapshots (grades come
-- from the directory, never the client), the three grade conflicts behind the
-- FR-14 gate, and shared trips staying within one group. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create function pg_temp.ksa(p_day int, p_time text) returns timestamptz
language sql stable as $$ select (((now() at time zone 'Asia/Riyadh')::date + p_day) + p_time::time) at time zone 'Asia/Riyadh' $$;

-- an RHQ escort with the given passengers (rpc_save_task payload)
create function pg_temp.trip(p_title text, p_passengers jsonb, p_driver uuid default null, p_vehicle uuid default null, p_reason text default null)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'site_id', '20000000-0000-4000-8000-000000000001', 'category', 'escort', 'title', p_title,
    'scheduled_start', pg_temp.ksa(3, '10:00'), 'scheduled_end', pg_temp.ksa(3, '11:00'),
    'passengers', p_passengers, 'driver_id', p_driver, 'vehicle_id', p_vehicle, 'override_reason', p_reason,
    'stops', jsonb_build_array(
      jsonb_build_object('label', 'Riyadh HQ', 'lat', 24.6948, 'lng', 46.6857),
      jsonb_build_object('label', 'Bank', 'lat', 24.711, 'lng', 46.6745)))
$$;

-- people: Saad (19, A), Sara (14, B), Noura (7, C), Tariq (17, A)
-- vehicles: Camry B, Hiace C · drivers: Ahmed drives for A, Fahad for B
set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. grade groups
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select throws_ok($$select rpc_set_grade_groups('[{"code":"A","min_grade":1,"max_grade":20}]')$$,
                 '42501', null, 'a dispatcher cannot change the grade groups');
select throws_ok($$insert into grade_groups (company_id, code, rank, min_grade, max_grade)
                   values ('00000000-0000-4000-8000-000000000001', 'Z', 9, 1, 2)$$,
                 '42501', null, 'grade groups are not writable directly');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);
select throws_ok($$select rpc_set_grade_groups('[{"code":"A","min_grade":11,"max_grade":20},{"code":"B","min_grade":1,"max_grade":12}]')$$,
                 null, 'grades.errors.overlap', 'overlapping ranges are refused');
select throws_ok($$select rpc_set_grade_groups('[{"code":"A","min_grade":15,"max_grade":10}]')$$,
                 null, 'grades.errors.range', 'an inverted range is refused');
select is((select count(*)::int from rpc_set_grade_groups(
             '[{"code":"A","name":"Executives","min_grade":16,"max_grade":20},{"code":"B","min_grade":11,"max_grade":15},
               {"code":"C","min_grade":6,"max_grade":10},{"code":"D","min_grade":1,"max_grade":5}]')), 4,
          'the owner saves four groups');
select is((select g.code from vehicles v join grade_groups g on g.id = v.grade_group_id
           where v.id = '50000000-0000-4000-8000-000000000001'), 'B',
          'vehicles keep their group when its code survives the edit');

-- ---------------------------------------------------------------------
-- 2. staff directory
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select is(rpc_import_people('[{"employee_no":"E-1001","full_name":"Eng. Sara Al-Otaibi","grade":15},
                              {"employee_no":"E-2001","full_name":"Eng. New Hire","grade":9,"site":"rhq"}]'),
          '{"inserted": 1, "updated": 1}'::jsonb, 'import upserts by employee number');
select is((select s.code from people p join sites s on s.id = p.site_id where p.employee_no = 'E-2001'), 'RHQ',
          'the site column resolves by code');
select throws_ok($$select rpc_import_people('[{"employee_no":"E-2002","full_name":""}]')$$,
                 null, 'people.errors.name', 'a row without a name stops the import');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011"}', true);
select is((select count(*)::int from people), 0, 'drivers cannot browse the staff directory');

-- ---------------------------------------------------------------------
-- 3. grade rules (preview + snapshot)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select is((select array_agg(type::text) from rpc_preview_grade_conflicts(
             '[{"person_id":"13000000-0000-4000-8000-000000000007"},{"person_id":"13000000-0000-4000-8000-000000000008"}]')),
          array['grade_mixed'], 'an A and a C in one car is a mixed-grade conflict');
select is((select array_agg(type::text) from rpc_preview_grade_conflicts(
             '[{"person_id":"13000000-0000-4000-8000-000000000001"}]', '50000000-0000-4000-8000-000000000002')),
          array['vehicle_grade_mismatch'], 'a B passenger in the C group Hiace is flagged');
select is((select array_agg(type::text) from rpc_preview_grade_conflicts(
             '[{"person_id":"13000000-0000-4000-8000-000000000003"}]', null, '40000000-0000-4000-8000-000000000004')),
          array['driver_grade_not_allowed'], 'Fahad (drives for B) may not drive an A passenger');
select is((select count(*)::int from rpc_preview_grade_conflicts(
             '[{"person_id":"13000000-0000-4000-8000-000000000001"}]', '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001')),
          0, 'a B passenger in the B Camry with Ahmed (drives for A) is fine');
select is((select array_agg(type::text) from rpc_preview_grade_conflicts(
             '[{"name":"Guest","visitor":true,"group_id":"12000000-0000-4000-8000-000000000004"},{"person_id":"13000000-0000-4000-8000-000000000001"}]')),
          array['grade_mixed'], 'a one-time visitor counts in the group they were given');
select is((select x->>'group_code' from jsonb_array_elements(fn_snapshot_passengers('00000000-0000-4000-8000-000000000001',
             '[{"name":"Spoof","group_id":"12000000-0000-4000-8000-000000000001","grade":20}]')) x), null,
          'a free-text passenger cannot claim a group');

-- ---------------------------------------------------------------------
-- 4. the FR-14 gate applies to grades
-- ---------------------------------------------------------------------
select throws_ok($$select rpc_save_task(pg_temp.trip('T-mixed',
                   '[{"person_id":"13000000-0000-4000-8000-000000000007"},{"person_id":"13000000-0000-4000-8000-000000000008"}]'))$$,
                 null, 'conflicts.errors.blocking', 'saving a mixed-grade trip is refused');
select throws_ok($$select rpc_save_task(pg_temp.trip('T-mixed',
                   '[{"person_id":"13000000-0000-4000-8000-000000000007"},{"person_id":"13000000-0000-4000-8000-000000000008"}]', null, null, 'CEO request'))$$,
                 null, 'conflicts.errors.adminOnly', '… and only an admin may override it');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);
select lives_ok($$select rpc_save_task(pg_temp.trip('T-mixed',
                  '[{"person_id":"13000000-0000-4000-8000-000000000007","grade":1},{"person_id":"13000000-0000-4000-8000-000000000008"}]', null, null, 'CEO request'))$$,
                'the owner overrides with a reason');
reset role;
select is((select (passengers->0->>'grade') || (passengers->0->>'group_code') from tasks where title = 'T-mixed'), '19A',
          'the stored passenger carries the directory grade and group, not the client''s');
select ok(exists(select 1 from task_conflicts c join tasks t on t.id = c.task_id
                 where t.title = 'T-mixed' and c.type = 'grade_mixed' and c.resolved_at is null),
          'the mixed-grade conflict is materialised with the others');
select ok(exists(select 1 from task_conflicts where task_id = '60000000-0000-4000-8000-000000000012'
                 and type = 'grade_mixed' and resolved_at is null),
          'seed: tomorrow''s finance escort (A + C) carries the conflict');

-- ---------------------------------------------------------------------
-- 5. FR-15 shared trips stay within one group
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select is((select passenger_groups from fn_similar_airport_trips('30000000-0000-4000-8000-000000000001',
             (select scheduled_time from flight_details where task_id = '60000000-0000-4000-8000-000000000010'),
             '60000000-0000-4000-8000-000000000010') where task_id = '60000000-0000-4000-8000-000000000002'),
          array['B'], 'the share hint says which group rides in SV 1234');
update tasks set passengers = fn_snapshot_passengers(company_id, '[{"person_id":"13000000-0000-4000-8000-000000000007"}]')
where id = '60000000-0000-4000-8000-000000000010';
select throws_ok($$select rpc_share_trip('60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000002')$$,
                 null, 'share.errors.gradeMismatch', 'an A passenger cannot join the B trip');

select * from finish();
rollback;
