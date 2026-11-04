import { TICKET_MAX_BYTES, TICKET_MEDIA_TYPES, type ParseTicketOutput, type TicketSegment } from '@shared/schemas';
import type { FlightValues, TicketDetailsValues } from '@/features/tasks/schema';
import type { SiteWithAirports } from '@/features/sites/queries';
import { AppError } from '@/lib/data-source';
import type { Airport, Person } from '@/mocks/fixtures';

/**
 * FR-18 ticket import — turns what ai-parse-ticket read into wizard values.
 * A ticket can hold several flights; each one landing at or leaving from a
 * known airport becomes a choice (arrival / departure trip).
 */

export type TicketMediaType = (typeof TICKET_MEDIA_TYPES)[number];

/** Flight-card fields the user is asked to double-check after an import. */
export type FlightField = 'airport_id' | 'flight_no' | 'airline' | 'date' | 'time' | 'terminal' | 'other_iata' | 'other_date' | 'other_time';

export interface TicketOption {
  key: string;
  segment: TicketSegment;
  direction: FlightValues['direction'];
  /** the driver's airport; null when it isn't set up in Masar */
  airport: Airport | null;
  iata: string | null;
  /** airport name as printed on the ticket */
  printedName: string | null;
  /** the airport is one of the task site's airports */
  siteAirport: boolean;
  date: string | null;
  time: string | null;
  terminal: string | null;
  /** the far end: origin of an arrival, destination of a departure */
  other: { iata: string | null; name: string | null; date: string | null; time: string | null; terminal: string | null };
  uncertain: FlightField[];
}

export function ticketOptions(ticket: ParseTicketOutput, airports: Airport[], site: SiteWithAirports | undefined): TicketOption[] {
  const byIata = new Map(airports.filter((a) => a.iata).map((a) => [a.iata!.toUpperCase(), a]));
  const siteIds = new Set(site?.airports.map((sa) => sa.airport_id));
  const options: TicketOption[] = [];

  ticket.segments.forEach((segment, i) => {
    const has = (field: TicketSegment['uncertain'][number]) => segment.uncertain.includes(field);
    const add = (direction: FlightValues['direction']) => {
      const arrival = direction === 'arrival';
      const iata = arrival ? segment.to_iata : segment.from_iata;
      const printedName = arrival ? segment.to_name : segment.from_name;
      if (!iata && !printedName) return;
      const airport = (iata && byIata.get(iata)) || null;
      const date = arrival ? segment.arrival_date : segment.departure_date;
      const time = arrival ? segment.arrival_time : segment.departure_time;
      const other = arrival
        ? { iata: segment.from_iata, name: segment.from_name, date: segment.departure_date, time: segment.departure_time, terminal: segment.departure_terminal }
        : { iata: segment.to_iata, name: segment.to_name, date: segment.arrival_date, time: segment.arrival_time, terminal: segment.arrival_terminal };
      const here = arrival ? 'arrival' : 'departure';
      const there = arrival ? 'departure' : 'arrival';

      const uncertain: FlightField[] = [];
      if (has('flight_no')) uncertain.push('flight_no');
      if (has('airline') || !segment.airline) uncertain.push('airline');
      if (has('terminal')) uncertain.push('terminal');
      if (!airport || has(arrival ? 'to_iata' : 'from_iata')) uncertain.push('airport_id');
      if (has(here) || !date) uncertain.push('date');
      if (has(here) || !time) uncertain.push('time');
      if (has(arrival ? 'from_iata' : 'to_iata') || !other.iata) uncertain.push('other_iata');
      if (has(there) || !other.date) uncertain.push('other_date');
      if (has(there) || !other.time) uncertain.push('other_time');

      options.push({
        key: `${i}-${direction}`,
        segment,
        direction,
        airport,
        iata,
        printedName,
        siteAirport: Boolean(airport && siteIds.has(airport.id)),
        date,
        time,
        terminal: arrival ? segment.arrival_terminal : segment.departure_terminal,
        other,
        uncertain,
      });
    };
    add('arrival');
    add('departure');
  });

  // airports not set up in Masar only when nothing else fits
  const known = options.filter((o) => o.airport);
  // the site's own airports first, then in travel order
  return (known.length ? known : options).sort(
    (a, b) => Number(b.siteAirport) - Number(a.siteAirport) || Number(Boolean(b.airport)) - Number(Boolean(a.airport)) || sortKey(a).localeCompare(sortKey(b)),
  );
}

const sortKey = (o: TicketOption) => `${o.date ?? '9999-99-99'} ${o.time ?? '99:99'}`;

/**
 * The flight card and ticket details after applying an option; flight fields
 * the ticket didn't have keep their current value.
 */
