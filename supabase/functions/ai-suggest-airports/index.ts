/**
 * ai-suggest-airports (FR-03, PRD §7.1, docs/DATABASE.md §8)
 *
 * POST {lat, lng, country_code?, lang?} → {airports: AirportSuggestion[≤8]}
 *
 *  1. Google Places Text Search (airport, ~300 km box) → candidates
 *  2. Claude normalises candidates → IATA/ICAO, EN/AR names, city, intl flag
 *     (no Places key or no results → Claude lists airports from knowledge)
 *  3. Distance Matrix → road km + drive minutes (fallback: haversine × 1.3 @ 70 km/h)
 *
 * Staff only — AI and Maps calls run on explicit user action (NFR-07).
 * Secrets: ANTHROPIC_API_KEY (required), GOOGLE_MAPS_SERVER_KEY (optional).
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getCaller, requireRole } from '../_shared/auth.ts';
import { handle, HttpError, json, requireEnv } from '../_shared/http.ts';
import { suggestAirportsInput, suggestAirportsOutput, type AirportSuggestion } from '../_shared/schemas.ts';

const MODEL = 'claude-opus-5-5';
const SEARCH_RADIUS_KM = 300;
const MAX_RESULTS = 8;

// ---------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
// 1. Google Places (New) — Text Search restricted to a box around the site
// ---------------------------------------------------------------------------
interface Candidate {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  place_id: string;
}

async function placesCandidates(lat: number, lng: number, key: string): Promise<Candidate[]> {
  const dLat = SEARCH_RADIUS_KM / 111;
  const dLng = SEARCH_RADIUS_KM / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: 'airport',
      includedType: 'airport',
      strictTypeFiltering: true,
      pageSize: 20,
      locationRestriction: {
        rectangle: {
          low: { latitude: Math.max(lat - dLat, -90), longitude: Math.max(lng - dLng, -180) },
          high: { latitude: Math.min(lat + dLat, 90), longitude: Math.min(lng + dLng, 180) },
        },
      },
    }),
  });
  if (!response.ok) {
    console.warn('Places search failed', response.status, await response.text());
    return [];
  }
  const body = (await response.json()) as {
    places?: { id: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }[];
  };
  return (body.places ?? [])
    .filter((p) => p.location && p.displayName?.text)
    .map((p) => ({
      name: p.displayName!.text!,
      address: p.formattedAddress ?? null,
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      place_id: p.id,
    }))
    .sort((a, b) => distanceKm(lat, lng, a.lat, a.lng) - distanceKm(lat, lng, b.lat, b.lng))
    .slice(0, 15);
}

// ---------------------------------------------------------------------------
// 2. Claude — structured normalisation (or knowledge-only fallback)
// ---------------------------------------------------------------------------
const nullableString = { type: ['string', 'null'] } as const;
const AIRPORTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['airports'],
  properties: {
    airports: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['iata', 'icao', 'name', 'name_ar', 'city', 'city_ar', 'country_code', 'lat', 'lng', 'is_international'],
        properties: {
          iata: { type: 'string', description: 'IATA airport code, 3 uppercase letters' },
          icao: { ...nullableString, description: 'ICAO code, 4 uppercase letters, or null if unknown' },
          name: { type: 'string', description: 'Official English airport name' },
          name_ar: { ...nullableString, description: 'Official Arabic airport name' },
          city: { ...nullableString, description: 'City served, in English' },
          city_ar: { ...nullableString, description: 'City served, in Arabic' },
          country_code: { ...nullableString, description: 'ISO 3166-1 alpha-2 country code' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          is_international: { type: 'boolean', description: 'Has scheduled international passenger flights' },
        },
      },
    },
  },
} as const;

const llmAirports = z.object({
  airports: z.array(
    z.object({
      iata: z.string(),
      icao: z.string().nullable(),
      name: z.string(),
      name_ar: z.string().nullable(),
      city: z.string().nullable(),
      city_ar: z.string().nullable(),
      country_code: z.string().nullable(),
      lat: z.number(),
      lng: z.number(),
      is_international: z.boolean(),
    }),
  ),
});
type LlmAirport = z.infer<typeof llmAirports>['airports'][number];

const SYSTEM = `You maintain the airport catalogue of a driver-dispatch app used in Saudi Arabia and the Gulf.
Drivers are sent to these airports to pick up and drop off staff, so only airports with scheduled commercial passenger service matter.
Return one entry per airport. Leave out military bases, private or general-aviation fields, heliports, cargo-only airports, and individual terminals or car parks listed as separate places.
Use official names in English and in Arabic as the airport itself publishes them. If you are not confident about a code or an Arabic name, use null rather than guessing (the IATA code is required, so omit an airport whose IATA code you don't know).`;

async function askClaude(prompt: string, effort: 'low' | 'medium'): Promise<LlmAirport[]> {
  const anthropic = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // A declined request is re-run server-side on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema: AIRPORTS_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'refusal') throw new HttpError(502, 'airports.errors.aiDeclined', 'Claude declined the request');
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'airports.errors.aiFailed', 'Claude output was truncated');
  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') throw new HttpError(502, 'airports.errors.aiFailed', 'No text in Claude response');

  const parsed = llmAirports.safeParse(JSON.parse(text.text));
  if (!parsed.success) throw new HttpError(502, 'airports.errors.aiFailed', parsed.error.message);
  return parsed.data.airports;
}

function normalisePrompt(lat: number, lng: number, candidates: Candidate[]): string {
  return `Site location: ${lat.toFixed(5)}, ${lng.toFixed(5)}.

Google Places returned these candidates near the site (JSON):
${JSON.stringify(candidates.map(({ name, address, lat: cLat, lng: cLng }) => ({ name, address, lat: cLat, lng: cLng })), null, 2)}

Turn the commercial passenger airports among them into catalogue entries. Use each candidate's coordinates for lat/lng.`;
}

function knowledgePrompt(lat: number, lng: number, countryCode?: string): string {
  return `Site location: ${lat.toFixed(5)}, ${lng.toFixed(5)}${countryCode ? ` (country ${countryCode})` : ''}.

List the airports with scheduled commercial passenger service within roughly ${SEARCH_RADIUS_KM} km of this site, nearest first, at most ${MAX_RESULTS}. Give each airport's coordinates as precisely as you know them.`;
}

// ---------------------------------------------------------------------------
// 3. Drive distance/time — Distance Matrix, else an estimate
// ---------------------------------------------------------------------------
async function driveTimes(
  origin: { lat: number; lng: number },
  airports: LlmAirport[],
  key: string | undefined,
): Promise<{ km: number; minutes: number; estimated: boolean }[]> {
  const estimate = (a: LlmAirport) => {
    const km = Math.round(distanceKm(origin.lat, origin.lng, a.lat, a.lng) * 1.3 * 10) / 10;
    return { km, minutes: Math.max(15, Math.round((km / 70) * 60)), estimated: true };
  };
  if (!key || !airports.length) return airports.map(estimate);

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destinations', airports.map((a) => `${a.lat},${a.lng}`).join('|'));
  url.searchParams.set('departure_time', 'now');
  url.searchParams.set('key', key);
  const response = await fetch(url);
  if (!response.ok) return airports.map(estimate);
  const body = (await response.json()) as {
    rows?: { elements: { status: string; distance?: { value: number }; duration?: { value: number }; duration_in_traffic?: { value: number } }[] }[];
  };
  const elements = body.rows?.[0]?.elements ?? [];
  return airports.map((a, i) => {
    const e = elements[i];
    if (!e || e.status !== 'OK' || !e.distance || !e.duration) return estimate(a);
    return {
      km: Math.round((e.distance.value / 1000) * 10) / 10,
      minutes: Math.round((e.duration_in_traffic ?? e.duration).value / 60),
      estimated: false,
    };
  });
}

// ---------------------------------------------------------------------------
Deno.serve(
  handle(async (req) => {
    const caller = await getCaller(req);
    requireRole(caller, ['owner', 'admin', 'dispatcher']);

    const input = suggestAirportsInput.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new HttpError(400, 'errors.invalidInput', input.error.message);
    const { lat, lng, country_code } = input.data;
    const mapsKey = Deno.env.get('GOOGLE_MAPS_SERVER_KEY') || undefined;

    const candidates = mapsKey ? await placesCandidates(lat, lng, mapsKey) : [];
    const source: AirportSuggestion['source'] = candidates.length ? 'google' : 'ai';
    const found = candidates.length
      ? await askClaude(normalisePrompt(lat, lng, candidates), 'low')
      : await askClaude(knowledgePrompt(lat, lng, country_code), 'medium');

    // de-duplicate by IATA, drop malformed codes and anything implausibly far
    const unique = [...new Map(found.map((a) => [a.iata.toUpperCase(), { ...a, iata: a.iata.toUpperCase() }])).values()]
      .filter((a) => /^[A-Z]{3}$/.test(a.iata))
      .filter((a) => distanceKm(lat, lng, a.lat, a.lng) <= SEARCH_RADIUS_KM * 1.4);

    const times = await driveTimes({ lat, lng }, unique, mapsKey);
    const airports: AirportSuggestion[] = unique
      .map((a, i) => ({
        iata: a.iata,
        icao: a.icao && /^[A-Z]{4}$/.test(a.icao.toUpperCase()) ? a.icao.toUpperCase() : null,
        name: a.name,
        name_ar: a.name_ar,
        city: a.city,
        city_ar: a.city_ar,
        country_code: a.country_code && a.country_code.length === 2 ? a.country_code.toUpperCase() : null,
        lat: a.lat,
        lng: a.lng,
        distance_km: times[i]!.km,
        drive_minutes: times[i]!.minutes,
        is_international: a.is_international,
        source,
        drive_estimated: times[i]!.estimated,
      }))
      .sort((a, b) => a.drive_minutes - b.drive_minutes)
      .slice(0, MAX_RESULTS);

    return json(suggestAirportsOutput.parse({ airports }));
  }),
);
