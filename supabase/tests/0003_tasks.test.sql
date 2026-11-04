-- pgTAP — run with `pnpm db:test` (needs the seed loaded).
-- Covers 0003: conflict preview (US-03), rpc_save_task + the FR-14 conflict
-- gate, reschedule (US-14), admin override, cross-site shared trips (FR-15)
-- and the tenant check added to fn_check_task_conflicts. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- HH:MM on today + n days in Riyadh (the seed's company timezone)
create function pg_temp.ksa(p_day int, p_time text) returns timestamptz
language sql stable as $$ select (((now() at time zone 'Asia/Riyadh')::date + p_day) + p_time::time) at time zone 'Asia/Riyadh' $$;

-- a payload for rpc_save_task: RHQ → SAB Bank escort
create function pg_temp.escort(p_title text, p_day int, p_start text, p_end text, p_driver uuid, p_reason text default null)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'site_id', '20000000-0000-4000-8000-000000000001', 'category', 'escort', 'title', p_title,
    'scheduled_start', pg_temp.ksa(p_day, p_start), 'scheduled_end', pg_temp.ksa(p_day, p_end),
    'estimated_duration_min', 60, 'passengers', '[{"name":"Test Passenger"}]'::jsonb,
    'stops', jsonb_build_array(
      jsonb_build_object('label', 'Riyadh HQ', 'lat', 24.6948, 'lng', 46.6857, 'site_id', '20000000-0000-4000-8000-000000000001',
                         'planned_arrival_at', pg_temp.ksa(p_day, p_start)),
      jsonb_build_object('label', 'SAB Bank', 'lat', 24.711, 'lng', 46.6745, 'dwell_min', 30,
                         'planned_arrival_at', pg_temp.ksa(p_day, p_start) + interval '15 min')),
    'driver_id', p_driver, 'override_reason', p_reason)
$$;

-- another tenant, created as postgres, to probe isolation
insert into companies (id, name) values ('99999999-0000-4000-8000-0000000000c1', 'Other Co');
insert into sites (id, company_id, name, lat, lng) values
  ('99999999-0000-4000-8000-0000000000c2', '99999999-0000-4000-8000-0000000000c1', 'Other Site', 24.7, 46.7);
insert into tasks (id, company_id, site_id, category, title, scheduled_start) values
  ('99999999-0000-4000-8000-0000000000c3', '99999999-0000-4000-8000-0000000000c1',
   '99999999-0000-4000-8000-0000000000c2', 'escort', 'Other tenant trip', now() + interval '1 day');

-- ---------------------------------------------------------------------
-- 1. dispatcher (Nawaf, RHQ + Al Yasmin): preview + tenant isolation
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);

select ok(exists(
  select 1 from rpc_preview_task_conflicts(array['40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004']::uuid[],
                                           pg_temp.ksa(0, '13:00'), pg_temp.ksa(0, '14:00'))
  where driver_id = '40000000-0000-4000-8000-000000000001' and type = 'driver_overlap' and severity = 'blocking'),
  'US-03: preview flags Ahmed as double-booked against his 12:45 RUH pickup');
select ok(not exists(
  select 1 from rpc_preview_task_conflicts(array['40000000-0000-4000-8000-000000000004']::uuid[],
                                           pg_temp.ksa(0, '13:00'), pg_temp.ksa(0, '14:00'))
  where severity = 'blocking'),
  '… while Fahad is free at 13:00');
select ok(exists(
  select 1 from rpc_preview_task_conflicts(array['40000000-0000-4000-8000-000000000004']::uuid[],
                                           pg_temp.ksa(8, '10:00'), pg_temp.ksa(8, '11:00'))
  where type = 'driver_unavailable'),
  'preview reports Fahad''s annual leave next week');
select throws_ok($$select * from rpc_preview_task_conflicts(array[]::uuid[], now(), now() - interval '1 hour')$$,
                 null, 'tasks.errors.endBeforeStart', 'preview rejects an end before the start');
select throws_ok($$select * from fn_conflicts_for('99999999-0000-4000-8000-0000000000c1', null, null, now(), now() + interval '1 hour')$$,
                 '42501', null, 'the raw conflict engine is not callable by clients');
select throws_ok($$select * from fn_check_task_conflicts('99999999-0000-4000-8000-0000000000c3', '40000000-0000-4000-8000-000000000001')$$,
                 '42501', null, 'fn_check_task_conflicts refuses another tenant''s task (0001 leaked its schedule)');

-- ---------------------------------------------------------------------
-- 2. rpc_save_task: create, conflict gate, scope
-- ---------------------------------------------------------------------
select lives_ok($$select rpc_save_task(pg_temp.escort('T-free', 2, '10:00', '11:00', '40000000-0000-4000-8000-000000000004'))$$,
                'FR-10: a dispatcher saves an escort with stops and a free driver');
reset role;
select is((select status::text from tasks where title = 'T-free'), 'assigned', 'the new task is assigned …');
select is((select count(*)::int from task_stops s join tasks t on t.id = s.task_id where t.title = 'T-free'), 2, '… with both stops …');
select ok(exists(select 1 from notifications n join tasks t on t.id = n.task_id
                 where t.title = 'T-free' and n.type = 'task_assigned' and n.user_id = '10000000-0000-4000-8000-000000000014'),
          '… and Fahad is notified (FR-20)');
