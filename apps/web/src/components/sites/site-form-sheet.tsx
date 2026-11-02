import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Field, FormError, NativeSelect } from '@/components/form';
import { MapPicker } from '@/components/map-picker';
import { AirportPicker } from '@/components/sites/airport-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/session';
import { SITE_DEFAULTS, siteSchema, type SiteAirportValues, type SiteValues } from '@/features/sites/schema';
import { useSaveSite, useSetSiteAirports, type SiteWithAirports } from '@/features/sites/queries';

export function siteToValues(site: SiteWithAirports): SiteValues {
  return {
    name: site.name,
    name_ar: site.name_ar ?? '',
    code: site.code ?? '',
    type: site.type,
    address: site.address ?? '',
    address_ar: site.address_ar ?? '',
    city: site.city ?? '',
    lat: site.lat ?? SITE_DEFAULTS.lat,
    lng: site.lng ?? SITE_DEFAULTS.lng,
    contact_name: site.contact_name ?? '',
    contact_phone: site.contact_phone ?? '',
    work_start: (site.work_start ?? '07:00').slice(0, 5),
    work_end: (site.work_end ?? '17:00').slice(0, 5),
    notes: site.notes ?? '',
    is_active: site.is_active,
  };
}

export function siteAirportsToValues(site: SiteWithAirports): SiteAirportValues[] {
  return site.airports.map((sa) => ({
    iata: sa.airport.iata ?? '',
    icao: sa.airport.icao,
    name: sa.airport.name,
    name_ar: sa.airport.name_ar,
    city: sa.airport.city,
    city_ar: sa.airport.city_ar,
    country_code: sa.airport.country_code,
    lat: sa.airport.lat,
    lng: sa.airport.lng,
    is_international: sa.airport.is_international ?? true,
    source: sa.airport.source === 'google' || sa.airport.source === 'manual' ? sa.airport.source : 'ai',
    distance_km: sa.distance_km != null ? Number(sa.distance_km) : null,
    drive_minutes: sa.drive_minutes,
    default_buffer_min: sa.default_buffer_min,
    is_default: sa.is_default,
  }));
}

