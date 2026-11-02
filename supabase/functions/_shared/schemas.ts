/**
 * Contracts shared by the web app and the Edge Functions (CLAUDE.md: "zod
 * schema … shared with Edge Functions where relevant"). Lives under
 * supabase/functions so `supabase functions deploy` can bundle it; the web
 * app imports it as `@shared/schemas`. Messages are i18n keys.
 *
 * Only depends on `zod` (npm:zod in each function's deno.json).
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// ai-suggest-airports (FR-03, docs/DATABASE.md §8)
// ---------------------------------------------------------------------------
export const suggestAirportsInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  country_code: z.string().length(2).optional(),
  lang: z.enum(['en', 'ar']).optional(),
});
export type SuggestAirportsInput = z.infer<typeof suggestAirportsInput>;

export const airportSuggestion = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/),
  icao: z.string().regex(/^[A-Z]{4}$/).nullable(),
  name: z.string().min(1),
  name_ar: z.string().nullable(),
  city: z.string().nullable(),
  city_ar: z.string().nullable(),
  country_code: z.string().length(2).nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  distance_km: z.number().nonnegative(),
  drive_minutes: z.number().int().nonnegative(),
  is_international: z.boolean(),
  /** google = Places + Claude normalisation; ai = Claude only; estimate flags haversine drive times */
  source: z.enum(['google', 'ai']),
  drive_estimated: z.boolean(),
});
export type AirportSuggestion = z.infer<typeof airportSuggestion>;

export const suggestAirportsOutput = z.object({ airports: z.array(airportSuggestion).max(8) });
export type SuggestAirportsOutput = z.infer<typeof suggestAirportsOutput>;

// ---------------------------------------------------------------------------
// invite-user (FR-04)
// ---------------------------------------------------------------------------
export const INVITABLE_ROLES = ['admin', 'dispatcher', 'driver', 'viewer'] as const;

export const inviteUserInput = z
  .object({
    email: z.string().trim().toLowerCase().email('auth.errors.emailInvalid'),
    full_name: z.string().trim().min(2, 'auth.errors.nameRequired'),
    full_name_ar: z.string().trim().optional(),
    role: z.enum(INVITABLE_ROLES),
    language: z.enum(['en', 'ar']).default('en'),
    phone: z.string().trim().optional(),
    /** user_sites scope for dispatchers/viewers; empty = all sites */
    site_ids: z.array(z.string().uuid()).default([]),
    /** drivers: link an existing drivers row instead of creating one */
    driver_id: z.string().uuid().optional(),
    home_site_id: z.string().uuid().optional(),
  })
  .refine((v) => v.role === 'driver' || !v.driver_id, { path: ['driver_id'], message: 'users.errors.driverLinkRole' });
export type InviteUserInput = z.input<typeof inviteUserInput>;

export const inviteUserOutput = z.object({ user_id: z.string().uuid(), driver_id: z.string().uuid().nullable() });
export type InviteUserOutput = z.infer<typeof inviteUserOutput>;
