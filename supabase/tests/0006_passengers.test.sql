-- pgTAP — run with `pnpm db:test` (needs the seed loaded).
-- Covers 0006 (passenger module, phase 1): isolation of passengers from
-- staff data, the scoped trip view, registration + approval, rating rules
-- (one per trip, finished trips only, single-choice groups, edit window,
-- low-rating alerts, anonymity to drivers) and passenger document access.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- sign-ups used below (as postgres): an outsider, a masar.dev employee, Karim (join code)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
                        raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '99999999-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'stranger@gmail.com', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99999999-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', 'omar.new@masar.dev', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99999999-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated', 'karim@gmail.com', '', now(), '{}', '{}', now(), now(), '', '', '', '');

-- copies on Sara's trips: one visible, one internal
update task_attachments set storage_path = '00000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000016/hotel.pdf'
where title = 'Hilton Jeddah booking';
update task_attachments set storage_path = '00000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000016/approval.pdf'
where title = 'Travel approval (internal)';
insert into storage.objects (bucket_id, name) values
  ('task-attachments', '00000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000016/hotel.pdf'),
  ('task-attachments', '00000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000016/approval.pdf'),
  ('task-attachments', '00000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000004/receipt.jpg');

set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. Sara (approved passenger) is kept out of staff data
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000021"}', true);
select is((select count(*)::int from tasks), 0, 'a passenger cannot read the tasks table');
select is((select count(*)::int from drivers), 0, '… nor drivers (phone numbers stay private)');
select is((select count(*)::int from driver_locations), 0, '… nor driver locations');
select is((select count(*)::int from people), 1, '… and sees only their own directory row');
select is((select count(*)::int from profiles), 1, '… and only their own profile');
select is((select count(*)::int from company_settings), 0, '… and no company settings');
select is((select count(*)::int from driver_documents), 0, '… and no driver documents');
select is((select count(*)::int from trip_ratings), 0, 'Sara has not rated anything yet');

select is(jsonb_array_length(rpc_passenger_home()->'trips'), 3, 'her trip view lists her three trips');
select ok(not exists (select 1 from jsonb_array_elements(rpc_passenger_home()->'trips') t where t->'driver' ? 'phone'),
          'the driver card never carries a phone number');
select is((select t->'driver'->'licence'->>'name' from jsonb_array_elements(rpc_passenger_home()->'trips') t
           where t->>'id' = '60000000-0000-4000-8000-000000000016'), 'Light vehicle driving licence',
          'the driver card names the licence the driver holds');
select is((select jsonb_array_length(t->'documents') from jsonb_array_elements(rpc_passenger_home()->'trips') t
           where t->>'id' = '60000000-0000-4000-8000-000000000016'), 2, 'only documents marked for passengers are listed');
select is((select array_agg(name order by name) from storage.objects where bucket_id = 'task-attachments'),
          array['00000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000016/hotel.pdf'],
          'storage: Sara opens the visible copy on her trip and nothing else');
update people set grade = 20 where profile_id = auth.uid();
select is((select grade from people where profile_id = auth.uid()), 14, 'a passenger cannot change their own grade');
select lives_ok($$select rpc_update_my_profile('{"language":"ar","ride_preferences":["ac"],"accessibility_needs":"Wheelchair"}')$$,
                '… but updates their preferences');

-- ---------------------------------------------------------------------
-- 2. ratings
-- ---------------------------------------------------------------------
select throws_ok($$select rpc_submit_rating('60000000-0000-4000-8000-000000000002', 4)$$,
                 null, 'rating.errors.notFinished', 'a trip can be rated only once it has finished');
select throws_ok($$select rpc_submit_rating('60000000-0000-4000-8000-000000000017', 4)$$,
                 '42501', null, 'nobody rates a trip they were not on');
select throws_ok($$select rpc_submit_rating('60000000-0000-4000-8000-000000000015', 4,
                   array(select id from rating_options where category = 'driving' and code in ('smooth','speeding')))$$,
                 null, 'rating.errors.oneChoice', 'single-choice groups take one answer');
select throws_ok($$select rpc_submit_rating('60000000-0000-4000-8000-000000000015', 6)$$, null, 'rating.errors.stars', 'stars run 1–5');
select lives_ok($$select rpc_submit_rating('60000000-0000-4000-8000-000000000015', 4,
                  array(select id from rating_options where (category, code) in (('driving','phone'), ('cleanliness','clean'), ('cleanliness','odor'))),
                  'Driver was on the phone at the roundabout')$$,
                'Sara rates yesterday''s ride (phone use, two cleanliness notes)');
select lives_ok($$select rpc_submit_rating('60000000-0000-4000-8000-000000000015', 3,
                  array(select id from rating_options where (category, code) in (('driving','phone'))))$$,
                '… and can edit it within the window');
select is((select count(*)::int from trip_ratings), 1, 'still one rating per passenger per trip');
select throws_ok($$insert into trip_ratings (company_id, task_id, person_id, stars, editable_until)
                   values ('00000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000016', '13000000-0000-4000-8000-000000000001', 5, now())$$,
                 '42501', null, 'ratings are written only through rpc_submit_rating');

reset role;
select ok((select is_low from trip_ratings where task_id = '60000000-0000-4000-8000-000000000015'),
          '"Phone use while driving" makes it a low rating');
select is((select count(*)::int from notifications where type::text = 'low_rating'
           and data->>'rating_id' = (select id::text from trip_ratings where task_id = '60000000-0000-4000-8000-000000000015')), 1,
          '… which alerts the owner once (not again on edit)');
update trip_ratings set editable_until = now() - interval '1 minute' where task_id = '60000000-0000-4000-8000-000000000015';
set local role authenticated;
select throws_ok($$select rpc_submit_rating('60000000-0000-4000-8000-000000000015', 5)$$,
                 null, 'rating.errors.locked', 'after the edit window the rating is locked');

-- anonymity: drivers and dispatchers see no rating rows, only the averages
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011"}', true);
select is((select count(*)::int from trip_ratings), 0, 'Ahmed cannot see who rated him');
select is((select ratings from fn_driver_rating('40000000-0000-4000-8000-000000000001')), 1, '… only his rating count and averages');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select is((select count(*)::int from trip_ratings), 0, 'dispatchers do not see rater identities either');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);
select is((select count(*)::int from trip_ratings), 2, 'the owner sees every rating with its passenger');

-- ---------------------------------------------------------------------
-- 3. registration + approval
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-0000000000e1"}', true);
select throws_ok($$select rpc_passenger_register('Stranger')$$, null, 'passenger.errors.domain', 'an outside e-mail domain cannot join');
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-0000000000e3"}', true);
select is(rpc_passenger_register('Karim Haddad', null, 'E-1005', 'masar-2026'), 'pending',
          'join code + employee ID links Karim to his directory entry, pending');
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-0000000000e2"}', true);
select is(rpc_passenger_register('Omar New'), 'pending', 'a company e-mail domain registers a new person, pending');
select is(rpc_passenger_home()->>'status', 'pending', '… who sees no trip data until approved');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select throws_ok($$select rpc_review_registration('13000000-0000-4000-8000-000000000011', true)$$,
                 '42501', null, 'a dispatcher cannot approve registrations');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);
select lives_ok($$select rpc_review_registration('13000000-0000-4000-8000-000000000011', true)$$, 'the owner approves Laila');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000022"}', true);
select is(rpc_passenger_home()->>'status', 'approved', '… who now sees her trips view');

select * from finish();
rollback;
