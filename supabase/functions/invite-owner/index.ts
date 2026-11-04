/**
 * invite-owner (FR-01, migration 0008)
 *
 * POST InviteOwnerInput → {user_id, existing}
 *
 * The platform super admin invites the owner of a company they created
 * (rpc_platform_create_company). Supabase Auth e-mails the invite (link →
 * /accept-invite); the new profile is attached to the company as `owner`.
 * An account that already exists but has no company yet (e.g. an old
 * self-service sign-up) is attached directly. Runs with the service role
 * after authorising the caller, so the 0002 profile guard does not apply.
 */
import { adminClient, getPlatformAdmin } from '../_shared/auth.ts';
import { handle, HttpError, json } from '../_shared/http.ts';
import { inviteOwnerInput } from '../_shared/schemas.ts';

Deno.serve(
  handle(async (req) => {
    await getPlatformAdmin(req);

    const parsed = inviteOwnerInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'errors.invalidInput', parsed.error.message);
    const input = parsed.data;
    const admin = adminClient();

    const { data: company, error: companyError } = await admin.from('companies').select('id, name').eq('id', input.company_id).maybeSingle();
    if (companyError) throw companyError;
    if (!company) throw new HttpError(404, 'platform.errors.unknownCompany');

    const attach = async (userId: string) => {
      const { error } = await admin
        .from('profiles')
        .update({ company_id: company.id, role: 'owner', full_name: input.full_name, language: input.language, is_active: true })
        .eq('id', userId);
      if (error) throw error;
    };

    // An existing account can become owner only while it belongs to no company.
    const { data: existing, error: existingError } = await admin.from('profiles').select('id, company_id').eq('email', input.email).maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.company_id) throw new HttpError(409, 'platform.errors.ownerInCompany');
      const { data: platformRow } = await admin.from('platform_admins').select('user_id').eq('user_id', existing.id).maybeSingle();
      if (platformRow) throw new HttpError(409, 'platform.errors.ownerIsPlatformAdmin');
      await attach(existing.id);
      return json({ user_id: existing.id, existing: true });
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';
    const redirectTo = new URL('/accept-invite', siteUrl);
    redirectTo.searchParams.set('email', input.email);
    redirectTo.searchParams.set('company', company.name);
    redirectTo.searchParams.set('next', '/onboarding');

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.full_name, language: input.language },
      redirectTo: redirectTo.toString(),
    });
    if (inviteError || !invited.user) throw new HttpError(502, 'users.errors.inviteFailed', inviteError?.message);

    // on_auth_user_created made the profile; attach it to the company as owner.
    await attach(invited.user.id);
    return json({ user_id: invited.user.id, existing: false });
  }),
);
