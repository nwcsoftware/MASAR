-- pgTAP — run with `pnpm db:test` (needs the seed loaded).
-- Covers 0005: admin-only catalogue and job titles, driver documents
-- (expiry rules, tenant checks, who sees what), the private copies bucket
-- and the expiry reminder job. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- another tenant's document type, created as postgres
insert into companies (id, name) values ('99999999-0000-4000-8000-0000000000d1', 'Other Co');
insert into document_types (id, company_id, name) values ('99999999-0000-4000-8000-0000000000d2', '99999999-0000-4000-8000-0000000000d1', 'Foreign permit');
-- a copy in Ahmed's folder and one in Khalid's
insert into storage.objects (bucket_id, name) values
  ('driver-documents', '00000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/iqama.pdf'),
  ('driver-documents', '00000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000002/licence.pdf');

set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. catalogue + job titles are admin-only
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select throws_ok($$insert into document_types (company_id, name) values ('00000000-0000-4000-8000-000000000001', 'Visa')$$,
                 '42501', null, 'a dispatcher cannot add document types');
select throws_ok($$select rpc_save_job_title('{"name":"Bus driver"}')$$, '42501', null, '… nor job titles');
select ok((select count(*) from driver_documents) > 0, 'dispatchers see document status rows');
select is((select count(*)::int from storage.objects where bucket_id = 'driver-documents'), 0, '… but not the copies');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);
select lives_ok($$select rpc_save_job_title(jsonb_build_object('name', 'Bus driver', 'document_type_ids',
                  jsonb_build_array('14000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000005')))$$,
                'the owner creates a job title with its required documents');
select is((select count(*)::int from job_title_documents jd join job_titles j on j.id = jd.job_title_id where j.name = 'Bus driver'), 2,
          'both requirements are saved');

-- ---------------------------------------------------------------------
-- 2. documents: dates and tenancy
-- ---------------------------------------------------------------------
select throws_ok($$insert into driver_documents (company_id, driver_id, document_type_id, issued_on)
                   values ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000006', current_date)$$,
                 null, 'documents.errors.expiryRequired', 'an expiring document needs its expiry date');
select throws_ok($$insert into driver_documents (company_id, driver_id, document_type_id, issued_on, expires_on)
                   values ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000006', current_date, current_date - 1)$$,
                 '23514', null, 'expiry must come after issue');
select throws_ok($$insert into driver_documents (company_id, driver_id, document_type_id, issued_on, expires_on)
                   values ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '99999999-0000-4000-8000-0000000000d2', current_date, current_date + 300)$$,
                 null, 'errors.invalidInput', 'another tenant''s document type is refused');
select lives_ok($$insert into driver_documents (company_id, driver_id, document_type_id, document_no, issued_on, expires_on)
                  values ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000006', 'BUPA-1', current_date, current_date + 365)$$,
                'the owner records Khalid''s missing insurance');
select throws_ok($$delete from document_types where id = '14000000-0000-4000-8000-000000000001'$$,
                 '23503', null, 'a document type that drivers hold cannot be deleted');
select is((select count(*)::int from storage.objects where bucket_id = 'driver-documents'), 2, 'the owner can open every copy');

-- ---------------------------------------------------------------------
-- 3. a driver sees only their own papers
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000011"}', true);
select is((select count(*)::int from driver_documents where driver_id <> '40000000-0000-4000-8000-000000000001'), 0,
          'Ahmed cannot see other drivers'' documents');
select is((select array_agg(name) from storage.objects where bucket_id = 'driver-documents'),
          array['00000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/iqama.pdf'],
          '… and opens only his own copies');

-- ---------------------------------------------------------------------
-- 4. reminders
-- ---------------------------------------------------------------------
select throws_ok($$select fn_document_reminders()$$, '42501', null, 'clients cannot trigger the reminder job');
reset role;
update driver_documents set expires_on = (now() at time zone 'Asia/Riyadh')::date + 5
where driver_id = '40000000-0000-4000-8000-000000000001' and document_type_id = '14000000-0000-4000-8000-000000000002';
select is(fn_document_reminders(), 1, 'only the newly urgent resident ID (now < 7 days) is reminded again; the rest were already sent');

select * from finish();
rollback;
