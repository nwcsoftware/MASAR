import { z } from 'zod';

/** Messages are i18n keys; forms translate them with t(). */
export const signInSchema = z.object({
  email: z.string().trim().min(1, 'auth.errors.emailRequired').email('auth.errors.emailInvalid'),
  password: z.string().min(8, 'auth.errors.passwordShort'),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const magicLinkSchema = z.object({
  email: z.string().trim().min(1, 'auth.errors.emailRequired').email('auth.errors.emailInvalid'),
});
export type MagicLinkValues = z.infer<typeof magicLinkSchema>;

export const acceptInviteSchema = z
  .object({
    fullName: z.string().trim().min(2, 'auth.errors.nameRequired'),
    password: z.string().min(8, 'auth.errors.passwordShort'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'auth.errors.passwordMismatch' });
export type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;
