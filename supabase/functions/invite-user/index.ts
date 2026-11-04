/**
 * invite-user (FR-04)
 *
 * POST InviteUserInput → {user_id, driver_id}
 *
 * Owner/admin invites a person by email with a role and site scope. Supabase
 * Auth emails the invite (link → /accept-invite); this function then attaches
 * the new profile to the caller's company, sets role + user_sites, and for
 * drivers creates (or links) the drivers row. Runs with the service role
 * after authorising the caller, so the 0002 profile guard does not apply.
 */
import { adminClient, getCaller, requireRole } from '../_shared/auth.ts';
import { handle, HttpError, json } from '../_shared/http.ts';
import { inviteUserInput } from '../_shared/schemas.ts';

Deno.serve(
  handle(async (req) => {
    const caller = await getCaller(req);
    requireRole(caller, ['owner', 'admin']);

    const parsed = inviteUserInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'errors.invalidInput', parsed.error.message);
    const input = parsed.data;
    const admin = adminClient();

    // Every referenced site / driver must belong to the caller's company.
    const siteIds = [...new Set([...input.site_ids, ...(input.home_site_id ? [input.home_site_id] : [])])];
    if (siteIds.length) {
      const { count, error } = await admin
        .from('sites')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', caller.company_id)
        .in('id', siteIds);
      if (error) throw error;
      if (count !== siteIds.length) throw new HttpError(400, 'users.errors.unknownSite');
    }
    if (input.driver_id) {
      const { data: driver, error } = await admin
        .from('drivers')
        .select('id, profile_id')
        .eq('id', input.driver_id)
        .eq('company_id', caller.company_id)
        .maybeSingle();
      if (error) throw error;
      if (!driver) throw new HttpError(400, 'users.errors.unknownDriver');
      if (driver.profile_id) throw new HttpError(409, 'users.errors.driverLinked');
    }

    const { data: company } = await admin.from('companies').select('name').eq('id', caller.company_id).single();
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';
    const redirectTo = new URL('/accept-invite', siteUrl);
    redirectTo.searchParams.set('email', input.email);
    if (company?.name) redirectTo.searchParams.set('company', company.name);

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.full_name, language: input.language },
      redirectTo: redirectTo.toString(),
    });
    if (inviteError || !invited.user) {
      const exists = inviteError?.message.toLowerCase().includes('already');
      throw new HttpError(exists ? 409 : 502, exists ? 'users.errors.alreadyRegistered' : 'users.errors.inviteFailed', inviteError?.message);
    }
    const userId = invited.user.id;

    // on_auth_user_created made the profile; attach it to the company.
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        company_id: caller.company_id,
        role: input.role,
        full_name: input.full_name,
        full_name_ar: input.full_name_ar || null,
        phone: input.phone || null,
        language: input.language,
      })
      .eq('id', userId);
    if (profileError) throw profileError;

    if (input.site_ids.length && input.role !== 'driver') {
      const { error } = await admin.from('user_sites').insert(input.site_ids.map((site_id) => ({ user_id: userId, site_id })));
      if (error) throw error;
    }

    let driverId: string | null = null;
    if (input.role === 'driver') {
      if (input.driver_id) {
        const { error } = await admin.from('drivers').update({ profile_id: userId }).eq('id', input.driver_id);
        if (error) throw error;
        driverId = input.driver_id;
      } else {
        const { data: driver, error } = await admin
          .from('drivers')
          .insert({
            company_id: caller.company_id,
            profile_id: userId,
            full_name: input.full_name,
            full_name_ar: input.full_name_ar || null,
            phone: input.phone || null,
            home_site_id: input.home_site_id ?? null,
          })
          .select('id')
          .single();
        if (error) throw error;
        driverId = driver.id;
      }
    }

    return json({ user_id: userId, driver_id: driverId });
  }),
);
