/**
 * Google Maps helpers. FR-31: drivers deep-link to Google Maps for
 * navigation (no in-app turn-by-turn). The Maps JS map itself
 * (@vis.gl/react-google-maps, browser key) lands with LiveMap in Phase 4.
 */
/**
 * Read coordinates out of what people paste from Google Maps: share/place
 * URLs (`@24.69,46.68,15z`, `!3d24.69!4d46.68`, `?q=24.69,46.68`,
 * `ll=`/`query=`) or a bare "24.69, 46.68". Returns null if none found.
 */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const text = decodeURIComponent(input.trim());
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // place data: most precise, prefer it
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll|query|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

export function mapsLink(lat: number | null, lng: number | null, label?: string | null): string {
  if (lat == null || lng == null) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label ?? '')}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
