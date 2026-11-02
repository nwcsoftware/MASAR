// Small HTTP helpers shared by the Edge Functions.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Errors carry an i18n key (`code`) the client translates, plus a developer message. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function handle(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ code: 'errors.methodNotAllowed' }, 405);
    try {
      return await fn(req);
    } catch (error) {
      if (error instanceof HttpError) return json({ code: error.code, message: error.message }, error.status);
      console.error(error);
      return json({ code: 'errors.generic' }, 500);
    }
  };
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, 'errors.notConfigured', `${name} is not set`);
  return value;
}
