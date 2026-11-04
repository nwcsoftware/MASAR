-- pgTAP — run with `pnpm db:test` (needs the seed loaded).
-- Covers 0007 (passenger module, phase 2): passenger notifications, live
-- tracking scope, share links (anonymous, die with the trip), check-in codes
-- hidden from drivers + lockout, drop-off auto-complete, SOS fan-out and
-- handling, trip requests (validation, routing, approve / reject).
begin;
create extension if not exists pgtap with schema extensions;
select plan(58);

-- today's RUH pickup (T2, Sara, Ahmed, delayed) happens "now"; Ahmed's position is fresh
update tasks set scheduled_start = now() - interval '30 minutes', scheduled_end = now() + interval '90 minutes'
where id = '60000000-0000-4000-8000-000000000002';
update driver_locations set recorded_at = now() - interval '1 minute'
where driver_id = '40000000-0000-4000-8000-000000000001' and task_id = '60000000-0000-4000-8000-000000000002';

set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. Sara: notifications, codes, live view
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000021"}', true);
select ok(exists (select 1 from notifications where type::text = 'passenger_trip_assigned'
                  and task_id = '60000000-0000-4000-8000-000000000016'), 'Sara was told about her Jeddah trip');
select ok((select t->'checkin'->>'code' from jsonb_array_elements(rpc_passenger_home()->'trips') t
           where t->>'id' = '60000000-0000-4000-8000-000000000002') ~ '^\d{6}$', 'her pickup has a six-digit check-in code');
select ok(rpc_passenger_live('60000000-0000-4000-8000-000000000002')->'location' is not null, 'she sees the driver on her active trip');
select ok(rpc_passenger_live('60000000-0000-4000-8000-000000000002')->>'eta_at' is not null, '… with an ETA');
select ok(rpc_passenger_live('60000000-0000-4000-8000-000000000016')->'location' = 'null'::jsonb, 'no position for a trip in three days');
select throws_ok($$select rpc_passenger_live('60000000-0000-4000-8000-000000000006')$$, '42501', 'errors.forbidden',
                 'nor for someone else''s trip');

-- share link
create temp table _tok on commit drop as select rpc_create_share_link('60000000-0000-4000-8000-000000000002') as token;
grant select on _tok to anon;
select is(rpc_create_share_link('60000000-0000-4000-8000-000000000002'), (select token from _tok), 'one live link per trip');
select is(length((select token from _tok)), 64, 'the token is long and random');
select throws_ok($$select rpc_create_share_link('60000000-0000-4000-8000-000000000015')$$, null, 'share.errors.tripEnded',
                 'no link for a finished trip');

-- ---------------------------------------------------------------------
-- 2. anonymous viewers
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
set local role anon;
select is(rpc_shared_trip((select token from _tok))->>'state', 'active', 'anyone with the link sees the trip');
select ok(rpc_shared_trip((select token from _tok))->'location' is not null, '… and the car on the map');
select ok(rpc_shared_trip((select token from _tok))::text !~ '(Sara|\+966)', '… but no names or phone numbers');
select is(rpc_shared_trip('nope')->>'state', 'invalid', 'a made-up token shows nothing');
select throws_ok($$select count(*) from trip_share_links$$, '42501', null, 'anon cannot list links');
set local role authenticated;

-- ---------------------------------------------------------------------
-- 3. check-in: drivers never see codes; wrong codes are counted
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000021"}', true);
create temp table _code on commit drop as
  select t->'checkin'->>'code' as code from jsonb_array_elements(rpc_passenger_home()->'trips') t
  where t->>'id' = '60000000-0000-4000-8000-000000000002';

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011"}', true); -- Ahmed
select throws_ok($$select checkin_code from task_passengers$$, '42501', null, 'the driver cannot read check-in codes');
select is((select count(*)::int from task_passengers where task_id = '60000000-0000-4000-8000-000000000002'), 1,
          '… but sees who to pick up');