/** FR-02 create/edit a site; creating continues straight into airports (FR-03, PRD §7.1). */
export function SiteFormSheet({
  open,
  onOpenChange,
  site,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: SiteWithAirports;
  onSaved?: (siteId: string) => void;
}) {
  const { t } = useTranslation();
  const { company } = useCurrentUser();
  const save = useSaveSite();
  const setAirports = useSetSiteAirports();
  const [step, setStep] = useState<'details' | 'airports'>('details');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [airports, setAirportsValue] = useState<SiteAirportValues[]>([]);
  const form = useForm<SiteValues>({ resolver: zodResolver(siteSchema), defaultValues: SITE_DEFAULTS });
  const errors = form.formState.errors;
  const [lat, lng, name] = form.watch(['lat', 'lng', 'name']);

  useEffect(() => {
    if (!open) return;
    form.reset(site ? siteToValues(site) : SITE_DEFAULTS);
    setStep('details');
    setSavedId(null);
    setAirportsValue([]);
    save.reset();
    setAirports.reset();
    // reset whenever the sheet (re)opens for a site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, site?.id]);

  const close = () => onOpenChange(false);
  const finish = () => {
    if (savedId) onSaved?.(savedId);
    close();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{step === 'airports' ? t('onboarding.airports.title') : site ? t('sites.edit') : t('sites.add')}</SheetTitle>
          <SheetDescription>{step === 'airports' ? t('onboarding.airports.body') : t('sites.formHint')}</SheetDescription>
        </SheetHeader>

        {step === 'details' ? (
          <form
            id="site-form"
            noValidate
            className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5"
            onSubmit={form.handleSubmit((values) =>
              save.mutate(
                { id: site?.id, values },
                {
                  // a new site continues to airports; onSaved fires when the whole flow ends
                  onSuccess: (id) => {
                    if (site) {
                      onSaved?.(id);
                      return close();
                    }
                    setSavedId(id);
                    setStep('airports');
                  },
                },
              ),
            )}
          >
            <section className="grid gap-4 sm:grid-cols-2">
              <Field id="site-name" label={t('onboarding.site.name')} error={errors.name?.message}>
                <Input id="site-name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
              </Field>
              <Field id="site-name-ar" label={t('sites.nameAr')}>
                <Input id="site-name-ar" dir="rtl" {...form.register('name_ar')} />
              </Field>
              <Field id="site-code" label={t('sites.code')} hint={t('sites.codeHint')} error={errors.code?.message}>
                <Input id="site-code" dir="ltr" maxLength={8} className="uppercase" {...form.register('code')} />
              </Field>
              <Field id="site-type" label={t('onboarding.site.type')}>
                <NativeSelect id="site-type" {...form.register('type')}>
                  {(['construction_site', 'office', 'warehouse', 'other'] as const).map((type) => (
                    <option key={type} value={type}>
                      {t(`sites.type.${type}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="site-address" label={t('onboarding.site.address')}>
                <Input id="site-address" {...form.register('address')} />
              </Field>
              <Field id="site-city" label={t('sites.city')}>
                <Input id="site-city" {...form.register('city')} />
              </Field>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold">{t('sites.location')}</h3>
              <MapPicker
                lat={lat}
                lng={lng}
                label={name}
                latError={errors.lat?.message}
                lngError={errors.lng?.message}
                onChange={(coords) => {
                  form.setValue('lat', coords.lat, { shouldValidate: true, shouldDirty: true });
                  form.setValue('lng', coords.lng, { shouldValidate: true, shouldDirty: true });
                }}
              />
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <Field id="site-contact" label={t('sites.contactName')}>
                <Input id="site-contact" {...form.register('contact_name')} />
              </Field>
              <Field id="site-phone" label={t('sites.contactPhone')}>
                <Input id="site-phone" type="tel" dir="ltr" {...form.register('contact_phone')} />
              </Field>
              <Field id="site-start" label={t('sites.workStart')} error={errors.work_start?.message}>
                <Input id="site-start" type="time" dir="ltr" {...form.register('work_start')} />
              </Field>
              <Field id="site-end" label={t('sites.workEnd')} error={errors.work_end?.message}>
                <Input id="site-end" type="time" dir="ltr" {...form.register('work_end')} />
              </Field>
              <Field id="site-notes" label={t('sites.notes')} className="sm:col-span-2">
                <Textarea id="site-notes" rows={2} {...form.register('notes')} />
              </Field>
              {site && (
                <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
                  <Switch checked={form.watch('is_active')} onCheckedChange={(v) => form.setValue('is_active', v, { shouldDirty: true })} />
                  {t('common.active')}
                </label>
              )}
            </section>
            <FormError error={save.error} />
          </form>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <AirportPicker lat={lat} lng={lng} countryCode={company?.country_code} value={airports} onChange={setAirportsValue} autoSuggest />
            <FormError error={setAirports.error} className="mt-4" />
          </div>
        )}

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
          {step === 'details' ? (
            <>
              <Button variant="outline" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="site-form" disabled={save.isPending}>
                {save.isPending ? t('common.saving') : site ? t('common.save') : t('sites.saveAndAirports')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={finish}>
                {t('airports.skip')}
              </Button>
              <Button
                disabled={setAirports.isPending || !airports.length}
                onClick={() => savedId && setAirports.mutate({ siteId: savedId, airports }, { onSuccess: finish })}
              >
                {setAirports.isPending ? t('common.saving') : t('airports.save')}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Edit an existing site's airports (FR-03). Content mounts per opening, so state starts from the site. */
export function SiteAirportsSheet({ open, onOpenChange, site }: { open: boolean; onOpenChange: (open: boolean) => void; site: SiteWithAirports }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t('sites.airports')}</SheetTitle>
          <SheetDescription>{t('onboarding.airports.body')}</SheetDescription>
        </SheetHeader>
        <SiteAirportsEditor key={site.id} site={site} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function SiteAirportsEditor({ site, onDone }: { site: SiteWithAirports; onDone: () => void }) {
  const { t } = useTranslation();
  const { company } = useCurrentUser();
  const setAirports = useSetSiteAirports();
  const [airports, setAirportsValue] = useState<SiteAirportValues[]>(() => siteAirportsToValues(site));
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <AirportPicker
          lat={site.lat ?? SITE_DEFAULTS.lat}
          lng={site.lng ?? SITE_DEFAULTS.lng}
          countryCode={company?.country_code}
          value={airports}
          onChange={setAirportsValue}
          autoSuggest={!site.airports.length}
        />
        <FormError error={setAirports.error} className="mt-4" />
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
        <Button variant="outline" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button disabled={setAirports.isPending || !airports.length} onClick={() => setAirports.mutate({ siteId: site.id, airports }, { onSuccess: onDone })}>
          {setAirports.isPending ? t('common.saving') : t('airports.save')}
        </Button>
      </SheetFooter>
    </>
  );
}
