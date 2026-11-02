import { forwardRef, useEffect, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/error-state';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { CompanyTab } from '@/components/settings/company-tab';
import { HolidaysTab } from '@/components/settings/holidays-tab';
import { UsersTab } from '@/components/settings/users-tab';
import { VehiclesTab } from '@/components/settings/vehicles-tab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isAdmin } from '@/features/auth/guards';
import { companyRulesSchema, type CompanyRulesValues } from '@/features/company/schema';
import { useCompanySettings, useUpdateCompanyRules } from '@/features/company/queries';
import { formatHours, formatWeekday } from '@/lib/format';

const TABS = ['company', 'rules', 'holidays', 'vehicles', 'users'] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute('/(admin)/settings')({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => ({
    tab: TABS.includes(search.tab as Tab) ? (search.tab as Tab) : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (context.session.status === 'signed-in' && !isAdmin(context.session.user.profile.role)) throw redirect({ to: '/dashboard' });
  },
  component: SettingsPage,
});

// forwardRef: react-hook-form's register() reads the value through the input ref.
const NumberField = forwardRef<HTMLInputElement, { id: string; label: string; hint?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>>(
  ({ id, label, hint, error, ...props }, ref) => {
    const { t } = useTranslation();
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input ref={ref} id={id} type="number" inputMode="numeric" className="tabular" aria-invalid={Boolean(error)} {...props} />
        {error ? <p className="text-xs font-semibold text-danger">{t(error)}</p> : hint && <p className="text-xs text-fg-3">{hint}</p>}
      </div>
    );
  },
);
NumberField.displayName = 'NumberField';

function RulesTab() {
  const { t } = useTranslation();
  const settings = useCompanySettings();
  const save = useUpdateCompanyRules();
  const [newOffset, setNewOffset] = useState('');
  const form = useForm<CompanyRulesValues>({ resolver: zodResolver(companyRulesSchema) });
  const errors = form.formState.errors;

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    form.reset({
      reminder_offsets_min: s.reminder_offsets_min,
      ack_deadline_min: s.ack_deadline_min,
      grace_min: s.grace_min,
      no_show_after_min: s.no_show_after_min,
      airport_share_window_min: s.airport_share_window_min,
      far_location_km: Number(s.far_location_km),
      standard_day_min: s.standard_day_min,
      weekly_max_min: s.weekly_max_min,
      max_daily_driving_min: s.max_daily_driving_min,
      weekend_days: s.weekend_days,
    });
  }, [settings.data, form]);

  if (settings.isPending) return <Skeleton className="h-96" />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;

  const num = { valueAsNumber: true } as const;
  return (
    <form noValidate onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-5">
      <Panel title={t('settings.rules.reminders')} bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="reminder_offsets_min"
          render={({ field }) => (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="new-offset">{t('settings.rules.offsets')}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {[...(field.value ?? [])]
                  .sort((a, b) => b - a)
                  .map((offset) => (
                    <Badge key={offset} variant="brand" className="gap-1 py-1">
                      {offset >= 60 ? t('units.hoursShort', { value: formatHours(offset) }) : t('units.minutes', { value: offset })}
                      <button type="button" onClick={() => field.onChange(field.value.filter((v) => v !== offset))} aria-label={t('settings.rules.removeOffset')}>
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  ))}
                <Input id="new-offset" type="number" value={newOffset} onChange={(e) => setNewOffset(e.target.value)} className="tabular h-8 w-24" placeholder={t('settings.rules.minutes')} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const value = Number(newOffset);
                    if (Number.isFinite(value) && value > 0 && !field.value.includes(value)) field.onChange([...field.value, value]);
                    setNewOffset('');
                  }}
                >
                  <Plus aria-hidden="true" />
                  {t('common.add')}
                </Button>
              </div>
              {errors.reminder_offsets_min && (
                <p className="text-xs font-semibold text-danger">{t(errors.reminder_offsets_min.message ?? errors.reminder_offsets_min.root?.message ?? 'errors.generic')}</p>
              )}
            </div>
          )}
        />
        <NumberField id="ack" label={t('settings.rules.ackDeadline')} hint={t('settings.rules.minutesBefore')} error={errors.ack_deadline_min?.message} {...form.register('ack_deadline_min', num)} />
        <NumberField id="grace" label={t('settings.rules.grace')} hint={t('settings.rules.minutesAfter')} error={errors.grace_min?.message} {...form.register('grace_min', num)} />
        <NumberField id="noshow" label={t('settings.rules.noShow')} hint={t('settings.rules.minutesAfter')} error={errors.no_show_after_min?.message} {...form.register('no_show_after_min', num)} />
        <NumberField id="share" label={t('settings.rules.shareWindow')} hint={t('settings.rules.shareWindowHint')} error={errors.airport_share_window_min?.message} {...form.register('airport_share_window_min', num)} />
        <NumberField id="far" label={t('settings.rules.farLocation')} hint={t('settings.rules.farLocationHint')} error={errors.far_location_km?.message} {...form.register('far_location_km', num)} />
      </Panel>

      <Panel title={t('settings.rules.overtime')} bodyClassName="grid gap-4 p-5 sm:grid-cols-3">
        <NumberField id="day" label={t('settings.rules.standardDay')} hint={t('settings.rules.minutes')} error={errors.standard_day_min?.message} {...form.register('standard_day_min', num)} />
        <NumberField id="week" label={t('settings.rules.weeklyMax')} hint={t('settings.rules.minutes')} error={errors.weekly_max_min?.message} {...form.register('weekly_max_min', num)} />
        <NumberField id="maxdrive" label={t('settings.rules.maxDriving')} hint={t('settings.rules.minutes')} error={errors.max_daily_driving_min?.message} {...form.register('max_daily_driving_min', num)} />
        <Controller
          control={form.control}
          name="weekend_days"
          render={({ field }) => (
            <fieldset className="space-y-2 sm:col-span-3">
              <legend className="text-sm font-semibold">{t('settings.rules.weekend')}</legend>
              <div className="flex flex-wrap gap-4">
                {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
                  <label key={dow} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value?.includes(dow)}
                      onCheckedChange={(checked) => field.onChange(checked ? [...field.value, dow].sort() : field.value.filter((d) => d !== dow))}
                    />
                    {/* 2023-01-01 was a Sunday (dow 0) */}
                    {formatWeekday(`2023-01-0${dow + 1}T12:00:00Z`, 'long')}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        />
      </Panel>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
          {save.isPending ? t('common.saving') : t('common.save')}
        </Button>
        {save.isSuccess && !form.formState.isDirty && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-fg">
            <CircleCheck className="size-4" aria-hidden="true" />
            {t('common.saved')}
          </span>
        )}
      </div>
    </form>
  );
}

/** Screen 11 — company, reminders & overtime rules, holidays, users (FR-60/61). */
function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });
  const { tab = 'company' } = Route.useSearch();

  return (
    <Page>
      <PageHeader title={t('nav.settings')} description={t('settings.subtitle')} />
      <Tabs value={tab} onValueChange={(v) => void navigate({ search: (prev) => ({ ...prev, tab: v === 'company' ? undefined : (v as Tab) }) })}>
        <TabsList className="max-w-full overflow-x-auto">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`settings.tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="company">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab />
        </TabsContent>
        <TabsContent value="vehicles">
          <VehiclesTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
