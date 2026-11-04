import type { PassengerTrip } from './types';

/** Public tracking page for a share token (§6). */
export const trackUrl = (token: string) => `${window.location.origin}/track/${token}`;
export const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** What the check-in QR carries — the driver app reads the code back out of it (§8). */
export const checkinPayload = (taskId: string, code: string) => `masar:checkin:${taskId}:${code}`;
export const codeFromScan = (text: string) => /(\d{6})\s*$/.exec(text.trim())?.[1] ?? null;

/** SOS shows while the trip is live, or while the passenger is on board (§9). */
export const canRaiseSos = (trip: PassengerTrip) => trip.live || Boolean(trip.checkin.checked_in_at && !trip.checkin.dropped_off_at);

export type Position = { lat: number; lng: number; accuracy: number };

/** Best-effort device position (SOS, check-in, drop-off); null without a fix in `timeout` ms. */
export function currentPosition(timeout = 8_000): Promise<Position | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30_000 },
    );
  });
}
