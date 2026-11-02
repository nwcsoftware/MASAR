/**
 * Google Maps helpers. FR-31: drivers deep-link to Google Maps for
 * navigation (no in-app turn-by-turn). The Maps JS map itself
 * (@vis.gl/react-google-maps, browser key) lands with LiveMap in Phase 4.
 */
export function mapsLink(lat: number | null, lng: number | null, label?: string | null): string {
  if (lat == null || lng == null) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label ?? '')}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
