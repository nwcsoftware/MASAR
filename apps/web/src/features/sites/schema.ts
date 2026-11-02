import { z } from 'zod';

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'drivers.errors.time');

/** FR-02 site. US-01: "Site form validates lat/lng". Messages are i18n keys. */
export const siteSchema = z
  .object({
    name: z.string().trim().min(2, 'onboarding.errors.siteName'),
    name_ar: z.string().trim().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{0,8}$/, 'sites.errors.code')
      .optional(),
    type: z.enum(['construction_site', 'office', 'warehouse', 'other']),
    address: z.string().trim().optional(),
    address_ar: z.string().trim().optional(),
    city: z.string().trim().optional(),
    lat: z.number({ message: 'onboarding.errors.lat' }).min(-90, 'onboarding.errors.lat').max(90, 'onboarding.errors.lat'),
    lng: z.number({ message: 'onboarding.errors.lng' }).min(-180, 'onboarding.errors.lng').max(180, 'onboarding.errors.lng'),
    contact_name: z.string().trim().optional(),
    contact_phone: z.string().trim().optional(),
    work_start: time,
    work_end: time,
    notes: z.string().optional(),
    is_active: z.boolean(),
  })
  .refine((v) => v.work_start < v.work_end, { path: ['work_end'], message: 'drivers.errors.shiftOrder' });
export type SiteValues = z.infer<typeof siteSchema>;

export const SITE_DEFAULTS: SiteValues = {
  name: '',
  name_ar: '',
  code: '',
  type: 'construction_site',
  address: '',
  address_ar: '',
  city: '',
  lat: 24.7136,
  lng: 46.6753,
  contact_name: '',
  contact_phone: '',
  work_start: '07:00',
  work_end: '17:00',
  notes: '',
  is_active: true,
};

/** One airport row in the AirportPicker → rpc_set_site_airports payload item. */
export const siteAirportSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/, 'sites.errors.iata'),
  icao: z.string().nullable(),
  name: z.string().min(1),
  name_ar: z.string().nullable(),
  city: z.string().nullable(),
  city_ar: z.string().nullable(),
  country_code: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  is_international: z.boolean(),
  source: z.enum(['ai', 'google', 'manual']),
  distance_km: z.number().nullable(),
  drive_minutes: z.number().int().nullable(),
  default_buffer_min: z.number().int().min(0, 'sites.errors.buffer').max(240, 'sites.errors.buffer'),
  is_default: z.boolean(),
});
export type SiteAirportValues = z.infer<typeof siteAirportSchema>;
