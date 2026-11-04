-- =====================================================================
--  MASAR — Migration 0008: platform super admin + active site airports
--  (FR-01, FR-02, FR-03)
--
--  1. Companies are no longer self-service. A platform super admin
--     (`platform_admins`, outside every company) creates each company and
--     invites its owner (Edge Function `invite-owner`). The self-service
--     rpc_create_company is dropped; signing up no longer creates a tenant.
--  2. Tenant isolation is unchanged: every company-scoped policy keys off
--     auth_company_id(). A super admin has no company, so they see the
--     companies list (rpc_platform_companies) but never a company's tasks,
--     drivers or people.
--  3. site_airports.is_active: the AI suggestions are all kept on the site
--     and the owner switches each one on or off. Only active airports are
--     offered when planning trips; the default is always an active one.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. platform super admins (granted with SQL / service role only)
-- ---------------------------------------------------------------------
create table platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;
-- a user can see whether they are one; nobody can grant it through the API
create policy platform_admins_self on platform_admins for select using (user_id = auth.uid());

create or replace function auth_is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

-- super admins read and edit every company row (not the data inside it)
create policy companies_platform_select on companies for select using (auth_is_platform_admin());
create policy companies_platform_update on companies for update
  using (auth_is_platform_admin()) with check (auth_is_platform_admin());

-- ---------------------------------------------------------------------
-- 2. company creation: super admin only
-- ---------------------------------------------------------------------
drop function if exists rpc_create_company(text, text, text, text, app_language);

create or replace function rpc_platform_create_company(
  p_name             text,
  p_name_ar          text default null,
  p_country_code     text default 'SA',
  p_timezone         text default 'Asia/Riyadh',
  p_default_language app_language default 'en'
) returns companies
language plpgsql security definer set search_path = public as $$
declare
  c companies%rowtype;
begin
  if not auth_is_platform_admin() then
    raise exception 'only a platform super admin can create companies' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'company name is required' using errcode = '22023';
  end if;
  if coalesce(p_country_code, '') !~* '^[a-z]{2}$' then
    raise exception 'country code must be two letters' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'unknown time zone %', p_timezone using errcode = '22023';
  end if;

  insert into companies (name, name_ar, country_code, timezone, default_language)
  values (btrim(p_name), nullif(btrim(p_name_ar), ''), upper(p_country_code), p_timezone, p_default_language)
  returning * into c;
  insert into company_settings (company_id) values (c.id);
  return c;
end $$;

-- companies list for the super admin console: owner + counts, no company data
create or replace function rpc_platform_companies()
returns table (
  id               uuid,
  name             text,
  name_ar          text,
  country_code     text,
  timezone         text,
  default_language app_language,
  created_at       timestamptz,
  owner_id         uuid,
  owner_name       text,
  owner_email      text,
  owner_pending    boolean,
  site_count       int,
  user_count       int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not auth_is_platform_admin() then
    raise exception 'only a platform super admin can list companies' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.name_ar, c.country_code::text, c.timezone, c.default_language, c.created_at,
         o.id, o.full_name, o.email,
         -- invited but never signed in yet
         case when o.id is null then null else (select u.last_sign_in_at is null from auth.users u where u.id = o.id) end,
         (select count(*)::int from sites s where s.company_id = c.id),
         (select count(*)::int from profiles p where p.company_id = c.id and p.role <> 'passenger')
  from companies c
  left join lateral (
    select p.id, p.full_name, p.email from profiles p
    where p.company_id = c.id and p.role = 'owner'
    order by p.created_at limit 1
  ) o on true
  order by c.created_at desc;
end $$;

-- ---------------------------------------------------------------------
-- 3. site airports: keep every suggestion, switch each one on or off
-- ---------------------------------------------------------------------
alter table site_airports add column is_active boolean not null default true;

-- p_airports items gain `is_active` (default true). The default airport is
-- the first active row flagged is_default, else the first active row;
-- inactive rows are never the default.
create or replace function rpc_set_site_airports(p_site_id uuid, p_airports jsonb)
returns setof site_airports
language plpgsql set search_path = public as $$
declare
  v_company uuid;
  a         jsonb;
  v_airport uuid;
  v_active  boolean;
  v_ids     uuid[] := '{}';
  v_actives uuid[] := '{}';
  v_default uuid;
begin
  select company_id into v_company from sites where id = p_site_id;
  if v_company is null then
    raise exception 'site not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_airports) <> 'array' then
    raise exception 'p_airports must be an array' using errcode = '22023';
  end if;

  for a in select * from jsonb_array_elements(p_airports) loop
    if coalesce(a->>'iata', '') !~ '^[A-Z]{3}$' then
      raise exception 'airport needs a 3-letter IATA code: %', a->>'iata' using errcode = '22023';
    end if;
    v_active := coalesce((a->>'is_active')::boolean, true);
    insert into airports (company_id, iata, icao, name, name_ar, city, city_ar, country_code,
                          lat, lng, is_international, source)
    values (v_company, a->>'iata', a->>'icao', a->>'name', a->>'name_ar', a->>'city', a->>'city_ar',
            coalesce(a->>'country_code', (select country_code from companies where id = v_company)),
            (a->>'lat')::double precision, (a->>'lng')::double precision,
            coalesce((a->>'is_international')::boolean, true), coalesce(a->>'source', 'ai'))
    on conflict (company_id, iata) do update set
      icao = coalesce(excluded.icao, airports.icao),
      name = excluded.name,
      name_ar = coalesce(excluded.name_ar, airports.name_ar),
      city = coalesce(excluded.city, airports.city),
      city_ar = coalesce(excluded.city_ar, airports.city_ar)
    returning id into v_airport;

    v_ids := v_ids || v_airport;
    if v_active then
      v_actives := v_actives || v_airport;
      if coalesce((a->>'is_default')::boolean, false) and v_default is null then
        v_default := v_airport;
      end if;
    end if;

    insert into site_airports (site_id, airport_id, is_default, is_active, distance_km, drive_minutes, default_buffer_min)
    values (p_site_id, v_airport, false, v_active, (a->>'distance_km')::numeric, (a->>'drive_minutes')::int,
            coalesce((a->>'default_buffer_min')::int, 30))
    on conflict (site_id, airport_id) do update set
      is_active = excluded.is_active,
      distance_km = coalesce(excluded.distance_km, site_airports.distance_km),
      drive_minutes = coalesce(excluded.drive_minutes, site_airports.drive_minutes),
      default_buffer_min = excluded.default_buffer_min;
  end loop;

  delete from site_airports where site_id = p_site_id and not (airport_id = any (v_ids));
  -- all switched off → no default (coalesce: `= null` would be null)
  update site_airports set is_default = coalesce(airport_id = coalesce(v_default, v_actives[1]), false)
   where site_id = p_site_id;

  return query select * from site_airports where site_id = p_site_id;
end $$;

grant execute on function auth_is_platform_admin() to authenticated;
grant execute on function rpc_platform_create_company(text, text, text, text, app_language) to authenticated;
grant execute on function rpc_platform_companies() to authenticated;
