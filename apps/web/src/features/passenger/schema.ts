import { z } from 'zod';

/**
 * §1 passenger sign-up: a company e-mail (domain allow-list) or the
 * company's join code + employee ID. Messages are i18n keys.
 */
export const passengerSignUpSchema = z
  .object({
    fullName: z.string().trim().min(2, 'auth.errors.nameRequired'),
    email: z.string().trim().min(1, 'auth.errors.emailRequired').email('auth.errors.emailInvalid'),
    password: z.string(),
    phone: z.string().trim().optional(),
    method: z.enum(['email', 'employee']),
    employeeNo: z.string().trim().optional(),
    joinCode: z.string().trim().optional(),
    language: z.enum(['en', 'ar']),
    /** false when finishing registration after e-mail confirmation (already signed in) */
    needsPassword: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.needsPassword && v.password.length < 8) ctx.addIssue({ code: 'custom', path: ['password'], message: 'auth.errors.passwordShort' });
    if (v.method === 'employee') {
      if (!v.employeeNo) ctx.addIssue({ code: 'custom', path: ['employeeNo'], message: 'passenger.errors.employeeNo' });
      if (!v.joinCode) ctx.addIssue({ code: 'custom', path: ['joinCode'], message: 'passenger.errors.joinCodeRequired' });
    }
  });
export type PassengerSignUpValues = z.infer<typeof passengerSignUpSchema>;

/**
 * §10 trip requests: a new trip (when + where), moving a trip (new time) or
 * cancelling it (a reason helps dispatch). `date` + `time` are company-local.
 */
export const tripRequestSchema = z
  .object({
    kind: z.enum(['new', 'reschedule', 'cancel']),
    date: z.string().optional(),
    time: z.string().optional(),
    pickup: z.string().trim().max(300).optional(),
    dropoff: z.string().trim().max(300).optional(),
    passengers_count: z.number().int().min(1, 'requests.errors.passengers').max(20, 'requests.errors.passengers'),
    notes: z.string().trim().max(1000, 'requests.errors.notesLong').optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== 'cancel') {
      if (!v.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'requests.errors.dateRequired' });
      if (!v.time) ctx.addIssue({ code: 'custom', path: ['time'], message: 'requests.errors.timeRequired' });
    }
    if (v.kind === 'new') {
      if (!v.pickup) ctx.addIssue({ code: 'custom', path: ['pickup'], message: 'requests.errors.pickup' });
      if (!v.dropoff) ctx.addIssue({ code: 'custom', path: ['dropoff'], message: 'requests.errors.dropoff' });
    }
  });
export type TripRequestValues = z.infer<typeof tripRequestSchema>;
