/** Haversine distance in km — same formula as fn_distance_km in 0001_init.sql. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Rough road estimate used before Distance Matrix runs: ×1.3 detour, 70 km/h. Matches seed.sql. */
export function estimateDrive(km: number): { roadKm: number; minutes: number } {
  const roadKm = Math.round(km * 1.3 * 10) / 10;
  return { roadKm, minutes: Math.max(15, Math.round((roadKm / 70) * 60)) };
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
