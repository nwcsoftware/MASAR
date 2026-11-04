/**
 * ai-parse-ticket (FR-18) — the prompt, output schema and clean-up shared by
 * the Edge Function and the web dev server (demo mode, apps/web/vite.config.ts),
 * so both read tickets the same way. The Claude call itself stays with each
 * caller (Deno vs Node SDK import).
 *
 * Only depends on `zod`.
 */
import { z } from 'zod';
import { parseTicketOutput, TICKET_SEGMENT_FIELDS, type ParseTicketOutput, type TicketSegment } from './schemas.ts';

export const TICKET_MODEL = 'claude-opus-5-5';

/** Thrown for tickets that can't be used; `code` is an i18n key. */
export class TicketReadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const nullableString = { type: ['string', 'null'] } as const;
const SEGMENT_FIELDS = [
  'flight_no',
  'airline',
  'from_iata',
  'from_name',
  'to_iata',
  'to_name',
  'departure_date',
  'departure_time',
  'arrival_date',
  'arrival_time',
  'departure_terminal',
  'arrival_terminal',
  'uncertain',
];

export const TICKET_JSON_SCHEMA: { [key: string]: unknown } = {
  type: 'object',
  additionalProperties: false,
  required: ['is_ticket', 'booking_ref', 'issuer', 'passengers', 'segments'],
  properties: {
    is_ticket: { type: 'boolean', description: 'True if the document is a flight ticket, e-ticket receipt, itinerary, booking confirmation or boarding pass' },
    booking_ref: { ...nullableString, description: 'Booking reference / PNR / record locator' },
    issuer: { ...nullableString, description: 'Travel agency or airline that issued the document' },
    passengers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'ticket_no'],
        properties: {
          name: { type: 'string', description: 'Passenger name exactly as printed (e.g. "ALOTAIBI/SARA MS")' },
          ticket_no: { ...nullableString, description: 'E-ticket number' },
        },
      },
    },
    segments: {
      type: 'array',
      description: 'One entry per flight, in travel order',
      items: {
        type: 'object',
        additionalProperties: false,
        required: SEGMENT_FIELDS,
        properties: {
          flight_no: { type: 'string', description: 'Airline designator and number, e.g. "SV 1234"' },
          airline: { ...nullableString, description: 'Operating airline name in English' },
          from_iata: { ...nullableString, description: 'Departure airport IATA code (3 letters)' },
          from_name: { ...nullableString, description: 'Departure airport or city as printed' },
          to_iata: { ...nullableString, description: 'Arrival airport IATA code (3 letters)' },
          to_name: { ...nullableString, description: 'Arrival airport or city as printed' },
          departure_date: { ...nullableString, description: 'YYYY-MM-DD, local at the departure airport' },
          departure_time: { ...nullableString, description: 'HH:MM 24-hour, local at the departure airport' },
          arrival_date: { ...nullableString, description: 'YYYY-MM-DD, local at the arrival airport' },
          arrival_time: { ...nullableString, description: 'HH:MM 24-hour, local at the arrival airport' },
          departure_terminal: { ...nullableString, description: 'Terminal at the departure airport, e.g. "1" or "North"' },
          arrival_terminal: { ...nullableString, description: 'Terminal at the arrival airport' },
          uncertain: {
            type: 'array',
            description: 'Fields of this segment that were unclear, ambiguous or inferred rather than printed',
            items: { type: 'string', enum: [...TICKET_SEGMENT_FIELDS] },
          },
        },
      },
    },
  },
};

export const TICKET_SYSTEM = `You read flight tickets for a driver-dispatch app in Saudi Arabia and the Gulf. Drivers meet staff at the airport when they land and drop them off before they fly, so every flight's number, airline, departure and arrival airports, dates, local times and terminals must be exactly what the document says.
Documents come from many travel agencies and airlines, each with its own layout, and may be in English, Arabic or both. They can be e-ticket receipts, itineraries, booking confirmations or boarding passes, sometimes scanned or photographed. Read every page.
For each flight, fill in both ends: the departure airport and the arrival airport. Give the IATA code of each. When the document prints only an airport or city name (for example "Riyadh - King Khalid Intl" or "الرياض"), give that airport's IATA code and list the field ("from_iata" or "to_iata") as uncertain; for a city with several airports, pick the one the flight uses if the document says so, otherwise the main one, and mark it uncertain.
Report dates as YYYY-MM-DD and times in 24-hour HH:MM exactly as printed (local time at that airport) — never convert time zones. Tickets often print dates like "05NOV" or "05/11": use the year printed elsewhere on the document, or the next such date after the issue date. If the arrival date is not printed, derive it from the departure date and any "+1" marker and list "arrival" as uncertain.
Use null only when a value is really not on the document. List a field in "uncertain" whenever it was hard to read, ambiguous, or inferred.
Include every passenger with their e-ticket number. Skip cancelled or superseded flights. If the document is not a flight ticket or itinerary, set is_ticket to false and return empty lists.`;

