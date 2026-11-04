import { describe, expect, it } from 'vitest';
import type { AirportSuggestion } from '@shared/schemas';
import { inviteOwnerInput } from '@shared/schemas';
import { mergeSuggestions, withActiveDefault } from '@/features/sites/airports';
import { homePathFor } from '@/features/auth/guards';
import type { SessionUser } from '@/features/auth/session';
import { mockPlatformCompanies } from '@/features/platform/queries';
import { newCompanySchema } from '@/features/platform/schema';
import type { SiteAirportValues } from '@/features/sites/schema';
import * as fx from '@/mocks/fixtures';

const suggestion = (iata: string, drive: number): AirportSuggestion => ({
  iata,
  icao: null,
  name: `${iata} Airport`,
  name_ar: null,
  city: null,
  city_ar: null,
  country_code: 'SA',
  lat: 24,
  lng: 46,
  distance_km: drive,
  drive_minutes: drive,
  is_international: true,
  source: 'ai',
  drive_estimated: true,
});

const row = (iata: string, is_active: boolean, is_default = false): SiteAirportValues => ({
  iata,
  icao: null,
  name: iata,
  name_ar: null,
  city: null,
  city_ar: null,
  country_code: 'SA',
  lat: 24,
  lng: 46,
  is_international: true,
  source: 'ai',
  distance_km: 10,
  drive_minutes: 10,
  default_buffer_min: 30,
  is_default,
  is_active,
});

describe('site airports: active switch (0008, FR-03)', () => {
  it('first AI run keeps every airport, only the nearest starts active and default', () => {
    const merged = mergeSuggestions([], [suggestion('RUH', 30), suggestion('AQI', 300), suggestion('DMM', 240)]);
    expect(merged.map((a) => `${a.iata}:${a.is_active}:${a.is_default}`)).toEqual(['RUH:true:true', 'AQI:false:false', 'DMM:false:false']);
  });

  it('suggesting again adds new airports switched off and keeps existing switches', () => {
    const current = [row('RUH', false), row('AQI', true, true)];
    const merged = mergeSuggestions(current, [suggestion('RUH', 30), suggestion('DMM', 240)]);
    expect(merged.map((a) => `${a.iata}:${a.is_active}:${a.is_default}`)).toEqual(['RUH:false:false', 'AQI:true:true', 'DMM:false:false']);
  });

  it('the default is always an active airport, and none when all are off', () => {
    expect(withActiveDefault([row('RUH', false, true), row('AQI', true)]).find((a) => a.is_default)?.iata).toBe('AQI');
    expect(withActiveDefault([row('RUH', false), row('AQI', false)]).some((a) => a.is_default)).toBe(false);
  });
});

describe('platform super admin (0008, FR-01)', () => {
  const noCompany: SessionUser = {
    id: fx.SUPER_ADMIN_ID,
    email: 'super@masar.dev',
    profile: fx.platformAdmins[0]!,
    company: null,
    driverId: null,
    siteIds: [],
    isPlatformAdmin: true,
  };

  it('lands on the companies console; an account without a company waits instead of creating one', () => {
    expect(homePathFor(noCompany)).toBe('/platform');
    expect(homePathFor({ ...noCompany, isPlatformAdmin: false })).toBe('/no-company');
  });

  it('lists every company with its owner, never mixing tenants', () => {
    const rows = mockPlatformCompanies();
    expect(rows.map((r) => r.name).sort()).toEqual(['Gulf Builders', 'Masar Demo Contracting']);
    expect(rows.find((r) => r.id === fx.COMPANY_ID)).toMatchObject({ owner_email: 'owner@masar.dev', owner_pending: false, site_count: fx.sites.length });
    expect(rows.find((r) => r.name === 'Gulf Builders')).toMatchObject({ owner_pending: true, site_count: 0 });
  });

  it('a new company needs a name, a valid time zone and the owner', () => {
    const ok = { name: 'Gulf Builders', name_ar: '', country_code: 'ae', timezone: 'Asia/Dubai', default_language: 'en', owner_name: 'Omar Haddad', owner_email: 'Omar@Gulf.ae' };
    const parsed = newCompanySchema.parse(ok);
    expect(parsed).toMatchObject({ country_code: 'AE', owner_email: 'omar@gulf.ae' });
    const issues = newCompanySchema.safeParse({ ...ok, timezone: 'Mars/Olympus', owner_email: 'nope', owner_name: '' }).error?.issues.map((i) => i.message);
    expect(issues).toEqual(expect.arrayContaining(['settings.errors.timezone', 'auth.errors.emailInvalid', 'auth.errors.nameRequired']));
    expect(inviteOwnerInput.safeParse({ company_id: 'not-a-uuid', email: 'a@b.co', full_name: 'Ab' }).success).toBe(false);
  });
});
