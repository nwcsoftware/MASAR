import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { FileCheck2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Field, NativeSelect } from '@/components/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SiteWithAirports } from '@/features/sites/queries';
import type { TaskFormValues } from '@/features/tasks/schema';
import { useLocalizedName } from '@/lib/i18n-data';
import type { Airport } from '@/mocks/fixtures';
import { isolate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PassengerPicker } from './passenger-picker';
import { TicketImport, type TicketImportResult } from './ticket-import';
import type { FlightField } from '@/features/tasks/ticket';

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

/** Step 2 — what, for which site; the flight card for airport trips (FR-13). */
export function DetailsStep({ sites, airports }: { sites: SiteWithAirports[]; airports: Airport[] }) {
  const { t, i18n } = useTranslation();
  const name = useLocalizedName();
  const form = useFormContext<TaskFormValues>();
  const { register, setValue, getValues, formState } = form;
  const errors = formState.errors;
  const [category, siteId, flight, ticket] = form.watch(['category', 'site_id', 'flight', 'ticket']);
  const site = sites.find((s) => s.id === siteId);
  const siteAirportIds = new Set(site?.airports.map((a) => a.airport_id));
  const otherAirports = airports.filter((a) => !siteAirportIds.has(a.id));
  // FR-18: after a ticket import, fields read with low confidence say "check"
  const [imported, setImported] = useState<TicketImportResult | null>(null);
  const check = (field: FlightField) => (imported?.uncertain.includes(field) ? <span className="font-semibold text-warning-fg">{t('ticketImport.checkField')}</span> : undefined);
  const list = (names: string[]) => new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(names.map(isolate));
  const arrival = flight?.direction !== 'departure';

  const onSiteChange = (id: string) => {
    const next = sites.find((s) => s.id === id);
    if (category !== 'airport' || !next) return;
    const sa = next.airports.find((a) => a.is_default) ?? next.airports[0];
    if (sa) {
      setValue('flight.airport_id', sa.airport_id, { shouldValidate: true });
      setValue('flight.buffer_min', sa.default_buffer_min);
    }
  };

  // "RUH Arrival · SV 1234" until the dispatcher types their own title
  const suggestTitle = () => {
    const f = getValues('flight');
    if (category !== 'airport' || !f?.flight_no.trim() || getValues('title').trim()) return;
    const iata = airports.find((a) => a.id === f.airport_id)?.iata ?? '';
    setValue('title', `${iata} ${t(`flight.${f.direction}`)} · ${f.flight_no.trim().toUpperCase()}`.trim(), { shouldValidate: true });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="task-site" label={t('wizard.fields.site')} error={errors.site_id?.message}>
          <NativeSelect id="task-site" {...register('site_id', { onChange: (e) => onSiteChange(e.target.value) })} aria-invalid={Boolean(errors.site_id)}>
            <option value="">{t('wizard.fields.sitePlaceholder')}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {name(s)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="task-priority" label={t('wizard.fields.priority')}>
          <NativeSelect id="task-priority" {...register('priority')}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`wizard.priority.${p}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {category === 'airport' && flight && (
        <fieldset className="space-y-4 rounded-lg border border-border bg-surface-2 p-4">
          <legend className="eyebrow px-1">{t('wizard.flight.legend')}</legend>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="radiogroup" aria-label={t('wizard.flight.direction')}>
              {(['arrival', 'departure'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={flight.direction === d}
                  onClick={() => setValue('flight.direction', d, { shouldDirty: true })}
                  className={cn('rounded px-3 py-1 text-sm font-semibold text-fg-2', flight.direction === d && 'bg-brand-500 text-fg-on-brand')}
                >
                  {t(`flight.${d}`)}
                </button>
              ))}
            </div>
            <TicketImport site={site} airports={airports} onApplied={setImported} />
          </div>
          {imported && (
            <div
              role="status"
              className={cn('tint-12 flex gap-2 rounded-md px-3 py-2 text-sm', imported.sample ? '[--tint-color:var(--warning)]' : '[--tint-color:var(--success)]')}
            >
              <FileCheck2 className={cn('mt-0.5 size-4 shrink-0', imported.sample ? 'text-warning-fg' : 'text-success-fg')} aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="font-semibold text-fg">{t('ticketImport.applied', { flight: isolate(imported.flightNo) })}</p>
                {imported.sample && <p className="text-xs font-semibold text-warning-fg">{t('ticketImport.sampleApplied')}</p>}
                {imported.missingAirport && <p className="text-xs text-fg-2">{t('ticketImport.pickAirport', { iata: isolate(imported.missingAirport) })}</p>}
                {imported.uncertain.length > 0 && <p className="text-xs text-fg-2">{t('ticketImport.appliedCheck')}</p>}
                {imported.skipped.length > 0 && <p className="text-xs text-fg-2">{t('ticketImport.skipped', { names: list(imported.skipped) })}</p>}
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="task-airport" label={arrival ? t('wizard.flight.arrivalAirport') : t('wizard.flight.departureAirport')} error={errors.flight?.airport_id?.message} hint={check('airport_id')}>
              <NativeSelect id="task-airport" {...register('flight.airport_id')} aria-invalid={Boolean(errors.flight?.airport_id)}>
                <option value="">{t('wizard.flight.airportPlaceholder')}</option>
                {site?.airports.length ? (
                  <optgroup label={t('wizard.flight.siteAirports')}>
                    {site.airports.map((sa) => (
                      <option key={sa.airport_id} value={sa.airport_id}>
                        {sa.airport.iata} · {name(sa.airport)}
                        {sa.is_default ? ` (${t('airports.default')})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {otherAirports.length > 0 && (
                  <optgroup label={t('wizard.flight.otherAirports')}>
                    {otherAirports.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.iata} · {name(a)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </NativeSelect>
            </Field>
            <Field id="task-flight-no" label={t('wizard.flight.number')} error={errors.flight?.flight_no?.message} hint={check('flight_no')}>
              <Input
                id="task-flight-no"
                dir="ltr"
                placeholder="SV 1234"
                autoComplete="off"
                {...register('flight.flight_no', { onBlur: suggestTitle })}
                aria-invalid={Boolean(errors.flight?.flight_no)}
              />
            </Field>
            <Field id="task-flight-date" label={t('wizard.flight.date')} error={errors.flight?.date?.message} hint={check('date')}>
              <Input id="task-flight-date" type="date" {...register('flight.date')} />
            </Field>
            <Field id="task-flight-time" label={flight.direction === 'arrival' ? t('wizard.flight.landing') : t('wizard.flight.takeoff')} error={errors.flight?.time?.message} hint={check('time')}>
              <Input id="task-flight-time" type="time" {...register('flight.time')} />
            </Field>
            <Field id="task-airline" label={t('wizard.flight.airline')} hint={check('airline')}>
              <Input id="task-airline" {...register('flight.airline')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="task-terminal" label={t('wizard.flight.terminal')} hint={check('terminal')}>
                <Input id="task-terminal" dir="ltr" {...register('flight.terminal')} />
              </Field>
              <Field id="task-buffer" label={t('wizard.flight.buffer')} error={errors.flight?.buffer_min?.message}>
                <Input id="task-buffer" type="number" min={0} max={240} {...register('flight.buffer_min', { valueAsNumber: true })} />
              </Field>
            </div>
          </div>
          <p className="text-xs text-fg-3">{flight.direction === 'arrival' ? t('wizard.flight.bufferHintArrival') : t('wizard.flight.bufferHintDeparture')}</p>

          {/* FR-18: the other end of the flight and the booking (tasks.metadata.ticket) */}
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Field
              id="task-other-iata"
              label={arrival ? t('wizard.flight.departureAirport') : t('wizard.flight.arrivalAirport')}
              error={errors.ticket?.other_iata?.message}
              hint={check('other_iata') ?? ([ticket.other_name, ticket.other_terminal && `${t('wizard.flight.terminal')} ${ticket.other_terminal}`].filter(Boolean).join(' · ') || undefined)}
            >
              <Input id="task-other-iata" dir="ltr" maxLength={3} placeholder="JED" autoComplete="off" className="uppercase" {...register('ticket.other_iata')} aria-invalid={Boolean(errors.ticket?.other_iata)} />
            </Field>
            <Field id="task-booking-ref" label={t('wizard.flight.bookingRef')} hint={ticket.issuer || undefined}>
              <Input id="task-booking-ref" dir="ltr" autoComplete="off" {...register('ticket.booking_ref')} />
            </Field>
            <Field id="task-other-date" label={arrival ? t('wizard.flight.departureDate') : t('wizard.flight.arrivalDate')} hint={check('other_date')}>
              <Input id="task-other-date" type="date" {...register('ticket.other_date')} />
            </Field>
            <Field id="task-other-time" label={arrival ? t('wizard.flight.takeoffLocal') : t('wizard.flight.landingLocal')} hint={check('other_time')}>
              <Input id="task-other-time" type="time" {...register('ticket.other_time')} />
            </Field>
          </div>
        </fieldset>
      )}

      <Field id="task-title" label={t('wizard.fields.title')} error={errors.title?.message}>
        <Input id="task-title" placeholder={t(`wizard.titlePlaceholder.${category}`)} {...register('title')} aria-invalid={Boolean(errors.title)} />
      </Field>

      {category === 'document_delivery' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="task-recipient" label={t('wizard.fields.recipient')}>
            <Input id="task-recipient" {...register('recipient_name')} />
          </Field>
          <Field id="task-docref" label={t('wizard.fields.documentRef')}>
            <Input id="task-docref" {...register('document_ref')} />
          </Field>
        </div>
      )}

      {category !== 'document_delivery' && <PassengerPicker />}

      <Field id="task-notes" label={t('wizard.fields.notes')}>
        <Textarea id="task-notes" rows={2} {...register('description')} />
      </Field>
    </div>
  );
}
