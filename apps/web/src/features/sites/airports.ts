import type { AirportSuggestion } from '@shared/schemas';
import type { SiteAirportValues } from './schema';

/** AI suggestion → AirportPicker row (FR-03). */
export function fromSuggestion(a: AirportSuggestion, isDefault = false, isActive = true): SiteAirportValues {
  return {
    iata: a.iata,
    icao: a.icao,
    name: a.name,
    name_ar: a.name_ar,
    city: a.city,
    city_ar: a.city_ar,
    country_code: a.country_code,
    lat: a.lat,
    lng: a.lng,
    is_international: a.is_international,
    source: a.source,
    distance_km: a.distance_km,
    drive_minutes: a.drive_minutes,
    default_buffer_min: 30,
    is_default: isDefault,
    is_active: isActive,
  };
}

/** Keep exactly one default, always an active airport (mirror of rpc_set_site_airports, 0008). */
export function withActiveDefault(list: SiteAirportValues[]): SiteAirportValues[] {
  const keep = list.find((a) => a.is_default && a.is_active) ?? list.find((a) => a.is_active);
  return list.map((a) => ({ ...a, is_default: a.iata === keep?.iata }));
}

/**
 * Merge an AI suggestion run into the site's list: airports already on the
 * list keep their switch; new ones arrive switched off, except on a site's
 * first run, where the nearest one starts active and default.
 */
export function mergeSuggestions(value: SiteAirportValues[], suggestions: AirportSuggestion[]): SiteAirportValues[] {
  const known = new Set(value.map((a) => a.iata));
  const fresh = suggestions.filter((s) => !known.has(s.iata));
  if (!fresh.length) return value;
  const first = !value.length;
  return withActiveDefault([...value, ...fresh.map((s, i) => fromSuggestion(s, first && i === 0, first && i === 0))]);
}