select is(rpc_driver_check_in('60000000-0000-4000-8000-000000000002', '000000')->>'error', 'checkin.errors.invalid', 'a wrong code is refused');
select is(rpc_driver_check_in('60000000-0000-4000-8000-000000000016', (select code from _code))->>'error', 'checkin.errors.notActive',
          'no check-in three days early');
select is(rpc_driver_check_in('60000000-0000-4000-8000-000000000002', (select code from _code))->>'ok', 'true', 'the right code checks Sara in');
select is((select status::text from tasks where id = '60000000-0000-4000-8000-000000000002'), 'in_progress',
          'check-in moves the trip to "in progress"');
select ok((select checked_in_at is not null from task_passengers where task_id = '60000000-0000-4000-8000-000000000002'),
          '… and records the pickup time');
select is(rpc_driver_check_in('60000000-0000-4000-8000-000000000002', (select code from _code))->>'error', 'checkin.errors.already',
          'checking in twice is refused');
select is(rpc_driver_check_in('60000000-0000-4000-8000-000000000002', null, null, null,
          (select id from task_passengers where task_id = '60000000-0000-4000-8000-000000000002'))->>'error', 'checkin.errors.codeRequired',
          'a passenger with the app cannot be checked in without their code');
select rpc_driver_check_in('60000000-0000-4000-8000-000000000002', '111111') from generate_series(1, 3);
select is(rpc_driver_check_in('60000000-0000-4000-8000-000000000002', '222222')->>'error', 'checkin.errors.locked',
          'five wrong codes in ten minutes lock check-in');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000012"}', true); -- Khalid
select throws_ok($$select rpc_driver_check_in('60000000-0000-4000-8000-000000000002', '123456')$$, '42501', 'errors.forbidden',
                 'another driver cannot check passengers in');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true); -- Nawaf (dispatcher)
select throws_ok($$select rpc_driver_check_in('60000000-0000-4000-8000-000000000002', '123456')$$, '42501', 'errors.forbidden',
                 'nor can a dispatcher');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000021"}', true);
select ok(exists (select 1 from notifications where type::text = 'driver_arrived' and task_id = '60000000-0000-4000-8000-000000000002'),
          'Sara was told her driver arrived');
select is((select t->'checkin'->>'code' from jsonb_array_elements(rpc_passenger_home()->'trips') t
           where t->>'id' = '60000000-0000-4000-8000-000000000002'), null, 'the code disappears once used');

-- ---------------------------------------------------------------------
-- 4. SOS
-- ---------------------------------------------------------------------
select is(jsonb_array_length(rpc_passenger_sos('60000000-0000-4000-8000-000000000002', 24.80, 46.65, 15, 'Car stopped on the highway')
                             ->'emergency_contacts'), 1, 'SOS returns her emergency contacts');
select lives_ok($$select rpc_passenger_sos('60000000-0000-4000-8000-000000000002', 24.81, 46.66, 10, null)$$, 'pressing again refreshes the location');
select is((select count(*)::int from sos_events), 1, '… without a second alert');
select is((select lat from sos_events), 24.81::double precision, '… and with the newer position');
select throws_ok($$select rpc_passenger_sos('60000000-0000-4000-8000-000000000016', 24.8, 46.6)$$, null, 'sos.errors.notActive',
                 'SOS needs an active trip');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true); -- owner
