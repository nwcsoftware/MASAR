import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useSession } from '@/features/auth/session';
import { supabase, type SupabaseClient } from '@/lib/supabase';

/**
 * Where domain data comes from. Signed in through Supabase → live tables
 * (RLS applies); demo mode → the in-memory mock store in src/mocks. Every
 * features/<domain>/queries.ts hook branches on this, never on env vars.
 */
export function useLiveData(): boolean {
  const session = useSession();
  return session.status === 'signed-in' && session.mode === 'supabase';
}

export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

/** Throws PostgREST / RPC errors so TanStack Query sees them. */
export function unwrap<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new AppError(result.error.message, result.error.code === '42501' ? 'errors.forbidden' : undefined);
  return result.data;
}

/** Error with an optional i18n key (`code`) the UI translates, falling back to `message`. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Call an Edge Function; non-2xx bodies `{code, message}` become AppErrors. */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { code?: string; message?: string } | null;
      throw new AppError(payload?.message ?? error.message, payload?.code);
    }
    throw new AppError(error.message);
  }
  return data as T;
}

/**
 * A write that runs against Supabase when live and against the mock store in
 * demo mode, then invalidates the given query keys either way.
 */
export function useDualMutation<TInput, TOutput>(options: {
  live: (input: TInput) => Promise<TOutput>;
  mock: (input: TInput) => TOutput | Promise<TOutput>;
  invalidate: (input: TInput) => QueryKey[];
}) {
  const live = useLiveData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => {
      if (live) return options.live(input);
      await new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : 250));
      return options.mock(input);
    },
    onSuccess: (_data, input) => Promise.all(options.invalidate(input).map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
