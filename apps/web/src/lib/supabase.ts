import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import type { Database } from './database.types';

/**
 * Single Supabase client for the app (web, Tauri and driver PWA all share it).
 *
 * `null` until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set in
 * apps/web/.env.local — the app then runs in demo mode (mock data, role
 * picker on the login screen) instead of crashing at import time.
 *
 * Regenerate `database.types.ts` after every migration:
 *   pnpm supabase gen types typescript --local > apps/web/src/lib/database.types.ts
 */
export const supabase = env.isConfigured
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null;

export type SupabaseClient = NonNullable<typeof supabase>;
