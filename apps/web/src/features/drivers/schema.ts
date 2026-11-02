import { z } from 'zod';

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'drivers.errors.time').or(z.literal(''));

/** FR-04 driver record (drivers table). Messages are i18n keys. */
export const driverSchema = z
  .object({
    full_name: z.string().trim().min(2, 'auth.errors.nameRequired'),
    full_name_ar: z.string().trim().optional(),
    employee_no: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    home_site_id: z.string().optional(),
    licence_no: z.string().trim().optional(),
    licence_expiry: z.string().optional(),
    shift_start: time.optional(),
    shift_end: time.optional(),
    /** null → company default (company_settings.max_daily_driving_min) */
    max_daily_driving_min: z.number().int().min(60, 'drivers.errors.maxDaily').max(1440, 'drivers.errors.maxDaily').nullable(),
    notes: z.string().optional(),
    is_active: z.boolean(),
  })
  .refine((v) => !v.shift_start || !v.shift_end || v.shift_start < v.shift_end, {
    path: ['shift_end'],
    message: 'drivers.errors.shiftOrder',
  });
export type DriverValues = z.infer<typeof driverSchema>;

export const availabilitySchema = z
  .object({
    type: z.enum(['leave', 'sick', 'off_day', 'training', 'other']),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'drivers.errors.date'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'drivers.errors.date'),
    note: z.string().optional(),
  })
  .refine((v) => v.to >= v.from, { path: ['to'], message: 'drivers.errors.dateOrder' });
export type AvailabilityValues = z.infer<typeof availabilitySchema>;
