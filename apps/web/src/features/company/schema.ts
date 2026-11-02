import { z } from 'zod';

/** FR-21/51/61 — company_settings tunables edited in Settings. Messages are i18n keys. */
export const companyRulesSchema = z
  .object({
    reminder_offsets_min: z
      .array(z.number().int().min(5, 'settings.errors.offsetMin').max(10_080, 'settings.errors.offsetMax'))
      .min(1, 'settings.errors.offsetsRequired')
      .max(5, 'settings.errors.offsetsMax'),
    ack_deadline_min: z.number().int().min(0).max(1440),
    grace_min: z.number().int().min(0).max(240),
    no_show_after_min: z.number().int().min(5).max(720),
    airport_share_window_min: z.number().int().min(0).max(360),
    far_location_km: z.number().min(1).max(2000),
    standard_day_min: z.number().int().min(60, 'settings.errors.standardDay').max(1440),
    weekly_max_min: z.number().int().min(60).max(10_080),
    max_daily_driving_min: z.number().int().min(60).max(1440),
    weekend_days: z.array(z.number().int().min(0).max(6)).max(3),
  })
  .refine((v) => v.no_show_after_min > v.grace_min, { path: ['no_show_after_min'], message: 'settings.errors.noShowAfterGrace' })
  .refine((v) => v.weekly_max_min >= v.standard_day_min, { path: ['weekly_max_min'], message: 'settings.errors.weeklyBelowDay' });

export type CompanyRulesValues = z.infer<typeof companyRulesSchema>;