select ok(exists(select 1 from task_events e join tasks t on t.id = e.task_id where t.title = 'T-free' and e.type = 'created'),
          'a created event is recorded');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select throws_ok($$select rpc_save_task(pg_temp.escort('T-clash', 0, '13:00', '14:00', '40000000-0000-4000-8000-000000000001'))$$,
                 null, 'conflicts.errors.blocking', 'FR-14: a double booking without a reason is refused');
select throws_ok($$select rpc_save_task(pg_temp.escort('T-clash', 0, '13:00', '14:00', '40000000-0000-4000-8000-000000000001', 'VIP'))$$,
                 null, 'conflicts.errors.adminOnly', '… and a dispatcher cannot override it');
select is((select count(*)::int from tasks where title = 'T-clash'), 0, '… and nothing was written');
select throws_ok($$select rpc_save_task(pg_temp.escort('T-scope', 2, '10:00', '11:00', null)
                                        || '{"site_id":"20000000-0000-4000-8000-000000000003"}')$$,
                 '42501', null, 'a dispatcher cannot create work for a site outside their scope');
select throws_ok($$select rpc_save_task(pg_temp.escort('T-tenant', 2, '10:00', '11:00', null)
                                        || '{"site_id":"99999999-0000-4000-8000-0000000000c2"}')$$,
                 null, 'errors.invalidInput', '… nor for another tenant''s site');

-- ---------------------------------------------------------------------
-- 3. owner (Majed) overrides with a reason
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);
select lives_ok($$select rpc_save_task(pg_temp.escort('T-clash', 0, '13:00', '14:00', '40000000-0000-4000-8000-000000000001', 'VIP visit'))$$,
                'an owner may override a blocking conflict with a reason');
reset role;
select ok((select conflicts_overridden and override_reason = 'VIP visit' from tasks where title = 'T-clash'),
          'the override and its reason are stored');
select ok(exists(select 1 from task_conflicts c join tasks t on t.id = c.other_task_id
                 where c.task_id = '60000000-0000-4000-8000-000000000002' and t.title = 'T-clash' and c.resolved_at is null),
          'the other side of the double booking (SV 1234) now shows the conflict too');
select ok(exists(select 1 from task_events e join tasks t on t.id = e.task_id where t.title = 'T-clash' and e.type = 'conflict_overridden'),
          'the override is audited');

-- ---------------------------------------------------------------------
-- 4. edit + reschedule (dispatcher)
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select lives_ok($$select rpc_save_task(pg_temp.escort('T-free', 2, '10:00', '11:00', null)
                                       || jsonb_build_object('id', (select id from tasks where title = 'T-free')))$$,
                'editing a task to drop the driver');
reset role;
select is((select status::text || '/' || (select count(*) from task_assignments a where a.task_id = t.id)::text from tasks t where title = 'T-free'),
          'scheduled/0', '… returns it to the pool');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select lives_ok($$select rpc_reschedule_task((select id from tasks where title = 'T-free'), pg_temp.ksa(2, '11:30'),
                                             '40000000-0000-4000-8000-000000000004', true)$$,
                'US-14: dragging the task to 11:30 on Fahad''s row');
reset role;
select is((select scheduled_end - scheduled_start from tasks where title = 'T-free'), interval '1 hour', 'the duration is kept');
select is((select planned_arrival_at from task_stops s join tasks t on t.id = s.task_id where t.title = 'T-free' and s.seq = 2),
          pg_temp.ksa(2, '11:45'), 'stop arrival times move with the task');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select throws_ok($$select rpc_reschedule_task((select id from tasks where title = 'T-free'), pg_temp.ksa(8, '10:00'))$$,
                 null, 'conflicts.errors.blocking', 'dropping it into Fahad''s leave is refused');
select throws_ok($$select rpc_override_task_conflicts('60000000-0000-4000-8000-000000000007', 'ok')$$,
                 null, 'conflicts.errors.adminOnly', 'only admins override from the task sheet');

-- ---------------------------------------------------------------------
-- 5. FR-15 shared trip: Al Yasmin's EK 817 rides with Ahmed's SV 1234
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003"}', true);
select throws_ok($$select rpc_share_trip('60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000002')$$,
                 '42501', null, 'the Dammam dispatcher cannot share an Al Yasmin task');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select throws_ok($$select rpc_share_trip('60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000005')$$,
                 null, 'share.errors.invalid', 'a trip to another airport cannot be shared');
select lives_ok($$select rpc_share_trip('60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000002')$$,
                'US-04: the dispatcher merges EK 817 into the SV 1234 trip');
reset role;
select ok((select metadata->>'shared_with' = '60000000-0000-4000-8000-000000000002'
                  and exists(select 1 from task_links where task_id = t.id and relation = 'shared_ride')
           from tasks t where id = '60000000-0000-4000-8000-000000000010')
          and (select passengers @> '[{"name":"Mr. David Lee"}]' from tasks where id = '60000000-0000-4000-8000-000000000002'),
          'the rider is linked and its passenger travels in the host car');

-- the rider follows the host to completion (the seed's 12:47 start may still
-- be in the future when the suite runs in the morning)
update tasks set actual_start_at = now() - interval '1 hour' where id = '60000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011"}', true);
set local role authenticated;
select rpc_task_transition('60000000-0000-4000-8000-000000000002', 'complete', '{}', gen_random_uuid());
reset role;
select is((select status::text from tasks where id = '60000000-0000-4000-8000-000000000010'), 'completed',
          'completing the host completes the shared rider');

select * from finish();
rollback;