export const TICKET_USER_PROMPT = 'Extract every flight and passenger from this ticket.';

const llmTicket = z.object({
  is_ticket: z.boolean(),
  booking_ref: z.string().nullable(),
  issuer: z.string().nullable(),
  passengers: z.array(z.object({ name: z.string(), ticket_no: z.string().nullable() })),
  segments: z.array(
    z.object({
      flight_no: z.string(),
      airline: z.string().nullable(),
      from_iata: z.string().nullable(),
      from_name: z.string().nullable(),
      to_iata: z.string().nullable(),
      to_name: z.string().nullable(),
      departure_date: z.string().nullable(),
      departure_time: z.string().nullable(),
      arrival_date: z.string().nullable(),
      arrival_time: z.string().nullable(),
      departure_terminal: z.string().nullable(),
      arrival_terminal: z.string().nullable(),
      uncertain: z.array(z.enum(TICKET_SEGMENT_FIELDS)),
    }),
  ),
});
type LlmSegment = z.infer<typeof llmTicket>['segments'][number];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const FLIGHT_NO = /^([A-Z0-9]{2}[A-Z]?)(\d{1,4}[A-Z]?)$/;

const clean = (v: string | null) => (v?.trim() ? v.trim() : null);

/** Normalise one segment; malformed values become null and are flagged for the user to check. */
function normaliseSegment(s: LlmSegment): TicketSegment | null {
  const uncertain = new Set(s.uncertain);
  const iata = (v: string | null, field: 'from_iata' | 'to_iata') => {
    const code = clean(v)?.toUpperCase() ?? null;
    if (code && /^[A-Z]{3}$/.test(code)) return code;
    uncertain.add(field);
    return null;
  };
  const when = (date: string | null, time: string | null, field: 'departure' | 'arrival') => {
    const d = clean(date);
    const t = clean(time)?.replace('.', ':').padStart(5, '0') ?? null;
    const ok = { date: d && DATE.test(d) ? d : null, time: t && TIME.test(t) ? t : null };
    if (!ok.date || !ok.time) uncertain.add(field);
    return ok;
  };

  // the wizard needs a flight number; a segment without one is of no use
  const raw = s.flight_no.trim().toUpperCase().replace(/[-\s]+/g, '');
  if (raw.length < 2) return null;
  const match = FLIGHT_NO.exec(raw);
  if (!match) uncertain.add('flight_no');
  const flightNo = match ? `${match[1]} ${match[2]}` : raw;

  const dep = when(s.departure_date, s.departure_time, 'departure');
  const arr = when(s.arrival_date, s.arrival_time, 'arrival');
  // a flight lands at most ~2 days (date line) after it leaves
  if (dep.date && arr.date) {
    const days = (Date.parse(arr.date) - Date.parse(dep.date)) / 86_400_000;
    if (days < -1 || days > 2) uncertain.add('arrival');
  }

  return {
    flight_no: flightNo,
    airline: clean(s.airline),
    from_iata: iata(s.from_iata, 'from_iata'),
    to_iata: iata(s.to_iata, 'to_iata'),
    from_name: clean(s.from_name),
    to_name: clean(s.to_name),
    departure_date: dep.date,
    departure_time: dep.time,
    arrival_date: arr.date,
    arrival_time: arr.time,
    departure_terminal: clean(s.departure_terminal),
    arrival_terminal: clean(s.arrival_terminal),
    uncertain: TICKET_SEGMENT_FIELDS.filter((f) => uncertain.has(f)),
  };
}

/** Claude's reply (stop reason + JSON text) → the checked contract. */
export function finishTicket(stopReason: string | null, text: string | undefined): ParseTicketOutput {
  if (stopReason === 'refusal') throw new TicketReadError(502, 'ticketImport.errors.aiFailed', 'Claude declined the request');
  if (stopReason === 'max_tokens') throw new TicketReadError(502, 'ticketImport.errors.aiFailed', 'Claude output was truncated');
  if (!text) throw new TicketReadError(502, 'ticketImport.errors.aiFailed', 'No text in Claude response');

  const parsed = llmTicket.safeParse(JSON.parse(text));
  if (!parsed.success) throw new TicketReadError(502, 'ticketImport.errors.aiFailed', parsed.error.message);
  if (!parsed.data.is_ticket) throw new TicketReadError(422, 'ticketImport.errors.notATicket');

  const segments = parsed.data.segments.map(normaliseSegment).filter((s): s is TicketSegment => s !== null);
  if (!segments.length) throw new TicketReadError(422, 'ticketImport.errors.noFlights');

  return parseTicketOutput.parse({
    booking_ref: clean(parsed.data.booking_ref),
    issuer: clean(parsed.data.issuer),
    passengers: parsed.data.passengers.map((p) => ({ name: p.name.trim(), ticket_no: clean(p.ticket_no) })).filter((p) => p.name),
    segments,
  });
}
