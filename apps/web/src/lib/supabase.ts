import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import type { Database } from './database.types';

/**
 * Single Supabase client for the app (web, Tauri and driver PWA all share it).
 *
 * Regenerate `database.types.ts` after every migration:
 *   supabase gen types typescript --local > apps/web/src/lib/database.types.ts
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export type SupabaseClient = typeof supabase;
