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
// route-estimate (FR-11, docs/DATABASE.md §8)
// ---------------------------------------------------------------------------
export const ROUTE_MAX_STOPS = 10;

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const routeEstimateInput = z.object({
  stops: z.array(latLng).min(2).max(ROUTE_MAX_STOPS),
  /** traffic-aware departure (FR-11: departure time = scheduled start); omitted → now */
  departure_time: z.string().datetime({ offset: true }).optional(),
});
export type RouteEstimateInput = z.infer<typeof routeEstimateInput>;

export const routeLeg = z.object({
  distance_km: z.number().nonnegative(),
  duration_min: z.number().int().nonnegative(),
});
export type RouteLeg = z.infer<typeof routeLeg>;

export const routeEstimateOutput = z.object({
  /** one leg per consecutive pair of stops (stops.length − 1) */
  legs: z.array(routeLeg),
  distance_km: z.number().nonnegative(),
  duration_min: z.number().int().nonnegative(),
  /** true when Distance Matrix was unavailable and haversine × 1.3 @ 70 km/h was used */
  estimated: z.boolean(),
});
export type RouteEstimateOutput = z.infer<typeof routeEstimateOutput>;

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

// ---------------------------------------------------------------------------
// invite-owner (FR-01, migration 0008) — platform super admin only
// ---------------------------------------------------------------------------
export const inviteOwnerInput = z.object({
  company_id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email('auth.errors.emailInvalid'),
  full_name: z.string().trim().min(2, 'auth.errors.nameRequired'),
  language: z.enum(['en', 'ar']).default('en'),
});
export type InviteOwnerInput = z.input<typeof inviteOwnerInput>;

/** `existing`: the account already existed (no company yet) and was attached without a new e-mail. */
export const inviteOwnerOutput = z.object({ user_id: z.string().uuid(), existing: z.boolean() });
export type InviteOwnerOutput = z.infer<typeof inviteOwnerOutput>;

// ---------------------------------------------------------------------------
// ai-parse-ticket (FR-18, docs/DATABASE.md §8)
// ---------------------------------------------------------------------------
export const TICKET_MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
/** raw file size; the body carries it base64-encoded (~4/3 larger) */
export const TICKET_MAX_BYTES = 8 * 1024 * 1024;

export const parseTicketInput = z.object({
  media_type: z.enum(TICKET_MEDIA_TYPES),
  /** base64 without the `data:` prefix */
  data: z
    .string()
    .min(1)
    .max(Math.ceil(TICKET_MAX_BYTES / 3) * 4),
  file_name: z.string().max(255).optional(),
});
export type ParseTicketInput = z.infer<typeof parseTicketInput>;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeKey = z.string().regex(/^\d{2}:\d{2}$/);

/** Fields of a segment the model could not read clearly — the UI asks the user to check them. */
export const TICKET_SEGMENT_FIELDS = ['flight_no', 'airline', 'from_iata', 'to_iata', 'departure', 'arrival', 'terminal'] as const;

export const ticketSegment = z.object({
  /** "SV 1234" — airline designator, space, number */
  flight_no: z.string().min(2),
  airline: z.string().nullable(),
  from_iata: z.string().regex(/^[A-Z]{3}$/).nullable(),
  to_iata: z.string().regex(/^[A-Z]{3}$/).nullable(),
  /** airport (or city) names as printed */
  from_name: z.string().nullable(),
  to_name: z.string().nullable(),
  /** local time at the departure / arrival airport, as printed */
  departure_date: dateKey.nullable(),
  departure_time: timeKey.nullable(),
  arrival_date: dateKey.nullable(),
  arrival_time: timeKey.nullable(),
  departure_terminal: z.string().nullable(),
  arrival_terminal: z.string().nullable(),
  uncertain: z.array(z.enum(TICKET_SEGMENT_FIELDS)),
});
export type TicketSegment = z.infer<typeof ticketSegment>;

export const ticketPassenger = z.object({
  /** as printed, e.g. "ALOTAIBI/SARA MS" */
  name: z.string().min(1),
  ticket_no: z.string().nullable(),
});
export type TicketPassenger = z.infer<typeof ticketPassenger>;

export const parseTicketOutput = z.object({
  booking_ref: z.string().nullable(),
  issuer: z.string().nullable(),
  passengers: z.array(ticketPassenger),
  segments: z.array(ticketSegment).min(1),
});
export type ParseTicketOutput = z.infer<typeof parseTicketOutput>;
