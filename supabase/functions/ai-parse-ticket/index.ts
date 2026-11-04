/**
 * ai-parse-ticket (FR-18, docs/DATABASE.md §8)
 *
 * POST {media_type, data (base64), file_name?} → {booking_ref, issuer, passengers[], segments[]}
 *
 * Reads a flight ticket / itinerary in whatever layout the issuing agency
 * uses (PDF, scan or photo) with Claude and returns its flights (both ends)
 * and passengers. Nothing is stored: the file only passes through this
 * function. The wizard shows the result for review before anything is applied.
 * Prompt, schema and clean-up: _shared/ticket-reader.ts (also used by the web
 * dev server in demo mode).
 *
 * Staff only — runs on explicit user action (NFR-07).
 * Secret: ANTHROPIC_API_KEY.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getCaller, requireRole } from '../_shared/auth.ts';
import { handle, HttpError, json, requireEnv } from '../_shared/http.ts';
import { parseTicketInput } from '../_shared/schemas.ts';
import { finishTicket, TICKET_JSON_SCHEMA, TICKET_MODEL, TICKET_SYSTEM, TICKET_USER_PROMPT, TicketReadError } from '../_shared/ticket-reader.ts';

Deno.serve(
  handle(async (req) => {
    const caller = await getCaller(req);
    requireRole(caller, ['owner', 'admin', 'dispatcher']);

    const input = parseTicketInput.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new HttpError(400, 'ticketImport.errors.invalidFile', input.error.message);
    const { media_type, data } = input.data;

    const anthropic = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
    const response = await anthropic.beta.messages
      .create({
        model: TICKET_MODEL,
        max_tokens: 16000,
        // A declined request is re-run server-side on Anthropic's recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high', format: { type: 'json_schema', schema: TICKET_JSON_SCHEMA } },
        system: TICKET_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              media_type === 'application/pdf'
                ? { type: 'document', source: { type: 'base64', media_type, data } }
                : { type: 'image', source: { type: 'base64', media_type, data } },
              { type: 'text', text: TICKET_USER_PROMPT },
            ],
          },
        ],
      })
      .catch((error: unknown) => {
        // encrypted / corrupt PDF, image the API can't decode …
        if (error instanceof Anthropic.BadRequestError) throw new HttpError(422, 'ticketImport.errors.unreadable', error.message);
        throw error;
      });

    const text = response.content.find((block) => block.type === 'text');
    try {
      return json(finishTicket(response.stop_reason, text?.type === 'text' ? text.text : undefined));
    } catch (error) {
      if (error instanceof TicketReadError) throw new HttpError(error.status, error.code, error.message);
      throw error;
    }
  }),
);
