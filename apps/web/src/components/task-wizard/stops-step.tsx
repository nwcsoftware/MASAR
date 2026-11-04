import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { ArrowDown, ArrowUp, Building2, ClipboardPaste, MapPin, Plane, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ROUTE_MAX_STOPS } from '@shared/schemas';
import { Field, NativeSelect } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SiteWithAirports } from '@/features/sites/queries';
import type { StopValues, TaskFormValues } from '@/features/tasks/schema';
import { formatNumber } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { parseCoordinates } from '@/lib/maps';
import type { Airport } from '@/mocks/fixtures';
import { cn } from '@/lib/utils';
import type { WizardPlan } from './use-plan';
import { airportStop, placeStop, siteStop } from './values';

const KIND_ICON = { site: Building2, airport: Plane, place: MapPin } as const;

/** Paste a Google Maps link / "lat, lng" to place a custom stop (Places search arrives with Phase 4). */
function CoordsInput({ index }: { index: number }) {
  const { t } = useTranslation();
  const { setValue, watch, formState } = useFormContext<TaskFormValues>();
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [lat, lng] = watch([`stops.${index}.lat`, `stops.${index}.lng`]);
  const error = invalid ? 'mapPicker.pasteError' : formState.errors.stops?.[index]?.lat?.message;
  return (
    <Field id={`stop-${index}-coords`} label={t('wizard.stops.coords')} error={error} hint={lat != null && lng != null ? <span dir="ltr" className="tabular">{lat.toFixed(5)}, {lng.toFixed(5)}</span> : t('mapPicker.pasteHint')}>
      <div className="flex gap-2">
        <Input
          id={`stop-${index}-coords`}
          dir="ltr"
          value={text}
          placeholder="https://maps.google.com/…  ·  24.7136, 46.6753"
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const coords = parseCoordinates(text);
            if (!coords) return setInvalid(true);
            setValue(`stops.${index}.lat`, coords.lat, { shouldDirty: true, shouldValidate: true });
            setValue(`stops.${index}.lng`, coords.lng, { shouldDirty: true });
            setText('');
          }}
        >
          <ClipboardPaste aria-hidden="true" />
          {t('mapPicker.use')}
        </Button>
      </div>
    </Field>
  );
}

/** Step 3 — ordered stops (FR-10) with legs from route-estimate (FR-11). */
export function StopsStep({ sites, airports, plan }: { sites: SiteWithAirports[]; airports: Airport[]; plan: WizardPlan }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const form = useFormContext<TaskFormValues>();
  const { register, formState } = form;
  const errors = formState.errors;
  const stops = useFieldArray({ control: form.control, name: 'stops' });
  const values = form.watch('stops');
  const [adding, setAdding] = useState('');

  const add = (choice: string) => {
    const [kind, id] = choice.split(':');
    let stop: StopValues | null = null;
    if (kind === 'site') {
      const site = sites.find((s) => s.id === id);
      if (site) stop = siteStop(site, 10);
    } else if (kind === 'airport') {
      const airport = airports.find((a) => a.id === id);
      if (airport) stop = airportStop(airport, 15);
    } else if (kind === 'place') {
      stop = placeStop(15);
    }
    if (stop) stops.append(stop);
    setAdding('');
  };

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {stops.fields.map((field, i) => {
          const stop = values[i];
          const Icon = KIND_ICON[stop?.kind ?? 'place'];
          const leg = i > 0 ? plan.legs[i - 1] : null;
          return (
            <li key={field.id} className="space-y-2">
              {leg && (
                <p className="tabular ps-4 text-xs text-fg-3" aria-label={t('wizard.stops.legLabel')}>
                  ↓ {t('units.km', { value: formatNumber(leg.distance_km) })} · {t('units.minutes', { value: leg.duration_min })}
                </p>
              )}
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-2 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                      i === 0 ? 'bg-brand-500 text-fg-on-brand' : 'bg-surface-2 text-fg-2',
                    )}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                      <Field
                        id={`stop-${i}-label`}
                        label={
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="size-3.5 text-fg-3" aria-hidden="true" />
                            {i === 0 ? t('wizard.stops.origin') : t('wizard.stops.stop', { n: i + 1 })}
                          </span>
                        }
                        error={errors.stops?.[i]?.label?.message}
                      >
                        <Input id={`stop-${i}-label`} placeholder={t('wizard.stops.labelPlaceholder')} {...register(`stops.${i}.label`)} />
                      </Field>
                      <Field id={`stop-${i}-dwell`} label={t('wizard.stops.dwell')} error={errors.stops?.[i]?.dwell_min?.message}>
                        <Input id={`stop-${i}-dwell`} type="number" min={0} max={600} {...register(`stops.${i}.dwell_min`, { valueAsNumber: true })} />
                      </Field>
                    </div>
                    {stop?.kind === 'place' ? (
                      <>
                        <Field id={`stop-${i}-address`} label={t('wizard.stops.address')}>
                          <Input id={`stop-${i}-address`} {...register(`stops.${i}.address`)} />
                        </Field>
                        <CoordsInput index={i} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field id={`stop-${i}-contact`} label={t('wizard.stops.contact')}>
                            <Input id={`stop-${i}-contact`} {...register(`stops.${i}.contact_name`)} />
                          </Field>
                          <Field id={`stop-${i}-phone`} label={t('wizard.stops.phone')}>
                            <Input id={`stop-${i}-phone`} type="tel" dir="ltr" {...register(`stops.${i}.contact_phone`)} />
                          </Field>
                        </div>
                      </>
                    ) : (
                      stop?.address && <p className="text-xs text-fg-2">{stop.address}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button type="button" variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => stops.move(i, i - 1)} aria-label={t('wizard.stops.moveUp')}>
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={i === stops.fields.length - 1}
                      onClick={() => stops.move(i, i + 1)}
                      aria-label={t('wizard.stops.moveDown')}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-danger"
                      disabled={stops.fields.length <= 2}
                      onClick={() => stops.remove(i)}
                      aria-label={t('common.remove')}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {errors.stops?.root?.message || errors.stops?.message ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          {t(errors.stops?.root?.message ?? errors.stops?.message ?? '')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <Field id="stop-add" label={t('wizard.stops.add')} className="min-w-56 flex-1">
          <NativeSelect id="stop-add" value={adding} disabled={stops.fields.length >= ROUTE_MAX_STOPS} onChange={(e) => add(e.target.value)}>
            <option value="">{t('wizard.stops.addPlaceholder')}</option>
            <option value="place:">{t('wizard.stops.customPlace')}</option>
            <optgroup label={t('wizard.stops.sites')}>
              {sites.map((s) => (
                <option key={s.id} value={`site:${s.id}`}>
                  {name(s)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('wizard.stops.airports')}>
              {airports.map((a) => (
                <option key={a.id} value={`airport:${a.id}`}>
                  {a.iata} · {name(a)}
                </option>
              ))}
            </optgroup>
          </NativeSelect>
        </Field>
        <div className="rounded-md bg-surface-2 px-3 py-2 text-sm" aria-live="polite">
          <span className="tabular font-bold text-fg">
            {t('units.km', { value: formatNumber(plan.timeline.distanceKm) })} · {t('units.minutes', { value: plan.legs.reduce((s, l) => s + (l?.duration_min ?? 0), 0) })}
          </span>
          <span className="ms-2 text-xs text-fg-3">{plan.routing ? t('common.loading') : plan.estimated ? t('wizard.stops.estimated') : t('wizard.stops.liveTraffic')}</span>
        </div>
      </div>
    </div>
  );
}
