import type { Enums } from '@/lib/database.types';

/**
 * The passenger's view of their trips — the JSON rpc_passenger_home (0006)
 * returns. Scoped and masked server-side: no driver phone, co-passengers by
 * first name, only documents marked for passengers.
 */
export interface PassengerTrip {
  id: string;
  title: string;
  category: Enums<'task_category'>;
  status: Enums<'task_status'>;
  scheduled_start: string;
  scheduled_end: string | null;
  duration_min: number | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  site: { name: string; name_ar: string | null };
  stops: { seq: number; label: string | null; address: string | null; lat: number | null; lng: number | null; planned_arrival_at: string | null; dwell_min: number }[];
  flight: {
    flight_no: string | null;
    airline: string | null;
    direction: Enums<'flight_direction'>;
    terminal: string | null;
    scheduled_time: string;
    estimated_time: string | null;
    airport: string | null;
    airport_name: string | null;
    airport_name_ar: string | null;
  } | null;
  driver: {
    id: string;
    name: string;
    name_ar: string | null;
    photo_url: string | null;
    nationality: string | null;
    english_rating: number | null;
    licence: { name: string; name_ar: string | null } | null;
    rating: { ratings: number; stars: number | null; driving: number | null } | null;
  } | null;
  vehicle: { make: string | null; model: string | null; plate_no: string; color: string | null } | null;
  /** the dispatch line, only during the active trip window (A3) */
  contact_phone: string | null;
  co_passengers: { first_name: string; pickup_order: number; me: boolean }[];
  documents: {
    id: string;
    title: string | null;
    category: string;
    expires_on: string | null;
    file_name: string | null;
    file_type: string | null;
    storage_path: string | null;
  }[];
  my_rating: { id: string; stars: number; comment: string | null; editable_until: string; option_ids: string[] } | null;
  // phase 2 (0007)
  /** acknowledged → under way, within 2 h of the plan: live map, SOS, dispatch line */
  live: boolean;
  /** the six-digit code shows until the driver checks the passenger in */
  checkin: { code: string | null; checked_in_at: string | null; dropped_off_at: string | null };
  share_token: string | null;
  open_sos: { id: string; status: SosStatus; created_at: string } | null;
}

export type SosStatus = 'open' | 'acknowledged' | 'resolved';

/** rpc_passenger_live / fn_trip_live_payload */
export interface LiveTrip {
  task_id: string;
  status: Enums<'task_status'>;
  live: boolean;
  location: { lat: number; lng: number; heading: number | null; speed_kmh: number | null; recorded_at: string } | null;
  next_stop: { seq: number; label: string | null; lat: number | null; lng: number | null; planned_arrival_at: string | null } | null;
  distance_km: number | null;
  eta_at: string | null;
  checked_in_at: string | null;
}

/** rpc_shared_trip (anonymous viewers: no names, no phone numbers) */
export type SharedTrip =
  | { state: 'invalid' | 'ended' }
  | (LiveTrip & {
      state: 'active';
      scheduled_start: string;
      company: string | null;
      driver_first_name: string | null;
      vehicle: { make: string | null; model: string | null; color: string | null; plate_no: string } | null;
      destination: string | null;
    });

/** rpc_passenger_sos */
export interface SosResult {
  id: string;
  emergency_contacts: { name: string; phone: string }[];
  dispatch_phone: string | null;
}

export const REQUEST_KINDS = ['new', 'reschedule', 'cancel'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/** rpc_passenger_request */
export interface TripRequestInput {
  kind: RequestKind;
  task_id?: string | null;
  requested_start?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  passengers_count?: number;
  notes?: string | null;
}

/** Emergency services number shown next to SOS (Saudi Arabia: 911). */
export const EMERGENCY_NUMBER = '911';

/** The passenger can still ask to move or cancel this trip. */
export const canRequestChange = (t: Pick<PassengerTrip, 'status' | 'scheduled_start'>, now = Date.now()) =>
  ['scheduled', 'assigned', 'acknowledged', 'declined'].includes(t.status) && new Date(t.scheduled_start).getTime() > now;

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface PassengerHome {
  status: RegistrationStatus | null;
  note?: string | null;
  person_id?: string;
  trips: PassengerTrip[];
}

export const RATING_CATEGORIES = ['driving', 'trip', 'road', 'cleanliness', 'vehicle'] as const;
export type RatingCategory = (typeof RATING_CATEGORIES)[number];
/** driving, trip and road take one answer; cleanliness and vehicle any number */
export const SINGLE_CHOICE: RatingCategory[] = ['driving', 'trip', 'road'];

export const TRIP_DOCUMENT_CATEGORIES = ['hotel_booking', 'gate_pass', 'flight_ticket', 'visa', 'other'] as const;
export type TripDocumentCategory = (typeof TRIP_DOCUMENT_CATEGORIES)[number];

export const RIDE_PREFERENCES = ['ac', 'quiet', 'no_music', 'front_seat', 'help_luggage'] as const;

/** Past trips stay "rateable" for this long after they end (the prompt). */
export const RATING_PROMPT_DAYS = 7;

export const isActiveTrip = (t: Pick<PassengerTrip, 'status'>) => ['en_route', 'in_progress', 'delayed'].includes(t.status);
export const isUpcoming = (t: Pick<PassengerTrip, 'status'>) => ['scheduled', 'assigned', 'acknowledged', 'en_route', 'in_progress', 'delayed'].includes(t.status);

/** A finished trip the passenger hasn't rated yet (and still may). */
export function needsRating(t: PassengerTrip, now = Date.now()): boolean {
  if (t.status !== 'completed' || t.my_rating) return false;
  const ended = new Date(t.actual_end_at ?? t.scheduled_end ?? t.scheduled_start).getTime();
  return now - ended < RATING_PROMPT_DAYS * 86_400_000;
}

/** "Sara" from "Eng. Sara Al-Otaibi" (co-passengers see first names only). */
export const firstName = (name: string) => name.replace(/^(Eng\.|Mr\.|Mrs\.|Ms\.|Dr\.)\s*/i, '').trim().split(/\s+/)[0] ?? name;
