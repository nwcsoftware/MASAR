/**
 * Dev server only (vite.config.ts → /__dev/ai-parse-ticket) — never imported
 * by the app. Lets demo mode read real tickets with the same prompt and
 * clean-up as the `ai-parse-ticket` Edge Function, using ANTHROPIC_API_KEY
 * from apps/web/.env.local (no VITE_ prefix, so it never reaches the browser).
 */
import Anthropic from '@anthropic-ai/sdk';
import { parseTicketInput, type ParseTicketOutput } from '@shared/schemas';
import { finishTicket, TICKET_JSON_SCHEMA, TICKET_MODEL, TICKET_SYSTEM, TICKET_USER_PROMPT, TicketReadError } from '@shared/ticket-reader';

export { TicketReadError };

export async function readTicket(body: unknown, apiKey: string): Promise<ParseTicketOutput> {
  const input = parseTicketInput.safeParse(body);
  if (!input.success) throw new TicketReadError(400, 'ticketImport.errors.invalidFile', input.error.message);
  const { media_type, data } = input.data;

  const anthropic = new Anthropic({ apiKey });
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
      if (error instanceof Anthropic.AuthenticationError) throw new TicketReadError(500, 'ticketImport.errors.devBadKey', error.message);
      if (error instanceof Anthropic.BadRequestError) throw new TicketReadError(422, 'ticketImport.errors.unreadable', error.message);
      throw error;
    });

  const text = response.content.find((block) => block.type === 'text');
  return finishTicket(response.stop_reason, text?.type === 'text' ? text.text : undefined);
}
