-- pgTAP — run with `pnpm supabase test db` (needs the seed loaded).
-- Covers the 0002 fixes: profile/driver column guards, company-scoped
-- user_sites, rpc_create_company, rpc_set_site_airports and the driver
-- live-status fix in rpc_task_transition. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- a fresh signup with no company yet (as postgres)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '99999999-0000-4000-8000-000000000001', 'authenticated',
        'authenticated', 'founder@other.test', '', now(), '{}', '{"full_name":"Other Founder"}', now(), now(),
        '', '', '', '');

-- ---------------------------------------------------------------------
-- 1. dispatcher (Nawaf): no self-promotion, no tenant hopping
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);

select throws_ok($$update profiles set role = 'owner' where id = auth.uid()$$,
                 '42501', null, 'a dispatcher cannot promote themselves');
select throws_ok($$update profiles set company_id = null where id = auth.uid()$$,
                 '42501', null, 'a user cannot leave or switch company');
select lives_ok($$update profiles set phone = '+966 50 999 0000', language = 'ar' where id = auth.uid()$$,
                'a user can edit their own contact details and language');
select throws_ok($$insert into companies (name) values ('Rogue Co')$$,
                 '42501', null, 'companies cannot be inserted directly');
select lives_ok($$update profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000004'$$,
                'a non-admin update of another profile is silently filtered by RLS');
reset role;
select is((select role::text from profiles where id = '10000000-0000-4000-8000-000000000004'), 'viewer',
          '… and changes nothing');

-- ---------------------------------------------------------------------
-- 2. driver (Ahmed): contact fields only; live status keeps the busiest trip
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011"}', true);

select throws_ok($$update drivers set max_daily_driving_min = 900 where profile_id = auth.uid()$$,
                 '42501', null, 'a driver cannot raise their own daily hour cap');
select throws_ok($$update drivers set licence_no = 'FAKE-1' where profile_id = auth.uid()$$,
                 '42501', null, 'a driver cannot edit their licence');
select lives_ok($$update drivers set phone = '+966 55 000 0000' where profile_id = auth.uid()$$,
                'a driver can update their own phone');
select lives_ok($$select rpc_task_transition('60000000-0000-4000-8000-000000000013', 'acknowledge')$$,
                'the driver acknowledges tomorrow''s shuttle');
reset role;
select is((select current_status::text from drivers where id = '40000000-0000-4000-8000-000000000001'), 'delayed',
          'acknowledging a later trip keeps the delayed live status (0001 reset it to idle)');

-- ---------------------------------------------------------------------
-- 3. owner (Majed) manages roles; admins cannot mint owners
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);

select lives_ok($$update profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000004'$$,
                'the owner promotes the viewer to admin');
select throws_ok($$update profiles set role = 'viewer' where id = auth.uid()$$,
                 '42501', null, 'the owner cannot change their own role');
reset role;
select is((select role::text from profiles where id = '10000000-0000-4000-8000-000000000004'), 'admin',
          'the promotion stuck');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004"}', true);
select throws_ok($$update profiles set role = 'owner' where id = '10000000-0000-4000-8000-000000000002'$$,
                 '42501', null, 'an admin cannot grant the owner role');
select lives_ok($$insert into user_sites (user_id, site_id)
                  values ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001')$$,
                'an admin scopes a dispatcher to a site of their company');

-- ---------------------------------------------------------------------
-- 4. a second company: onboarding RPC and tenant isolation
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-8000-000000000001"}', true);

select throws_ok($$select rpc_create_company('Other Co', null, 'SA', 'Mars/Olympus', 'en')$$,
                 '22023', null, 'rpc_create_company validates the time zone');
select lives_ok($$select rpc_create_company('Other Co', null, 'SA', 'Asia/Riyadh', 'en')$$,
                'a new user creates their company');
select is((select role::text from profiles where id = auth.uid()), 'owner', '… and becomes its owner');
select throws_ok($$select rpc_create_company('Second Co')$$,
                 '42501', null, 'a user cannot create a second company');
select is((select count(*)::int from sites), 0, 'the new company sees no other company''s sites');
select is((select count(*)::int from profiles), 1, '… and no other company''s people');
select throws_ok($$insert into user_sites (user_id, site_id)
                   values ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$$,
                 '42501', null, 'an owner cannot scope users of another company');

-- ---------------------------------------------------------------------
-- 5. rpc_set_site_airports (FR-03)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);

select lives_ok($$select * from rpc_set_site_airports('20000000-0000-4000-8000-000000000002',
  '[{"iata":"RUH","name":"King Khalid International Airport","lat":24.9576,"lng":46.6988,"distance_km":24.4,"drive_minutes":21},
    {"iata":"AQI","name":"Al Qaisumah Airport","lat":28.3352,"lng":46.1251,"drive_minutes":300,"is_default":true}]'::jsonb)$$,
  'a dispatcher saves a site''s airports');
select is((select string_agg(a.iata || ':' || sa.is_default, ',' order by a.iata)
             from site_airports sa join airports a on a.id = sa.airport_id
            where sa.site_id = '20000000-0000-4000-8000-000000000002'),
          'AQI:true,RUH:false', 'links are replaced and exactly the flagged airport is default');
select throws_ok($$select * from rpc_set_site_airports('20000000-0000-4000-8000-000000000002',
                   '[{"iata":"ru","name":"Bad","lat":0,"lng":0}]'::jsonb)$$,
                 '22023', null, 'a malformed IATA code is rejected');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000012"}', true);
select throws_ok($$select * from rpc_set_site_airports('20000000-0000-4000-8000-000000000003',
                   '[{"iata":"DMM","name":"King Fahd International Airport","lat":26.47,"lng":49.79}]'::jsonb)$$,
                 '42501', null, 'drivers cannot edit airports');

reset role;
select * from finish();
rollback;
