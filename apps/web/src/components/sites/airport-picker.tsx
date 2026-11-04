import { useEffect, useMemo, useRef, useState } from 'react';
import { Plane, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, FormError } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { mergeSuggestions, withActiveDefault } from '@/features/sites/airports';
import type { SiteAirportValues } from '@/features/sites/schema';
import { useSuggestAirports } from '@/features/sites/queries';
import { formatNumber } from '@/lib/format';
import { distanceKm, estimateDrive } from '@/lib/geo';
import { useLocalizedName } from '@/lib/i18n-data';
import { cn } from '@/lib/utils';

/**
 * docs/DESIGN.md §5 AirportPicker (FR-03): the AI finds the airports around
 * the site (distance + drive time) and every one stays on the list with an
 * Active switch. Only active airports are offered when planning trips; star
 * one default and set its buffer. Controlled — the parent saves via
 * rpc_set_site_airports.
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
  // suggestions resolve later: merge into the list as it is then, not as it was when asked
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const runSuggest = () => {
    suggest.mutate({ lat, lng, country_code: countryCode }, { onSuccess: (airports) => onChange(mergeSuggestions(latest.current, airports)) });
  };

  useEffect(() => {
    if (autoSuggest && !requested.current) {
      requested.current = true;
      runSuggest();
    }
    // run once on mount when asked to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSuggest]);

  const rows = useMemo(() => [...value].sort((a, b) => (a.drive_minutes ?? 9999) - (b.drive_minutes ?? 9999)), [value]);
  const activeCount = value.filter((a) => a.is_active).length;
  const defaultIata = value.find((a) => a.is_default && a.is_active)?.iata;

  const update = (iata: string, patch: Partial<SiteAirportValues>) => onChange(value.map((a) => (a.iata === iata ? { ...a, ...patch } : a)));
  const setActive = (iata: string, active: boolean) =>
    onChange(withActiveDefault(value.map((a) => (a.iata === iata ? { ...a, is_active: active, is_default: active && a.is_default } : a))));
  const remove = (iata: string) => onChange(withActiveDefault(value.filter((a) => a.iata !== iata)));

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
      is_default: false,
      is_active: true,
    };
    onChange(withActiveDefault([...value.filter((a) => a.iata !== iata), row]));
    setManual({ iata: '', name: '', lat: '', lng: '' });
    setManualError(null);
    setManualOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="inline-flex items-center gap-2 text-sm text-fg-2">
            <Sparkles className="size-4 text-brand-500" aria-hidden="true" />
            {t('onboarding.airports.suggested')}
          </p>
          {value.length > 0 && <p className="tabular text-xs font-semibold text-fg-2">{t('airports.activeCount', { active: activeCount, total: value.length })}</p>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={runSuggest} disabled={suggest.isPending}>
          <Sparkles aria-hidden="true" />
          {suggest.isPending ? t('airports.suggesting') : suggest.data || value.length ? t('airports.suggestAgain') : t('sites.suggestAirports')}
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
        <div className="space-y-2">
          <p className="text-xs text-fg-3">{t('airports.toggleHint')}</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => {
              const active = row.is_active;
              const isDefault = defaultIata === row.iata;
              return (
                <li key={row.iata} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !active && 'bg-surface-2')}>
                  <Switch
                    id={`ap-${row.iata}`}
                    checked={active}
                    onCheckedChange={(v) => setActive(row.iata, v)}
                    aria-label={t('airports.activeLabel', { iata: row.iata })}
                  />
                  <label htmlFor={`ap-${row.iata}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className={cn('flex flex-wrap items-center gap-2 text-sm font-bold', !active && 'text-fg-2')}>
                      {row.iata} · {name(row)}
                      <Badge variant={active ? 'success' : 'default'}>{active ? t('airports.active') : t('airports.inactive')}</Badge>
                    </span>
                    <span className="tabular block text-xs text-fg-2">
                      {row.city ? `${name({ name: row.city, name_ar: row.city_ar })} · ` : ''}
                      {row.distance_km != null && t('units.km', { value: formatNumber(row.distance_km, 0) })}
                      {row.drive_minutes != null && ` · ${t('units.minutes', { value: row.drive_minutes })}`}
                      {row.source === 'manual' && ` · ${t('airports.manual')}`}
                    </span>
                  </label>
                  {active && (
                    <label className="flex items-center gap-1.5 text-xs text-fg-2">
                      {t('sites.buffer')}
                      <Input
                        type="number"
                        min={0}
                        max={240}
                        className="tabular h-8 w-16"
                        value={row.default_buffer_min}
                        onChange={(e) => update(row.iata, { default_buffer_min: Number(e.target.value) || 0 })}
                        aria-label={`${t('sites.buffer')} ${row.iata}`}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={!active}
                    onClick={() => onChange(value.map((a) => ({ ...a, is_default: a.iata === row.iata })))}
                    aria-pressed={isDefault}
                    className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold disabled:opacity-40', isDefault ? 'text-fg' : 'text-fg-3 hover:text-fg')}
                  >
                    {/* the star is decorative (3:1 is enough), so it keeps the pure amber token */}
                    <Star className={cn('size-3.5', isDefault && 'fill-warning text-warning')} aria-hidden="true" />
                    {t('sites.defaultAirport')}
                  </button>
                  {row.source === 'manual' && (
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => remove(row.iata)} aria-label={t('common.remove')}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
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
