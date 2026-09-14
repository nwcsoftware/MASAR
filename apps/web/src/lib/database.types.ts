/**
 * PLACEHOLDER — replaced by the generated file once the Supabase project is
 * linked and the migration applied:
 *
 *   supabase gen types typescript --local > apps/web/src/lib/database.types.ts
 *
 * Until then this keeps `createClient<Database>` type-safe-by-construction
 * without resorting to `any` (CLAUDE.md: no `any` on Supabase rows).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
