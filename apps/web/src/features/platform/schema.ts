import { z } from 'zod';
import { companyProfileSchema } from '@/features/company/schema';

/**
 * FR-01 (0008) — the super admin creates a company and names its owner in one
 * form: rpc_platform_create_company, then the invite-owner Edge Function.
 */
export const newCompanySchema = companyProfileSchema.omit({ eastern_arabic_digits: true }).extend({
  owner_name: z.string().trim().min(2, 'auth.errors.nameRequired'),
  owner_email: z.string().trim().toLowerCase().email('auth.errors.emailInvalid'),
});
export type NewCompanyValues = z.infer<typeof newCompanySchema>;

/** Invite (or re-invite) the owner of an existing company. */
export const ownerInviteSchema = newCompanySchema.pick({ owner_name: true, owner_email: true });
export type OwnerInviteValues = z.infer<typeof ownerInviteSchema>;
