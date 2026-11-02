import { useEffect, useMemo, useRef, useState } from 'react';
import { Plane, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AirportSuggestion } from '@shared/schemas';
import { Field, FormError } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { SiteAirportValues } from '@/features/sites/schema';
import { useSuggestAirports } from '@/features/sites/queries';
import { formatNumber } from '@/lib/format';
import { distanceKm, estimateDrive } from '@/lib/geo';
import { useLocalizedName } from '@/lib/i18n-data';
import { cn } from '@/lib/utils';

export function fromSuggestion(a: AirportSuggestion, isDefault = false): SiteAirportValues {
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
  };
}

/**
 * docs/DESIGN.md §5 AirportPicker (FR-03): AI suggestions with distance and
 * drive time, tick the airports the site uses, star one default, set the
 * buffer. Controlled — the parent saves via rpc_set_site_airports.
 */
export function AirportPicker({
  lat,
  lng,
  countryCode,
  value,
  onChange,
  autoSuggest,
}: {
  lat: number;
  lng: number;
  countryCode?: string;
  value: SiteAirportValues[];
  onChange: (next: SiteAirportValues[]) => void;
  autoSuggest?: boolean;
}) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const suggest = useSuggestAirports();
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ iata: '', name: '', lat: '', lng: '' });
  const [manualError, setManualError] = useState<string | null>(null);
  const requested = useRef(false);

  const runSuggest = () => {
    suggest.mutate(
      { lat, lng, country_code: countryCode },
      {
        // first run on an empty site: preselect the nearest airport as default
        onSuccess: (airports) => {
          if (!value.length && airports[0]) onChange([fromSuggestion(airports[0], true)]);
        },
      },
    );
  };

  useEffect(() => {
    if (autoSuggest && !requested.current) {
      requested.current = true;
      runSuggest();
    }
    // run once on mount when asked to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSuggest]);

  const rows = useMemo(() => {
    const byIata = new Map<string, SiteAirportValues>();
    for (const a of value) byIata.set(a.iata, a);
    for (const s of suggest.data ?? []) if (!byIata.has(s.iata)) byIata.set(s.iata, fromSuggestion(s));
    return [...byIata.values()].sort((a, b) => (a.drive_minutes ?? 9999) - (b.drive_minutes ?? 9999));
  }, [value, suggest.data]);

  const selected = new Set(value.map((a) => a.iata));
  const defaultIata = value.find((a) => a.is_default)?.iata ?? value[0]?.iata;

  const toggle = (row: SiteAirportValues, checked: boolean) => {
    const next = checked ? [...value, { ...row, is_default: false }] : value.filter((a) => a.iata !== row.iata);
    onChange(next.map((a) => ({ ...a, is_default: a.iata === (next.some((x) => x.iata === defaultIata) ? defaultIata : next[0]?.iata) })));
  };
  const update = (iata: string, patch: Partial<SiteAirportValues>) => onChange(value.map((a) => (a.iata === iata ? { ...a, ...patch } : a)));

  const addManual = () => {
    const iata = manual.iata.trim().toUpperCase();
    const mLat = Number(manual.lat);
    const mLng = Number(manual.lng);
    if (!/^[A-Z]{3}$/.test(iata)) return setManualError('sites.errors.iata');
    if (!manual.name.trim()) return setManualError('sites.errors.airportName');
    if (!Number.isFinite(mLat) || !Number.isFinite(mLng) || Math.abs(mLat) > 90 || Math.abs(mLng) > 180) return setManualError('onboarding.errors.lat');
    const drive = estimateDrive(distanceKm(lat, lng, mLat, mLng));
    const row: SiteAirportValues = {
      iata,
      icao: null,
      name: manual.name.trim(),
      name_ar: null,
      city: null,
      city_ar: null,
      country_code: countryCode ?? null,
      lat: mLat,
      lng: mLng,
      is_international: true,
      source: 'manual',
      distance_km: drive.roadKm,
      drive_minutes: drive.minutes,
      default_buffer_min: 30,
      is_default: !value.length,
    };
    onChange([...value.filter((a) => a.iata !== iata), row]);
    setManual({ iata: '', name: '', lat: '', lng: '' });
    setManualError(null);
    setManualOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm text-fg-2">
          <Sparkles className="size-4 text-brand-500" aria-hidden="true" />
          {t('onboarding.airports.suggested')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={runSuggest} disabled={suggest.isPending}>
          <Sparkles aria-hidden="true" />
          {suggest.isPending ? t('airports.suggesting') : suggest.data ? t('airports.suggestAgain') : t('sites.suggestAirports')}
        </Button>
      </div>

      <FormError error={suggest.error} />

      {suggest.isPending && !rows.length ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => {
            const checked = selected.has(row.iata);
            const current = value.find((a) => a.iata === row.iata);
            return (
              <li key={row.iata} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Checkbox id={`ap-${row.iata}`} checked={checked} onCheckedChange={(v) => toggle(row, v === true)} />
                <label htmlFor={`ap-${row.iata}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-sm font-bold">
                    {row.iata} · {name(row)}
                  </span>
                  <span className="tabular block text-xs text-fg-2">
                    {row.city ? `${name({ name: row.city, name_ar: row.city_ar })} · ` : ''}
                    {row.distance_km != null && t('units.km', { value: formatNumber(row.distance_km, 0) })}
                    {row.drive_minutes != null && ` · ${t('units.minutes', { value: row.drive_minutes })}`}
                    {row.source === 'manual' && ` · ${t('airports.manual')}`}
                  </span>
                </label>
                {checked && (
                  <label className="flex items-center gap-1.5 text-xs text-fg-2">
                    {t('sites.buffer')}
                    <Input
                      type="number"
                      min={0}
                      max={240}
                      className="tabular h-8 w-16"
                      value={current?.default_buffer_min ?? 30}
                      onChange={(e) => update(row.iata, { default_buffer_min: Number(e.target.value) || 0 })}
                      aria-label={`${t('sites.buffer')} ${row.iata}`}
                    />
                  </label>
                )}
                <button
                  type="button"
                  disabled={!checked}
                  onClick={() => onChange(value.map((a) => ({ ...a, is_default: a.iata === row.iata })))}
                  aria-pressed={defaultIata === row.iata}
                  className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold disabled:opacity-40', defaultIata === row.iata ? 'text-fg' : 'text-fg-3 hover:text-fg')}
                >
                  {/* the star is decorative (3:1 is enough), so it keeps the pure amber token */}
                  <Star className={cn('size-3.5', defaultIata === row.iata && 'fill-warning text-warning')} aria-hidden="true" />
                  {t('sites.defaultAirport')}
                </button>
                {row.source === 'manual' && checked && (
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => toggle(row, false)} aria-label={t('common.remove')}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-6 text-sm text-fg-2">
          <Plane className="size-4" aria-hidden="true" />
          {t('sites.noAirportsBody')}
        </p>
      )}

      {manualOpen ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
            <Field id="manual-iata" label="IATA">
              <Input id="manual-iata" dir="ltr" maxLength={3} value={manual.iata} onChange={(e) => setManual({ ...manual, iata: e.target.value.toUpperCase() })} />
            </Field>
            <Field id="manual-name" label={t('airports.name')}>
              <Input id="manual-name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            </Field>
            <Field id="manual-lat" label={t('onboarding.site.lat')}>
              <Input id="manual-lat" dir="ltr" type="number" step="any" value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} />
            </Field>
            <Field id="manual-lng" label={t('onboarding.site.lng')}>
              <Input id="manual-lng" dir="ltr" type="number" step="any" value={manual.lng} onChange={(e) => setManual({ ...manual, lng: e.target.value })} />
            </Field>
          </div>
          {manualError && <FormError error={new Error(manualError)} />}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={addManual}>
              {t('common.add')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setManualOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setManualOpen(true)}>
          <Plus aria-hidden="true" />
          {t('airports.addManually')}
        </Button>
      )}
    </div>
  );
}