export function applyTicketOption(
  option: TicketOption,
  ticket: ParseTicketOutput,
  current: FlightValues,
  site: SiteWithAirports | undefined,
): { flight: FlightValues; details: TicketDetailsValues } {
  const siteAirport = option.airport ? site?.airports.find((sa) => sa.airport_id === option.airport!.id) : undefined;
  return {
    flight: {
      ...current,
      airport_id: option.airport?.id ?? current.airport_id,
      direction: option.direction,
      flight_no: option.segment.flight_no,
      airline: option.segment.airline ?? current.airline,
      terminal: option.terminal ?? '',
      date: option.date ?? current.date,
      time: option.time ?? current.time,
      buffer_min: siteAirport?.default_buffer_min ?? current.buffer_min,
    },
    details: {
      other_iata: option.other.iata ?? '',
      other_name: option.other.name ?? '',
      other_date: option.other.date ?? '',
      other_time: option.other.time ?? '',
      other_terminal: option.other.terminal ?? '',
      booking_ref: ticket.booking_ref ?? '',
      issuer: ticket.issuer ?? '',
      tickets: ticket.passengers.filter((p) => p.ticket_no),
    },
  };
}

/** FR-18 tasks.metadata.ticket — the far end of the flight and the booking, as read from the ticket. */
export interface TicketMeta {
  other?: { iata?: string | null; name?: string | null; date?: string | null; time?: string | null; terminal?: string | null };
  booking_ref?: string | null;
  issuer?: string | null;
  tickets?: { name: string; ticket_no: string | null }[];
}

export function readTicketMeta(metadata: unknown): TicketMeta | null {
  const ticket = (metadata as { ticket?: unknown } | null)?.ticket;
  return ticket && typeof ticket === 'object' ? (ticket as TicketMeta) : null;
}

// ---------------------------------------------------------------------------
// passengers — ticket names ("ALMUTAIRI/HAMAD MR") against the staff directory
// ---------------------------------------------------------------------------
const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'mstr', 'master', 'dr', 'eng', 'prof', 'sheikh', 'chd', 'inf', 'adt']);

/** Lower-case name tokens without titles; "al" is joined to the next token (Al-Mutairi = ALMUTAIRI). */
export function nameTokens(name: string): string[] {
  const raw = name
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٟ]/g, '')
    .toLowerCase()
    .split(/[\s/,]+/)
    .filter((w) => w && !w.endsWith('.'))
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
    .flatMap((w) => w.split('-'))
    .filter((w) => w && !TITLES.has(w));
  const tokens: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if ((raw[i] === 'al' || raw[i] === 'el') && raw[i + 1]) tokens.push(raw[i]! + raw[++i]!);
    else tokens.push(raw[i]!);
  }
  return tokens;
}

function overlap(a: string[], b: string[]): number {
  const set = new Set(b);
  return a.filter((token) => set.has(token)).length;
}

/**
 * The staff member a ticket name belongs to, or null. Every token of the
 * shorter name must appear in the longer one (at least two, so a shared first
 * name is not enough); a tie between two people is no match.
 */
export function matchPerson(ticketName: string, people: Person[]): Person | null {
  const ticket = nameTokens(ticketName);
  if (!ticket.length) return null;
  let best: { person: Person; score: number } | null = null;
  let tie = false;
  for (const person of people) {
    if (!person.is_active) continue;
    for (const candidate of [person.full_name, person.full_name_ar]) {
      if (!candidate) continue;
      const tokens = nameTokens(candidate);
      const score = overlap(ticket, tokens);
      const minimum = ticket.length === 1 && tokens.length === 1 ? 1 : 2;
      if (score < Math.min(ticket.length, tokens.length) || score < minimum) continue;
      if (!best || score > best.score) {
        best = { person, score };
        tie = false;
      } else if (score === best.score && best.person.id !== person.id) tie = true;
    }
  }
  return best && !tie ? best.person : null;
}

// ---------------------------------------------------------------------------
// the file
// ---------------------------------------------------------------------------
export function ticketMediaType(file: File): TicketMediaType {
  const type = (TICKET_MEDIA_TYPES as readonly string[]).includes(file.type)
    ? (file.type as TicketMediaType)
    : file.name.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : null;
  if (!type) throw new AppError('Unsupported file type', 'ticketImport.errors.fileType');
  if (file.size > TICKET_MAX_BYTES) throw new AppError('File too large', 'ticketImport.errors.fileSize');
  return type;
}

/** base64 without the data: prefix */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(new AppError('Could not read the file', 'ticketImport.errors.unreadable'));
    reader.readAsDataURL(file);
  });
}
