import { z } from 'zod';

/** FR-21/51/61 — company_settings tunables edited in Settings. Messages are i18n keys. */
export const companyRulesSchema = z
  .object({
    reminder_offsets_min: z
      .array(z.number().int().min(5, 'settings.errors.offsetMin').max(10_080, 'settings.errors.offsetMax'))
      .min(1, 'settings.errors.offsetsRequired')
      .max(5, 'settings.errors.offsetsMax'),
    ack_deadline_min: z.number({ message: 'errors.outOfRange' }).int().min(0, 'errors.outOfRange').max(1440, 'errors.outOfRange'),
    grace_min: z.number({ message: 'errors.outOfRange' }).int().min(0, 'errors.outOfRange').max(240, 'errors.outOfRange'),
    no_show_after_min: z.number({ message: 'errors.outOfRange' }).int().min(5, 'errors.outOfRange').max(720, 'errors.outOfRange'),
    airport_share_window_min: z.number({ message: 'errors.outOfRange' }).int().min(0, 'errors.outOfRange').max(360, 'errors.outOfRange'),
    far_location_km: z.number({ message: 'errors.outOfRange' }).min(1, 'errors.outOfRange').max(2000, 'errors.outOfRange'),
    standard_day_min: z.number({ message: 'errors.outOfRange' }).int().min(60, 'settings.errors.standardDay').max(1440, 'errors.outOfRange'),
    weekly_max_min: z.number({ message: 'errors.outOfRange' }).int().min(60, 'errors.outOfRange').max(10_080, 'errors.outOfRange'),
    max_daily_driving_min: z.number({ message: 'errors.outOfRange' }).int().min(60, 'errors.outOfRange').max(1440, 'errors.outOfRange'),
    weekend_days: z.array(z.number().int().min(0).max(6)).max(3),
  })
  .refine((v) => v.no_show_after_min > v.grace_min, { path: ['no_show_after_min'], message: 'settings.errors.noShowAfterGrace' })
  .refine((v) => v.weekly_max_min >= v.standard_day_min, { path: ['weekly_max_min'], message: 'settings.errors.weeklyBelowDay' });

export type CompanyRulesValues = z.infer<typeof companyRulesSchema>;

/** FR-01 company profile (created by the super admin via rpc_platform_create_company, edited via companies update). */
export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, 'onboarding.errors.companyName'),
  name_ar: z.string().trim().optional(),
  country_code: z.string().trim().toUpperCase().length(2, 'settings.errors.country'),
  timezone: z.string().refine(isTimeZone, 'settings.errors.timezone'),
  default_language: z.enum(['en', 'ar']),
  eastern_arabic_digits: z.boolean().optional(),
});
export type CompanyProfileValues = z.infer<typeof companyProfileSchema>;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'drivers.errors.date'),
  name: z.string().trim().min(2, 'settings.errors.holidayName'),
  name_ar: z.string().trim().optional(),
});
export type HolidayValues = z.infer<typeof holidaySchema>;

/** FR-05 vehicle. */
export const vehicleSchema = z.object({
  plate_no: z.string().trim().min(2, 'vehicles.errors.plate'),
  make: z.string().trim().optional(),
  model: z.string().trim().optional(),
  year: z.number().int().min(1980, 'vehicles.errors.year').max(2100, 'vehicles.errors.year').nullable(),
  color: z.string().trim().optional(),
  seats: z.number().int().min(1, 'vehicles.errors.seats').max(60, 'vehicles.errors.seats'),
  site_id: z.string().optional(),
  /** 0004: the grade group this car carries (same group only) */
  grade_group_id: z.string().optional(),
  odometer_km: z.number({ message: 'errors.outOfRange' }).int().min(0, 'errors.outOfRange'),
  is_active: z.boolean(),
  notes: z.string().optional(),
});
export type VehicleValues = z.infer<typeof vehicleSchema>;

/** FR-04/60 role + site scope for an existing user. */
export const userAccessSchema = z.object({
  role: z.enum(['owner', 'admin', 'dispatcher', 'driver', 'viewer']),
  site_ids: z.array(z.string()),
});
export type UserAccessValues = z.infer<typeof userAccessSchema>;