select is((select count(*)::int from notifications where type::text = 'sos_alert'), 1, 'the owner is alerted');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003"}', true); -- Huda, Dammam only
select is((select count(*)::int from notifications where type::text = 'sos_alert'), 0, 'a dispatcher of another site is not');
select is((select count(*)::int from sos_events), 0, '… and cannot read the event');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011"}', true); -- Ahmed
select is((select count(*)::int from sos_events), 0, 'the driver cannot read it either');
select throws_ok($$select rpc_sos_update((select id from sos_events limit 1), 'resolve')$$, null, null, '… nor close it');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true); -- Nawaf
select is((select count(*)::int from notifications where type::text = 'sos_alert'), 1, 'the site''s dispatcher is alerted');
select lives_ok($$select rpc_sos_update((select id from sos_events limit 1), 'acknowledge')$$, 'the dispatcher acknowledges');
select lives_ok($$select rpc_sos_update((select id from sos_events limit 1), 'resolve', 'Replacement car sent')$$, '… and resolves it');
select is((select status from sos_events), 'resolved', 'the event is closed');

-- drop-off ends the trip (Sara rides alone)
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011"}', true);
select is(rpc_driver_drop_off((select id from task_passengers where task_id = '60000000-0000-4000-8000-000000000002'))->>'completed', 'true',
          'dropping off the last passenger completes the trip');
select is((select status::text from tasks where id = '60000000-0000-4000-8000-000000000002'), 'completed', '… on its own');

set local role anon;
select set_config('request.jwt.claims', '', true);
select is(rpc_shared_trip((select token from _tok))->>'state', 'ended', 'the share link dies with the trip');
set local role authenticated;

-- ---------------------------------------------------------------------
-- 5. trip requests
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000021"}', true);
select lives_ok($$select rpc_passenger_request(jsonb_build_object('kind', 'reschedule', 'task_id', '60000000-0000-4000-8000-000000000016',
                  'requested_start', (now() + interval '4 days')::text, 'notes', 'Meeting moved'))$$, 'Sara asks to move her Jeddah trip');
select throws_ok($$select rpc_passenger_request(jsonb_build_object('kind', 'reschedule', 'task_id', '60000000-0000-4000-8000-000000000016',
                   'requested_start', (now() + interval '5 days')::text))$$, null, 'requests.errors.duplicate', 'one pending request per trip');
select throws_ok($$select rpc_passenger_request('{"kind":"cancel","task_id":"60000000-0000-4000-8000-000000000015"}')$$, null,
                 'requests.errors.tooLate', 'a finished trip cannot be cancelled');
select throws_ok($$select rpc_passenger_request(jsonb_build_object('kind', 'new', 'requested_start', (now() + interval '1 day')::text))$$,
                 null, 'requests.errors.places', 'a new trip needs pickup and drop-off');
select throws_ok($$insert into trip_requests (company_id, person_id, kind) values ('00000000-0000-4000-8000-000000000001',
                   '13000000-0000-4000-8000-000000000001', 'new')$$, '42501', null, 'requests go through the RPC only');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003"}', true); -- Huda
select is((select count(*)::int from trip_requests), 0, 'a dispatcher of another site does not see the request');
select throws_ok($$select rpc_decide_request((select id from trip_requests where kind = 'reschedule'), true)$$, null, null, '… and cannot decide it');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true); -- Nawaf
select throws_ok($$select rpc_decide_request((select id from trip_requests where kind = 'reschedule'), false)$$, null, 'requests.errors.reasonRequired',
                 'a rejection needs a reason');
select lives_ok($$select rpc_decide_request((select id from trip_requests where kind = 'reschedule'), true, 'OK', null, 'Approved passenger request')$$,
                'the site''s dispatcher approves');
select ok((select abs(extract(epoch from scheduled_start - (now() + interval '4 days'))) < 5 from tasks
           where id = '60000000-0000-4000-8000-000000000016'), 'the trip moved to the requested time');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000021"}', true);
select is((select status from trip_requests where kind = 'reschedule'), 'approved', 'Sara sees the request approved');
select ok(exists (select 1 from notifications where type::text = 'trip_request_decided'), '… and was notified');

reset role;
select ok((select count(*) = 5 from audit_log where action in ('checked_in','dropped_off','sos_raised')
             or (table_name = 'sos_events' and action = 'sos_resolve')), 'check-in, drop-off and SOS are audited');

select * from finish();
rollback;
