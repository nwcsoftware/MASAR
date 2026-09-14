/**
 * Typed access to the Vite env. Fails loudly in dev when a required key is
 * missing rather than producing a broken Supabase client at call time.
 */
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

type RequiredKey = (typeof required)[number];

function read(key: RequiredKey): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing ${key}. Copy apps/web/.env.example to apps/web/.env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return read('VITE_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return read('VITE_SUPABASE_ANON_KEY');
  },
  /** Browser key — restricted by HTTP referrer. Server key lives only in Edge Functions. */
  get googleMapsBrowserKey() {
    return import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? '';
  },
  get isConfigured() {
    return required.every((key) => Boolean(import.meta.env[key]));
  },
} as const;
