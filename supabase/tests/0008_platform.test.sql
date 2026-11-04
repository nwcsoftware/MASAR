-- pgTAP — run with `pnpm db:test` (needs the seed loaded).
-- Covers 0008: the platform super admin creates companies and lists them,
-- but never sees a company's operational data; nobody else can create a
-- company or grant super admin; site airports keep an active flag and the
-- default is always an active airport. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. super admin (super@masar.dev): companies yes, company data no
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000099"}', true);

select ok(auth_is_platform_admin(), 'super@masar.dev is a platform super admin');
select lives_ok($$select rpc_platform_create_company('Gulf Builders', 'بناة الخليج', 'ae', 'Asia/Dubai', 'ar')$$,
                'the super admin creates a company');
select is((select country_code::text from companies where name = 'Gulf Builders'), 'AE', '… with the country code upper-cased');
select is((select company_id from profiles where id = auth.uid()), null, 'the super admin belongs to no company');
select is((select count(*)::int from rpc_platform_companies()), 2, 'the companies list shows every company');
select is((select owner_email from rpc_platform_companies() where name = 'Masar Demo Contracting'), 'owner@masar.dev',
          '… with each company''s owner');
select is((select owner_id from rpc_platform_companies() where name = 'Gulf Builders'), null,
          '… and no owner yet for a new company');
select lives_ok($$update companies set name_ar = 'بناة الخليج للمقاولات' where name = 'Gulf Builders'$$,
                'the super admin edits a company profile');
select throws_ok($$select rpc_platform_create_company('', null, 'SA', 'Asia/Riyadh', 'en')$$,
                 '22023', null, 'a company needs a name');

select is((select count(*)::int from tasks), 0, 'the super admin sees no company''s tasks');
select is((select count(*)::int from sites), 0, '… no sites');
select is((select count(*)::int from drivers), 0, '… no drivers');
select is((select count(*)::int from profiles), 1, '… and no one else''s profile');

-- ---------------------------------------------------------------------
-- 2. an owner cannot act as super admin
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);

select throws_ok($$select rpc_platform_create_company('Side Co')$$, '42501', null, 'an owner cannot create a company');
select throws_ok($$select * from rpc_platform_companies()$$, '42501', null, '… nor list companies');
select throws_ok($$insert into platform_admins (user_id) values (auth.uid())$$, '42501', null, '… nor make themselves super admin');
select is((select count(*)::int from companies), 1, 'an owner sees only their own company');

-- ---------------------------------------------------------------------
-- 3. site airports: active flag and default (FR-03)
-- ---------------------------------------------------------------------
select lives_ok($$select * from rpc_set_site_airports('20000000-0000-4000-8000-000000000002',
  '[{"iata":"RUH","name":"King Khalid International Airport","lat":24.9576,"lng":46.6988,"is_active":false,"is_default":true},
    {"iata":"AQI","name":"Al Qaisumah Airport","lat":28.3352,"lng":46.1251},
    {"iata":"DMM","name":"King Fahd International Airport","lat":26.47,"lng":49.79,"is_active":false}]'::jsonb)$$,
  'the owner saves suggested airports with some switched off');
select is((select string_agg(a.iata || ':' || sa.is_active || ':' || sa.is_default, ',' order by a.iata)
             from site_airports sa join airports a on a.id = sa.airport_id
            where sa.site_id = '20000000-0000-4000-8000-000000000002'),
          'AQI:true:true,DMM:false:false,RUH:false:false',
          'inactive airports are kept, never default; missing is_active means active');
select lives_ok($$select * from rpc_set_site_airports('20000000-0000-4000-8000-000000000002',
  '[{"iata":"RUH","name":"King Khalid International Airport","lat":24.9576,"lng":46.6988,"is_active":false}]'::jsonb)$$,
  'every airport switched off leaves the site without a default');

reset role;
select * from finish();
rollback;
