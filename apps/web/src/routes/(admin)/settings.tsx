import { forwardRef, useEffect, useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarHeart, CircleCheck, Plus, UserPlus, UsersRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DriverAvatar } from '@/components/driver-avatar';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isAdmin } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { companyRulesSchema, type CompanyRulesValues } from '@/features/company/schema';
import { useCompanySettings, useCompanyUsers, useHolidays, useUpdateCompanyRules } from '@/features/company/queries';
import { useSites } from '@/features/sites/queries';
import { formatDate, formatHours, formatWeekday } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';

const TABS = ['company', 'rules', 'holidays', 'users'] as const;
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

function CompanyTab() {
  const { t } = useTranslation();
  const { company } = useCurrentUser();
  if (!company) return null;
  return (
    <Panel bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="company-name">{t('settings.company.name')}</Label>
        <Input id="company-name" defaultValue={company.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company-name-ar">{t('settings.company.nameAr')}</Label>
        <Input id="company-name-ar" defaultValue={company.name_ar ?? ''} dir="rtl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company-tz">{t('settings.company.timezone')}</Label>
        <Input id="company-tz" defaultValue={company.timezone} dir="ltr" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company-country">{t('settings.company.country')}</Label>
        <Input id="company-country" defaultValue={company.country_code} dir="ltr" />
      </div>
      <div className="sm:col-span-2">
        <Button disabled title={t('common.comingSoon')}>
          {t('common.save')}
        </Button>
      </div>
    </Panel>
  );
}

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

function HolidaysTab() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const holidays = useHolidays();
  return (
    <Panel
      title={t('settings.holidays.title')}
      action={
        <Button size="sm" variant="outline" disabled title={t('common.comingSoon')}>
          <Plus aria-hidden="true" />
          {t('common.add')}
        </Button>
      }
    >
      {holidays.isPending ? (
        <Skeleton className="m-4 h-24" />
      ) : holidays.isError ? (
        <ErrorState error={holidays.error} onRetry={() => void holidays.refetch()} />
      ) : !holidays.data.length ? (
        <EmptyState compact icon={CalendarHeart} title={t('settings.holidays.empty')} />
      ) : (
        <ul className="divide-y divide-border">
          {holidays.data.map((h) => (
            <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-semibold">{name(h)}</span>
              <span className="tabular text-fg-2">{formatDate(`${h.date}T12:00:00Z`)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function UsersTab() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const users = useCompanyUsers();
  const sites = useSites();
  const siteName = (id: string) => {
    const site = sites.data?.find((s) => s.id === id);
    return site ? (site.code ?? name(site)) : id;
  };
  return (
    <Panel
      title={t('settings.users.title')}
      action={
        <Button size="sm" disabled title={t('common.comingSoon')}>
          <UserPlus aria-hidden="true" />
          {t('settings.users.invite')}
        </Button>
      }
    >
      {users.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : !users.data.length ? (
        <EmptyState compact icon={UsersRound} title={t('settings.users.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('settings.users.name')}</TableHead>
              <TableHead>{t('settings.users.role')}</TableHead>
              <TableHead>{t('settings.users.scope')}</TableHead>
              <TableHead>{t('settings.users.language')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <DriverAvatar name={u.full_name} className="size-7" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{name(u, 'full_name')}</p>
                      <p className="truncate text-xs text-fg-3" dir="ltr">
                        {u.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === 'owner' || u.role === 'admin' ? 'brand' : 'default'}>{t(`roles.${u.role}`)}</Badge>
                </TableCell>
                <TableCell className="text-xs text-fg-2">
                  {u.role === 'driver' ? '—' : u.siteIds.length ? u.siteIds.map(siteName).join(', ') : t('common.allSites')}
                </TableCell>
                <TableCell className="text-xs uppercase text-fg-2">{u.language}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
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
        <TabsList>
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
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
