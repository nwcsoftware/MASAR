import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError, requireEnv } from './http.ts';

export interface Caller {
  id: string;
  role: 'owner' | 'admin' | 'dispatcher' | 'driver' | 'viewer';
  company_id: string;
  /** client acting as the caller — RLS applies */
  db: SupabaseClient;
}

/** Resolve the signed-in caller and their profile from the request JWT. */
export async function getCaller(req: Request): Promise<Caller> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw new HttpError(401, 'errors.unauthorized');
  const db = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await db.auth.getUser();
  if (userError || !userData.user) throw new HttpError(401, 'errors.unauthorized');

  const { data: profile, error } = await db
    .from('profiles')
    .select('role, company_id, is_active')
    .eq('id', userData.user.id)
    .single();
  if (error || !profile?.company_id || !profile.is_active) throw new HttpError(403, 'errors.forbidden');
  return { id: userData.user.id, role: profile.role, company_id: profile.company_id, db };
}

export function requireRole(caller: Caller, roles: Caller['role'][]) {
  if (!roles.includes(caller.role)) throw new HttpError(403, 'errors.forbidden');
}

/** Service-role client — bypasses RLS; use only after authorising the caller. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
