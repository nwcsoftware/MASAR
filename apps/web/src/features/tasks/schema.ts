import { z } from 'zod';
import { ROUTE_MAX_STOPS } from '@shared/schemas';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tasks.errors.date');
const time = z.string().regex(/^\d{2}:\d{2}$/, 'tasks.errors.time');
const optionalText = z.string().trim().optional();

/** One ordered stop in the wizard (FR-10). The first stop is the origin. */
export const stopSchema = z
  .object({
    /** client-side key for list rendering; not persisted */
    key: z.string(),
    kind: z.enum(['site', 'airport', 'place']),
    site_id: z.string().nullable(),
    airport_id: z.string().nullable(),
    label: z.string().trim().min(1, 'tasks.errors.stopLabel'),
    address: optionalText,
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    dwell_min: z.number({ message: 'tasks.errors.dwell' }).int('tasks.errors.dwell').min(0, 'tasks.errors.dwell').max(600, 'tasks.errors.dwell'),
    contact_name: optionalText,
    contact_phone: optionalText,
  })
  .refine((s) => s.lat != null && s.lng != null && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180, {
    path: ['lat'],
    message: 'tasks.errors.stopCoords',
  });
export type StopValues = z.infer<typeof stopSchema>;

/**
 * A passenger (0004): a directory person (person_id) or a one-time visitor
 * given a group for the trip. grade / group_code are display copies; the
 * server re-reads them from the directory on save.
 */
export const passengerSchema = z.object({
  person_id: z.string().optional(),
  name: z.string().trim().min(1, 'tasks.errors.passengerName'),
  phone: optionalText,
  visitor: z.boolean().optional(),
  group_id: z.string().nullable().optional(),
  grade: z.number().nullable().optional(),
  group_code: z.string().nullable().optional(),
});
export type PassengerValues = z.infer<typeof passengerSchema>;

/** FR-13 airport fields; the flight time is company wall-clock time. */
export const flightSchema = z.object({
  airport_id: z.string().min(1, 'tasks.errors.airport'),
  direction: z.enum(['arrival', 'departure']),
  airline: optionalText,
  flight_no: z.string().trim().toUpperCase().min(2, 'tasks.errors.flightNo'),
  terminal: optionalText,
  date,
  time,
  buffer_min: z.number({ message: 'sites.errors.buffer' }).int().min(0, 'sites.errors.buffer').max(240, 'sites.errors.buffer'),
});
export type FlightValues = z.infer<typeof flightSchema>;

/**
 * FR-18 the rest of the ticket, kept in tasks.metadata.ticket. "Other end" =
 * where the flight comes from (arrival) or goes to (departure); the driver's
 * airport and time are the flight fields above. Times are local, as printed.
 */
export const ticketDetailsSchema = z.object({
  other_iata: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{3})?$/, 'tasks.errors.iata'),
  other_name: optionalText,
  other_date: z.union([date, z.literal('')]),
  other_time: z.union([time, z.literal('')]),
  other_terminal: optionalText,
  booking_ref: optionalText,
  issuer: optionalText,
  /** e-ticket numbers by passenger name as printed */
  tickets: z.array(z.object({ name: z.string(), ticket_no: z.string().nullable() })),
});
export type TicketDetailsValues = z.infer<typeof ticketDetailsSchema>;

/**
 * Task wizard form (FR-10 … FR-16). Validated per step with trigger(fields);
 * the full schema runs again on save. Messages are i18n keys.
 */
export const taskFormSchema = z
  .object({
    category: z.enum(['daily_routine', 'airport', 'document_delivery', 'escort']),
    site_id: z.string().min(1, 'tasks.errors.site'),
    title: z.string().trim().min(2, 'tasks.errors.title'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    description: optionalText,
    passengers: z.array(passengerSchema),
    flight: flightSchema.nullable(),
    ticket: ticketDetailsSchema,
    /** document_delivery: kept in tasks.metadata */
    recipient_name: optionalText,
    document_ref: optionalText,
    stops: z.array(stopSchema).min(2, 'tasks.errors.stopsMin').max(ROUTE_MAX_STOPS, 'tasks.errors.stopsMax'),
    date,
    start_time: time,
    duration_min: z
      .number({ message: 'tasks.errors.duration' })
      .int('tasks.errors.duration')
      .min(5, 'tasks.errors.duration')
      .max(24 * 60, 'tasks.errors.duration'),
    driver_id: z.string().nullable(),
    vehicle_id: z.string().nullable(),
    share_with_task_id: z.string().nullable(),
    override_reason: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.category === 'airport' && !v.flight) ctx.addIssue({ code: 'custom', path: ['flight'], message: 'tasks.errors.flightNo' });
    if (v.share_with_task_id && v.driver_id) ctx.addIssue({ code: 'custom', path: ['driver_id'], message: 'share.errors.riderAssigned' });
  });
export type TaskFormValues = z.infer<typeof taskFormSchema>;

/** Fields each wizard step validates before moving on. */
export const STEP_FIELDS = {
  category: ['category'],
  details: ['site_id', 'title', 'priority', 'passengers', 'flight', 'ticket', 'recipient_name', 'document_ref'],
  stops: ['stops'],
  schedule: ['date', 'start_time', 'duration_min'],
  assign: ['driver_id', 'vehicle_id', 'share_with_task_id'],
  review: [],
} as const satisfies Record<string, readonly (keyof TaskFormValues)[]>;
export type WizardStep = keyof typeof STEP_FIELDS;
export const WIZARD_STEPS = Object.keys(STEP_FIELDS) as WizardStep[];
