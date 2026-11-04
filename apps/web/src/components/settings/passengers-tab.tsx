import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/error-state';
import { Field, FormError } from '@/components/form';
import { Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useCompanySettings } from '@/features/company/queries';
import { useRatingOptions, useSavePassengerSettings, useSaveRatingOption } from '@/features/passenger/queries';
import { RATING_CATEGORIES } from '@/features/passenger/types';
import type { CompanySettings, RatingOption } from '@/mocks/fixtures';

function OptionRow({ option }: { option: RatingOption }) {
  const { t } = useTranslation();
  const save = useSaveRatingOption();
  const [label, setLabel] = useState(option.label);
  const [labelAr, setLabelAr] = useState(option.label_ar ?? '');
  const dirty = label !== option.label || labelAr !== (option.label_ar ?? '');
  const commit = (patch: Partial<Pick<RatingOption, 'alerts' | 'is_active'>> = {}) =>
    save.mutate({ id: option.id, label: label.trim() || option.label, label_ar: labelAr.trim() || null, alerts: option.alerts, is_active: option.is_active, ...patch });

  return (
    <li className="grid items-center gap-2 px-4 py-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
      <Input aria-label={t('passenger.settings.label')} value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" />
      <Input aria-label={t('passenger.settings.labelAr')} dir="rtl" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} className="h-9" />
      <label className="flex items-center gap-2 text-xs font-semibold text-fg-2">
        <Switch checked={option.alerts} onCheckedChange={(v) => commit({ alerts: v })} aria-label={`${t('passenger.settings.alerts')} · ${option.label}`} />
        {t('passenger.settings.alerts')}
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-fg-2">
        <Switch checked={option.is_active} onCheckedChange={(v) => commit({ is_active: v })} aria-label={`${t('common.active')} · ${option.label}`} />
        {t('common.active')}
      </label>
      <Button size="sm" variant="ghost" disabled={!dirty || save.isPending} onClick={() => commit()}>
        {t('common.save')}
      </Button>
    </li>
  );
}

function SignUpSettings({ settings }: { settings: CompanySettings }) {
  const { t } = useTranslation();
  const save = useSavePassengerSettings();
  const [domains, setDomains] = useState(settings.passenger_email_domains.join(', '));
  const [code, setCode] = useState(settings.passenger_join_code ?? '');
  const [hours, setHours] = useState(settings.rating_edit_hours);
  const [threshold, setThreshold] = useState(settings.low_rating_threshold);
  return (
      <Panel title={t('passenger.settings.signUp')} bodyClassName="p-5">
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              passenger_email_domains: domains.split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean),
              passenger_join_code: code.trim().toUpperCase() || null,
              rating_edit_hours: hours,
              low_rating_threshold: threshold,
            });
          }}
        >
          <Field id="pax-domains" label={t('passenger.settings.domains')} hint={t('passenger.settings.domainsHint')} className="sm:col-span-2">
            <Input id="pax-domains" dir="ltr" placeholder="company.com, company.sa" value={domains} onChange={(e) => setDomains(e.target.value)} />
          </Field>
          <Field id="pax-code" label={t('passenger.register.joinCode')} hint={t('passenger.settings.joinCodeHint')}>
            <Input id="pax-code" dir="ltr" className="uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="pax-hours" label={t('passenger.settings.editHours')}>
              <Input id="pax-hours" type="number" min={0} max={720} className="tabular" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
            </Field>
            <Field id="pax-threshold" label={t('passenger.settings.threshold')} hint={t('passenger.settings.thresholdHint')}>
              <Input id="pax-threshold" type="number" min={1} max={5} className="tabular" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            </Field>
          </div>
          <FormError error={save.error} className="sm:col-span-2" />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
            {save.isSuccess && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-fg">
                <CircleCheck className="size-4" aria-hidden="true" />
                {t('common.saved')}
              </span>
            )}
          </div>
        </form>
      </Panel>
  );
}

/** 0006 — who may sign up as a passenger, and how ratings work (options are editable, translatable data). */
export function PassengersTab() {
  const { t } = useTranslation();
  const settings = useCompanySettings();
  const options = useRatingOptions();

  if (settings.isPending || options.isPending) return <Skeleton className="h-64 w-full" />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  if (options.isError) return <ErrorState error={options.error} onRetry={() => void options.refetch()} />;

  return (
    <div className="space-y-5">
      {settings.data && <SignUpSettings settings={settings.data} />}

      {RATING_CATEGORIES.map((category) => (
        <Panel key={category} title={t(`rating.categories.${category}`)} bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {options.data
              .filter((o) => o.category === category)
              .map((o) => (
                <OptionRow key={o.id} option={o} />
              ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
