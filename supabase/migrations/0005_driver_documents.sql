-- =====================================================================
--  MASAR — Migration 0005: job titles, required documents, driver
--  documents and expiry reminders
--
--   1. document_types — the company's catalogue (passport, resident ID,
--      licences, authorisation, insurance …); has_expiry + remind_days.
--   2. job_titles + job_title_documents — what each job needs to work
--      legally (e.g. Light duty driver → light licence, authorisation,
--      resident ID …). drivers.job_title_id puts those requirements on
--      every driver with that job — computed, so a new requirement shows
--      up on everyone at once.
--   3. driver_documents — one current record per driver and type: number,
--      issued / expiry dates (expiry required when the type expires) and the
--      uploaded copy in the private `driver-documents` bucket
--      (path company_id/driver_id/file).
--   4. fn_document_reminders() — daily (pg_cron): owners/admins are told
--      when a document enters its reminder window, again 7 days before, and
--      when it expires. Idempotent (deduped on document + stage + date).
--
--  PII (NFR-01): files are readable by owners/admins and the driver only;
--  dispatchers and viewers see the status rows, not the copies.
-- =====================================================================

alter type notification_type add value if not exists 'document_expiring';
alter type notification_type add value if not exists 'document_expired';

-- ---------------------------------------------------------------------
-- 1. catalogue
-- ---------------------------------------------------------------------
create table document_types (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  name_ar     text,
  description text,
  has_expiry  boolean not null default true,
  remind_days int not null default 30 check (remind_days between 0 and 365),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

create table job_titles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  name_ar     text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

create table job_title_documents (
  job_title_id     uuid not null references job_titles(id) on delete cascade,
  document_type_id uuid not null references document_types(id) on delete cascade,
  primary key (job_title_id, document_type_id)
);

alter table drivers add column job_title_id uuid references job_titles(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3. driver documents
-- ---------------------------------------------------------------------
create table driver_documents (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  driver_id        uuid not null references drivers(id) on delete cascade,
  -- restrict: a type that drivers hold can't vanish with their records
  document_type_id uuid not null references document_types(id) on delete restrict,
  document_no      text,
  issued_on        date not null,
  expires_on       date,
  storage_path     text,                 -- bucket driver-documents: company_id/driver_id/<file>
  file_name        text,
  file_type        text,
  file_size        int,
  notes            text,
  uploaded_by      uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (driver_id, document_type_id),
  check (expires_on is null or expires_on > issued_on)
);
create index driver_documents_company_expiry_idx on driver_documents(company_id, expires_on);
create trigger trg_driver_documents_updated before update on driver_documents
  for each row execute function fn_set_updated_at();

-- same company everywhere; an expiring type needs its expiry date
create or replace function trg_driver_documents_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_type document_types%rowtype;
begin
  select * into v_type from document_types where id = new.document_type_id;
  if v_type.company_id is distinct from new.company_id
     or not exists (select 1 from drivers where id = new.driver_id and company_id = new.company_id) then
    raise exception 'errors.invalidInput';
  end if;
  if v_type.has_expiry and new.expires_on is null then
    raise exception 'documents.errors.expiryRequired';
  end if;
  return new;
end $$;
create trigger trg_driver_documents_check before insert or update on driver_documents
  for each row execute function trg_driver_documents_check();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table document_types      enable row level security;
alter table job_titles          enable row level security;
alter table job_title_documents enable row level security;
alter table driver_documents    enable row level security;

create policy document_types_select on document_types for select using (company_id = auth_company_id());
create policy document_types_admin  on document_types for all
  using (company_id = auth_company_id() and auth_is_admin()) with check (company_id = auth_company_id() and auth_is_admin());

create policy job_titles_select on job_titles for select using (company_id = auth_company_id());
create policy job_titles_admin  on job_titles for all
  using (company_id = auth_company_id() and auth_is_admin()) with check (company_id = auth_company_id() and auth_is_admin());

create policy job_title_documents_select on job_title_documents for select using (
  exists (select 1 from job_titles j where j.id = job_title_id and j.company_id = auth_company_id()));
create policy job_title_documents_admin on job_title_documents for all using (
  auth_is_admin() and exists (select 1 from job_titles j where j.id = job_title_id and j.company_id = auth_company_id()))
  with check (
  auth_is_admin()
  and exists (select 1 from job_titles j where j.id = job_title_id and j.company_id = auth_company_id())
  and exists (select 1 from document_types d where d.id = document_type_id and d.company_id = auth_company_id()));

-- status rows: staff, viewers and the driver themself
create policy driver_documents_select on driver_documents for select using (
  company_id = auth_company_id() and (auth_role() <> 'driver' or driver_id = auth_driver_id()));
create policy driver_documents_admin on driver_documents for all
  using (company_id = auth_company_id() and auth_is_admin())
  with check (company_id = auth_company_id() and auth_is_admin());

-- copies: private bucket, owner/admin of the company or the driver themself
insert into storage.buckets (id, name, public) values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;
create policy "driver documents read" on storage.objects for select using (
  bucket_id = 'driver-documents' and (storage.foldername(name))[1] = auth_company_id()::text
  and (auth_is_admin() or (storage.foldername(name))[2] = auth_driver_id()::text));
create policy "driver documents write" on storage.objects for insert with check (
  bucket_id = 'driver-documents' and (storage.foldername(name))[1] = auth_company_id()::text and auth_is_admin());
create policy "driver documents delete" on storage.objects for delete using (
  bucket_id = 'driver-documents' and (storage.foldername(name))[1] = auth_company_id()::text and auth_is_admin());

-- ---------------------------------------------------------------------
-- 2. job titles are saved with their requirements in one call
-- ---------------------------------------------------------------------
-- p_title: {id?, name, name_ar?, description?, is_active?, document_type_ids: [uuid]}
create or replace function rpc_save_job_title(p_title jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  v_id      uuid := nullif(p_title->>'id', '')::uuid;
begin
  if v_company is null or not auth_is_admin() then
    raise exception 'errors.forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_title->>'name'), '') = '' then raise exception 'documents.errors.jobName'; end if;
  if v_id is null then
    insert into job_titles (company_id, name, name_ar, description, is_active)
    values (v_company, trim(p_title->>'name'), nullif(trim(p_title->>'name_ar'), ''),
            nullif(trim(p_title->>'description'), ''), coalesce((p_title->>'is_active')::boolean, true))
    returning id into v_id;
  else
    update job_titles set name = trim(p_title->>'name'), name_ar = nullif(trim(p_title->>'name_ar'), ''),
                          description = nullif(trim(p_title->>'description'), ''),
                          is_active = coalesce((p_title->>'is_active')::boolean, is_active)
    where id = v_id and company_id = v_company;
    if not found then raise exception 'errors.forbidden' using errcode = '42501'; end if;
  end if;
  delete from job_title_documents where job_title_id = v_id;
  insert into job_title_documents (job_title_id, document_type_id)
  select v_id, x::uuid from jsonb_array_elements_text(coalesce(p_title->'document_type_ids', '[]')) x
  on conflict do nothing;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. reminders (pg_cron daily, e.g. 06:00):
--    select cron.schedule('masar-documents', '0 3 * * *', $$select fn_document_reminders()$$);
-- ---------------------------------------------------------------------
create or replace function fn_document_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_added int;
  r       record;
  v_stage text;
begin
  for r in
    select dd.id, dd.company_id, dd.driver_id, dd.document_type_id, dd.expires_on, d.full_name,
           dt.name as type_name, dt.remind_days,
           dd.expires_on - (now() at time zone c.timezone)::date as days_left
    from driver_documents dd
    join drivers d on d.id = dd.driver_id and d.is_active
    join document_types dt on dt.id = dd.document_type_id and dt.has_expiry
    join companies c on c.id = dd.company_id
    where dd.expires_on is not null
      and dd.expires_on - (now() at time zone c.timezone)::date <= dt.remind_days
  loop
    v_stage := case when r.days_left < 0 then 'expired' when r.days_left <= 7 then 'week' else 'window' end;
    insert into notifications (company_id, user_id, type, title, body, data, channels)
    select r.company_id, p.id,
           (case when v_stage = 'expired' then 'document_expired' else 'document_expiring' end)::notification_type,
           r.full_name, r.type_name,
           jsonb_build_object('driver_id', r.driver_id, 'document_id', r.id, 'document_type_id', r.document_type_id,
                              'expires_on', r.expires_on, 'days_left', r.days_left, 'stage', v_stage),
           '{in_app,push}'
    from profiles p
    where p.company_id = r.company_id and p.role in ('owner','admin') and p.is_active
      and not exists (select 1 from notifications n
                      where n.user_id = p.id and n.data->>'document_id' = r.id::text
                        and n.data->>'stage' = v_stage and n.data->>'expires_on' = r.expires_on::text);
    get diagnostics v_added = row_count;
    v_count := v_count + v_added;
  end loop;
  return v_count;
end $$;

grant select, insert, update, delete on document_types, job_titles, job_title_documents, driver_documents to authenticated;
grant execute on function rpc_save_job_title(jsonb) to authenticated;
-- the reminder job runs as the scheduler, not as a client
revoke execute on function fn_document_reminders() from public, anon, authenticated;
