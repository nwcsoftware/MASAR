import { describe, expect, it } from 'vitest';
import { inviteUserInput, suggestAirportsOutput } from '@shared/schemas';
import { availabilitySchema, driverSchema } from '@/features/drivers/schema';
import { companyProfileSchema, userAccessSchema, vehicleSchema } from '@/features/company/schema';
import { SITE_DEFAULTS, siteAirportSchema, siteSchema } from '@/features/sites/schema';
import { homePathFor } from '@/features/auth/guards';
import type { SessionUser } from '@/features/auth/session';
import { parseCoordinates } from '@/lib/maps';
import * as fx from '@/mocks/fixtures';

describe('parseCoordinates (MapPicker paste)', () => {
  it.each([
    ['https://www.google.com/maps/place/Riyadh/@24.7135517,46.6752957,11z/data=!3m1', 24.7135517, 46.6752957],
    ['https://www.google.com/maps/place/X/@24.1,46.1,15z/data=!4m6!3m5!1s0x0:0x0!8m2!3d24.6948!4d46.6857', 24.6948, 46.6857],
    ['https://maps.google.com/?q=26.4207,50.0888', 26.4207, 50.0888],
    ['https://www.google.com/maps/search/?api=1&query=21.735%2C39.085', 21.735, 39.085],
    ['24.6948, 46.6857', 24.6948, 46.6857],
    ['-33.8688 151.2093', -33.8688, 151.2093],
  ])('reads %s', (input, lat, lng) => {
    expect(parseCoordinates(input)).toEqual({ lat, lng });
  });

  it('rejects text without valid coordinates', () => {
    expect(parseCoordinates('Olaya Street, Riyadh')).toBeNull();
    expect(parseCoordinates('95.1, 46.6')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
  });
});

describe('Phase 1 schemas', () => {
  it('site: requires a name, valid coordinates and a sensible work day (FR-02, US-01)', () => {
    expect(siteSchema.safeParse({ ...SITE_DEFAULTS, name: 'Al Yasmin' }).success).toBe(true);
    const messages = siteSchema.safeParse({ ...SITE_DEFAULTS, name: 'A', lng: 200, work_end: '06:00' }).error?.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining(['onboarding.errors.siteName', 'onboarding.errors.lng']));
    const order = siteSchema.safeParse({ ...SITE_DEFAULTS, name: 'Site', work_start: '17:00', work_end: '07:00' });
    expect(order.error?.issues[0]?.message).toBe('drivers.errors.shiftOrder');
    expect(siteSchema.parse({ ...SITE_DEFAULTS, name: 'Site', code: 'rhq' }).code).toBe('RHQ');
  });

  it('site airport: IATA must be three capitals; buffer bounded', () => {
    const base = { iata: 'RUH', icao: null, name: 'King Khalid', name_ar: null, city: null, city_ar: null, country_code: 'SA', lat: 24.9, lng: 46.7, is_international: true, source: 'ai' as const, distance_km: 39.6, drive_minutes: 34, default_buffer_min: 30, is_default: true };
    expect(siteAirportSchema.safeParse(base).success).toBe(true);
    expect(siteAirportSchema.safeParse({ ...base, iata: 'ru' }).error?.issues[0]?.message).toBe('sites.errors.iata');
    expect(siteAirportSchema.safeParse({ ...base, default_buffer_min: 500 }).success).toBe(false);
  });

  it('driver: optional cap (null = company default), shift order (FR-04)', () => {
    const base = { full_name: 'Omar', is_active: true, max_daily_driving_min: null };
    expect(driverSchema.safeParse(base).success).toBe(true);
    expect(driverSchema.safeParse({ ...base, max_daily_driving_min: 30 }).error?.issues[0]?.message).toBe('drivers.errors.maxDaily');
    expect(driverSchema.safeParse({ ...base, shift_start: '18:00', shift_end: '06:00' }).error?.issues[0]?.message).toBe('drivers.errors.shiftOrder');
  });

  it('availability: end date cannot precede start', () => {
    expect(availabilitySchema.safeParse({ type: 'leave', from: '2026-11-10', to: '2026-11-12' }).success).toBe(true);
    expect(availabilitySchema.safeParse({ type: 'leave', from: '2026-11-12', to: '2026-11-10' }).error?.issues[0]?.message).toBe('drivers.errors.dateOrder');
  });

  it('company profile: validates the IANA time zone and normalises the country (FR-01)', () => {
    const base = { name: 'Acme', country_code: 'sa', timezone: 'Asia/Riyadh', default_language: 'en' as const };
    expect(companyProfileSchema.parse(base).country_code).toBe('SA');
    expect(companyProfileSchema.safeParse({ ...base, timezone: 'Mars/Olympus' }).error?.issues[0]?.message).toBe('settings.errors.timezone');
  });

  it('vehicle: plate and seat bounds (FR-05)', () => {
    const base = { plate_no: '1234 RAB', year: 2024, seats: 4, odometer_km: 0, is_active: true };
    expect(vehicleSchema.safeParse(base).success).toBe(true);
    expect(vehicleSchema.safeParse({ ...base, seats: 0 }).error?.issues[0]?.message).toBe('vehicles.errors.seats');
  });

  it('user access: roles are the DB enum', () => {
    expect(userAccessSchema.safeParse({ role: 'dispatcher', site_ids: [] }).success).toBe(true);
    expect(userAccessSchema.safeParse({ role: 'superuser', site_ids: [] }).success).toBe(false);
  });
});

describe('shared Edge Function contracts', () => {
  it('invite: lower-cases email, defaults language/scope, cannot invite owners', () => {
    const parsed = inviteUserInput.parse({ email: ' New.Dispatcher@Company.COM ', full_name: 'New Person', role: 'dispatcher' });
    expect(parsed).toMatchObject({ email: 'new.dispatcher@company.com', language: 'en', site_ids: [] });
    expect(inviteUserInput.safeParse({ email: 'a@b.co', full_name: 'Boss', role: 'owner' }).success).toBe(false);
  });

  it('invite: only drivers may be linked to a driver record', () => {
    const driverId = fx.IDS.drivers.fahad;
    expect(inviteUserInput.safeParse({ email: 'f@b.co', full_name: 'Fahad', role: 'driver', driver_id: driverId }).success).toBe(true);
    const bad = inviteUserInput.safeParse({ email: 'f@b.co', full_name: 'Fahad', role: 'viewer', driver_id: driverId });
    expect(bad.error?.issues[0]?.message).toBe('users.errors.driverLinkRole');
  });

  it('suggestions: at most eight, codes validated', () => {
    const airport = { iata: 'RUH', icao: 'OERK', name: 'KKIA', name_ar: null, city: 'Riyadh', city_ar: null, country_code: 'SA', lat: 24.9, lng: 46.7, distance_km: 39, drive_minutes: 34, is_international: true, source: 'google' as const, drive_estimated: false };
    expect(suggestAirportsOutput.safeParse({ airports: [airport] }).success).toBe(true);
    expect(suggestAirportsOutput.safeParse({ airports: Array(9).fill(airport) }).success).toBe(false);
    expect(suggestAirportsOutput.safeParse({ airports: [{ ...airport, icao: 'OER' }] }).success).toBe(false);
  });
});

describe('homePathFor after sign-up', () => {
  it('sends a brand-new signup (viewer, no company) to onboarding — not into a redirect loop', () => {
    const user: SessionUser = { id: 'u', email: null, profile: { ...fx.profiles[3]!, role: 'viewer', company_id: null }, company: null, driverId: null, siteIds: [] };
    expect(homePathFor(user)).toBe('/onboarding');
  });
});
