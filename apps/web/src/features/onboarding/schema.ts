import { z } from 'zod';

/** FR-01 company, FR-02 site, FR-04 invites. Messages are i18n keys. Shared with Edge Functions in Phase 1. */
export const companyStepSchema = z.object({
  name: z.string().trim().min(2, 'onboarding.errors.companyName'),
  name_ar: z.string().trim().optional(),
  country_code: z.string().length(2),
  timezone: z.string().min(1),
  default_language: z.enum(['en', 'ar']),
});
export type CompanyStepValues = z.infer<typeof companyStepSchema>;

export const siteStepSchema = z.object({
  name: z.string().trim().min(2, 'onboarding.errors.siteName'),
  name_ar: z.string().trim().optional(),
  type: z.enum(['construction_site', 'office', 'warehouse', 'other']),
  address: z.string().trim().optional(),
  // US-01: "Site form validates lat/lng"
  lat: z.number({ message: 'onboarding.errors.lat' }).min(-90, 'onboarding.errors.lat').max(90, 'onboarding.errors.lat'),
  lng: z.number({ message: 'onboarding.errors.lng' }).min(-180, 'onboarding.errors.lng').max(180, 'onboarding.errors.lng'),
});
export type SiteStepValues = z.infer<typeof siteStepSchema>;

export const inviteSchema = z.object({
  email: z.string().trim().email('auth.errors.emailInvalid'),
  role: z.enum(['admin', 'dispatcher', 'driver', 'viewer']),
});
export const invitesStepSchema = z.object({ invites: z.array(inviteSchema).max(20) });
export type InvitesStepValues = z.infer<typeof invitesStepSchema>;
