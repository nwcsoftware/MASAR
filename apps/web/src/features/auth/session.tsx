import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isLanguage, setLanguage } from '@/lib/i18n';
import { configureFormatting } from '@/lib/format';
import { mockDb } from '@/mocks/db';
import type { Tables } from '@/lib/database.types';

export type Profile = Tables<'profiles'>;
export type Company = Tables<'companies'>;

export interface SessionUser {
  id: string;
  email: string | null;
  profile: Profile;
  company: Company | null;
  /** drivers.id when the profile is linked to a driver record */
  driverId: string | null;
  /** user_sites scope; empty = all sites (auth_can_access_site) */
  siteIds: string[];
  /** platform super admin (0008): manages companies, belongs to none */
  isPlatformAdmin: boolean;
}

export type Session =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'signed-out' }
  | { status: 'signed-in'; mode: 'supabase' | 'demo'; user: SessionUser };

export type DemoRole = 'super' | 'owner' | 'dispatcher' | 'driver' | 'viewer' | 'passenger';

interface SessionApi {
  session: Session;
  /** true when VITE_SUPABASE_* are set; false → demo mode */
  isSupabase: boolean;
  signInWithPassword(email: string, password: string): Promise<void>;
  signInWithMagicLink(email: string): Promise<void>;
  /** passenger sign-up (0006); resolves `needsConfirmation` when Auth emails a confirmation link first */
  signUp(input: { email: string; password: string; fullName: string; language: 'en' | 'ar'; redirectTo?: string }): Promise<{ needsConfirmation: boolean }>;
  signInDemo(role: DemoRole): void;
  /** demo passenger sign-up (0006): sign in as the profile just created */
  signInDemoUser(userId: string): void;
  /** re-read profile + company (after onboarding creates the company) */
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

const DEMO_STORAGE_KEY = 'masar.demoUser';
export const DEMO_USERS: Record<DemoRole, string> = {
  super: '10000000-0000-4000-8000-000000000099',
  owner: '10000000-0000-4000-8000-000000000001',
  dispatcher: '10000000-0000-4000-8000-000000000002',
  driver: '10000000-0000-4000-8000-000000000011',
  viewer: '10000000-0000-4000-8000-000000000004',
  passenger: '10000000-0000-4000-8000-000000000021',
};

function readDemoUser(): string | null {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY);
  } catch {
    return null;
  }
}

function demoSessionUser(userId: string): SessionUser | null {
  const admin = mockDb.platformAdmins.find((p) => p.id === userId);
  if (admin) return { id: admin.id, email: admin.email, profile: admin, company: null, driverId: null, siteIds: [], isPlatformAdmin: true };
  const profile = mockDb.profiles.find((p) => p.id === userId);
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    profile,
    company: mockDb.company,
    driverId: mockDb.drivers.find((d) => d.profile_id === profile.id)?.id ?? null,
    siteIds: mockDb.userSites[profile.id] ?? [],
    isPlatformAdmin: false,
  };
}

async function loadSupabaseUser(userId: string, email: string | null): Promise<SessionUser> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;

  const [company, driver, scopes, platform] = await Promise.all([
    profile.company_id
      ? supabase.from('companies').select('*').eq('id', profile.company_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('drivers').select('id').eq('profile_id', userId).maybeSingle(),
    supabase.from('user_sites').select('site_id').eq('user_id', userId),
    // RLS: a user only sees their own platform_admins row (0008)
    supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (company.error) throw company.error;
  if (driver.error) throw driver.error;
  if (scopes.error) throw scopes.error;
  if (platform.error) throw platform.error;

  return {
    id: userId,
    email,
    profile,
    company: company.data,
    driverId: driver.data?.id ?? null,
    siteIds: (scopes.data ?? []).map((row) => row.site_id),
    isPlatformAdmin: Boolean(platform.data),
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const isSupabase = supabase !== null;

  // Supabase auth user (id + email) or the demo user; undefined while Supabase restores its session.
  const [authUser, setAuthUser] = useState<{ id: string; email: string | null } | null | undefined>(() => {
    if (isSupabase) return undefined;
    // a demo sign-up lives only in memory: after a reload its id is unknown → signed out
    const id = readDemoUser();
    return id && (mockDb.profiles.some((p) => p.id === id) || mockDb.platformAdmins.some((p) => p.id === id)) ? { id, email: null } : null;
  });

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      setAuthUser(user ? { id: user.id, email: user.email ?? null } : null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setAuthUser(user ? { id: user.id, email: user.email ?? null } : null);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const profileQuery = useQuery({
    queryKey: ['session', authUser?.id ?? null, isSupabase ? 'supabase' : 'demo'],
    enabled: Boolean(authUser),
    staleTime: Infinity,
    queryFn: async () => {
      if (!authUser) throw new Error('not signed in');
      if (isSupabase) return loadSupabaseUser(authUser.id, authUser.email);
      const user = demoSessionUser(authUser.id);
      if (!user) throw new Error('Unknown demo user');
      return user;
    },
  });

  // Apply the profile's language and the company's formatting once per sign-in.
  const user = profileQuery.data;
  useEffect(() => {
    if (!user) return;
    configureFormatting({ timeZone: user.company?.timezone ?? undefined });
    if (isSupabase && isLanguage(user.profile.language)) void setLanguage(user.profile.language);
  }, [user, isSupabase]);

  const session: Session = useMemo(() => {
    if (authUser === undefined) return { status: 'loading' };
    if (authUser === null) return { status: 'signed-out' };
    if (profileQuery.isError) return { status: 'error', error: profileQuery.error };
    if (!profileQuery.data) return { status: 'loading' };
    return { status: 'signed-in', mode: isSupabase ? 'supabase' : 'demo', user: profileQuery.data };
  }, [authUser, profileQuery.data, profileQuery.isError, profileQuery.error, isSupabase]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(
    async ({ email, password, fullName, language, redirectTo = '/register' }: { email: string; password: string; fullName: string; language: 'en' | 'ar'; redirectTo?: string }) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, language }, emailRedirectTo: `${window.location.origin}${redirectTo}` },
      });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },
    [],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['session'] });
  }, [queryClient]);

  const signInDemoUser = useCallback((id: string) => {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, id);
    } catch {
      /* storage blocked — session lasts for this tab only */
    }
    setAuthUser({ id, email: null });
  }, []);
  const signInDemo = useCallback((role: DemoRole) => signInDemoUser(DEMO_USERS[role]), [signInDemoUser]);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      try {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      } catch {
        /* storage blocked */
      }
      setAuthUser(null);
    }
    queryClient.clear();
  }, [queryClient]);

  const api = useMemo<SessionApi>(
    () => ({ session, isSupabase, signInWithPassword, signInWithMagicLink, signUp, signInDemo, signInDemoUser, refresh, signOut }),
    [session, isSupabase, signInWithPassword, signInWithMagicLink, signUp, signInDemo, signInDemoUser, refresh, signOut],
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSessionApi(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error('useSessionApi must be used inside <SessionProvider>');
  return api;
}

/** Current session (CLAUDE.md Phase 0: "profiles loaded into a useSession() hook"). */
export function useSession(): Session {
  return useSessionApi().session;
}

/** For components rendered inside authenticated layouts only. */
export function useCurrentUser(): SessionUser & { mode: 'supabase' | 'demo' } {
  const session = useSession();
  if (session.status !== 'signed-in') throw new Error('useCurrentUser called outside an authenticated route');
  return { ...session.user, mode: session.mode };
}
