import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { db, useLiveData } from '@/lib/data-source';
import { mockDb } from '@/mocks/db';

/** How often the driver app reports while a trip is under way. */
export const REPORT_EVERY_MS = 30_000;

export type SharingState = 'off' | 'waiting' | 'sharing' | 'denied' | 'unsupported';

/** Provided by the driver shell (components/driver/location-sharing.tsx). */
export const SharingContext = createContext<{ state: SharingState; lastAt: string | null; taskId: string | null }>({ state: 'off', lastAt: null, taskId: null });
export const useLocationSharing = () => useContext(SharingContext);

/** Demo mirror of rpc_report_location (0001): a new position row + "seen". */
export function mockReportLocation(driverId: string, p: { lat: number; lng: number; accuracy?: number | null; speed_kmh?: number | null; heading?: number | null; taskId?: string | null }) {
  const now = new Date().toISOString();
  const driver = mockDb.drivers.find((d) => d.id === driverId);
  if (!driver) return;
  mockDb.driverLocations.push({
    id: (mockDb.driverLocations.at(-1)?.id ?? 0) + 1,
    driver_id: driverId,
    company_id: driver.company_id,
    task_id: p.taskId ?? null,
    lat: p.lat,
    lng: p.lng,
    accuracy_m: p.accuracy ?? null,
    speed_kmh: p.speed_kmh ?? null,
    heading: p.heading ?? null,
    battery_pct: null,
    recorded_at: now,
  });
  driver.last_seen_at = now;
  if (driver.current_status === 'offline') driver.current_status = 'idle';
}

/**
 * FR-33: while `taskId` is under way, watch the device position and report it
 * (rpc_report_location) at most every 30 s — this is what the passenger's live
 * map and the share link show. Never writes driver_locations directly.
 */
export function useLocationReporting(taskId: string | null): { state: SharingState; lastAt: string | null } {
  const live = useLiveData();
  const { driverId, profile } = useCurrentUser();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SharingState>('waiting');
  const [lastAt, setLastAt] = useState<string | null>(null);
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  useEffect(() => {
    if (!taskId || !driverId || !supported) return;
    let last = 0;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - last < REPORT_EVERY_MS) return;
        last = Date.now();
        const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
        const speed_kmh = speed == null ? null : Math.round(speed * 3.6);
        const report = live
          ? db()
              .rpc('rpc_report_location', {
                p_lat: lat,
                p_lng: lng,
                p_accuracy: accuracy,
                p_speed_kmh: speed_kmh ?? undefined,
                p_heading: heading ?? undefined,
                p_task_id: taskId,
              })
              .then(({ error }) => !error)
          : Promise.resolve((mockReportLocation(driverId, { lat, lng, accuracy, speed_kmh, heading, taskId }), true));
        void report.then((ok) => {
          if (!ok) return;
          setState('sharing');
          setLastAt(new Date().toISOString());
          void queryClient.invalidateQueries({ queryKey: ['drivers', profile.company_id ?? ''] });
        });
      },
      (error) => setState(error.code === error.PERMISSION_DENIED ? 'denied' : 'waiting'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 60_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [taskId, driverId, live, supported, queryClient, profile.company_id]);

  if (!taskId) return { state: 'off', lastAt: null };
  if (!supported) return { state: 'unsupported', lastAt: null };
  return { state, lastAt };
}
