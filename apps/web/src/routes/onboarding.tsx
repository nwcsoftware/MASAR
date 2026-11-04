import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { INVITABLE_ROLES, inviteUserInput } from '@shared/schemas';
import { Field, FormError, NativeSelect } from '@/components/form';
import { LanguageToggle } from '@/components/language-toggle';
import { Logo } from '@/components/logo';
import { MapPicker } from '@/components/map-picker';
import { AirportPicker } from '@/components/sites/airport-picker';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requireOnboardingUser } from '@/features/auth/guards';
import { useCurrentUser } from '@/features/auth/session';
import { useInviteUser, useUpdateCompany } from '@/features/company/queries';
import { companyProfileSchema, type CompanyProfileValues } from '@/features/company/schema';
import { SITE_DEFAULTS, siteSchema, type SiteAirportValues, type SiteValues } from '@/features/sites/schema';
import { useSaveSite, useSetSiteAirports } from '@/features/sites/queries';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: ({ context, location }) => {
    requireOnboardingUser(context.session, location);
  },
  component: OnboardingPage,
});

const STEPS = ['company', 'site', 'airports', 'invite'] as const;
type Step = (typeof STEPS)[number];
type Role = (typeof INVITABLE_ROLES)[number];
interface InviteRow {
  email: string;
  full_name: string;
  role: Role;
  status?: 'sent' | 'error';
  error?: unknown;
}

/**
 * Screen 2 — Company → First site (MapPicker) → Airports (AirportPicker) →
 * Invite users (FR-01…04). The platform super admin has already created the
 * company and invited this owner (0008); the first step confirms its profile.
 * Each step persists when you press Next, so leaving half-way keeps what's done.
 */
function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [step, setStep] = useState<Step>('company');
  const index = STEPS.indexOf(step);

  const updateCompany = useUpdateCompany();
  const saveSite = useSaveSite();
  const setAirports = useSetSiteAirports();
  const invite = useInviteUser();

  const companyForm = useForm<CompanyProfileValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      name: user.company?.name ?? '',
      name_ar: user.company?.name_ar ?? '',
      country_code: user.company?.country_code ?? 'SA',
      timezone: user.company?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Riyadh',
      default_language: user.company?.default_language ?? 'en',
    },
  });
  const siteForm = useForm<SiteValues>({ resolver: zodResolver(siteSchema), defaultValues: SITE_DEFAULTS });
  const [siteId, setSiteId] = useState<string | null>(null);
  const [airports, setAirportsValue] = useState<SiteAirportValues[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([{ email: '', full_name: '', role: 'dispatcher' }]);
  const [lat, lng, siteName] = siteForm.watch(['lat', 'lng', 'name']);
  const companyErrors = companyForm.formState.errors;
  const siteErrors = siteForm.formState.errors;

  const busy = updateCompany.isPending || saveSite.isPending || setAirports.isPending || invite.isPending;
  const stepError =
    step === 'company' ? updateCompany.error : step === 'site' ? saveSite.error : step === 'airports' ? setAirports.error : null;

  const next = async () => {
    if (step === 'company') {
      await companyForm.handleSubmit(async (values) => {
        await updateCompany.mutateAsync(values);
        setStep('site');
      })();
      return;
    }
    if (step === 'site') {
      await siteForm.handleSubmit(async (values) => {
        const id = await saveSite.mutateAsync({ id: siteId ?? undefined, values });
        setSiteId(id);
        setStep('airports');
      })();
      return;
    }
    if (step === 'airports') {
      if (siteId && airports.length) await setAirports.mutateAsync({ siteId, airports });
      setStep('invite');
      return;
    }
    // invite: send each filled row once; stay on the step if any failed
    const results = await Promise.all(
      invites.map(async (row): Promise<InviteRow> => {
        if (row.status === 'sent' || (!row.email && !row.full_name)) return row;
        const parsed = inviteUserInput.safeParse({ email: row.email, full_name: row.full_name, role: row.role, language: companyForm.getValues('default_language') });
        if (!parsed.success) return { ...row, status: 'error', error: new Error(parsed.error.issues[0]?.message ?? 'errors.invalidInput') };
        try {
          await invite.mutateAsync(parsed.data);
          return { ...row, status: 'sent', error: undefined };
        } catch (error) {
          return { ...row, status: 'error', error };
        }
      }),
    );
    setInvites(results);
    if (!results.some((r) => r.status === 'error')) void navigate({ to: '/dashboard' });
  };

  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex h-topbar items-center justify-between border-b border-border bg-surface px-4 lg:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <LanguageToggle compact />
          <ThemeToggle compact />
          <Button asChild variant="ghost" size="sm">
            <Link to="/">{t('onboarding.exit')}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="space-y-1">
          <p className="eyebrow">{t('onboarding.stepOf', { step: index + 1, total: STEPS.length })}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{t(`onboarding.${step}.title`)}</h1>
          <p className="text-sm text-fg-2">{t(`onboarding.${step}.body`)}</p>
        </div>

        <ol className="grid grid-cols-4 gap-2" aria-label={t('onboarding.progress')}>
          {STEPS.map((s, i) => (
            <li key={s} className="space-y-1.5" aria-current={s === step ? 'step' : undefined}>
              <span className={cn('block h-1.5 rounded-full', i <= index ? 'bg-brand-500' : 'bg-surface-3')} />
              <span className={cn('flex items-center gap-1 text-xs font-semibold', i <= index ? 'text-fg' : 'text-fg-3')}>
                {i < index && <Check className="size-3 text-success-fg" aria-hidden="true" />}
                {t(`onboarding.${s}.short`)}
              </span>
            </li>
          ))}
        </ol>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          {step === 'company' && (
            <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => (e.preventDefault(), void next())}>
              <Field id="c-name" label={t('settings.company.name')} error={companyErrors.name?.message}>
                <Input id="c-name" aria-invalid={Boolean(companyErrors.name)} {...companyForm.register('name')} />
              </Field>
              <Field id="c-name-ar" label={t('settings.company.nameAr')}>
                <Input id="c-name-ar" dir="rtl" {...companyForm.register('name_ar')} />
              </Field>
              <Field id="c-tz" label={t('settings.company.timezone')} error={companyErrors.timezone?.message}>
                <Input id="c-tz" dir="ltr" {...companyForm.register('timezone')} />
              </Field>
              <Field id="c-country" label={t('settings.company.country')} error={companyErrors.country_code?.message}>
                <Input id="c-country" dir="ltr" maxLength={2} className="uppercase" {...companyForm.register('country_code')} />
              </Field>
              <Field id="c-lang" label={t('settings.company.language')}>
                <NativeSelect id="c-lang" {...companyForm.register('default_language')}>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </NativeSelect>
              </Field>
              <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
            </form>
          )}

          {step === 'site' && (
            <form noValidate className="space-y-4" onSubmit={(e) => (e.preventDefault(), void next())}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="s-name" label={t('onboarding.site.name')} error={siteErrors.name?.message}>
                  <Input id="s-name" aria-invalid={Boolean(siteErrors.name)} {...siteForm.register('name')} />
                </Field>
                <Field id="s-type" label={t('onboarding.site.type')}>
                  <NativeSelect id="s-type" {...siteForm.register('type')}>
                    {(['construction_site', 'office', 'warehouse', 'other'] as const).map((type) => (
                      <option key={type} value={type}>
                        {t(`sites.type.${type}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id="s-address" label={t('onboarding.site.address')}>
                  <Input id="s-address" {...siteForm.register('address')} />
                </Field>
                <Field id="s-city" label={t('sites.city')}>
                  <Input id="s-city" {...siteForm.register('city')} />
                </Field>
              </div>
              <MapPicker
                lat={lat}
                lng={lng}
                label={siteName}
                latError={siteErrors.lat?.message}
                lngError={siteErrors.lng?.message}
                onChange={(coords) => {
                  siteForm.setValue('lat', coords.lat, { shouldValidate: true });
                  siteForm.setValue('lng', coords.lng, { shouldValidate: true });
                }}
              />
            </form>
          )}

          {step === 'airports' && (
            <AirportPicker lat={lat} lng={lng} countryCode={companyForm.getValues('country_code')} value={airports} onChange={setAirportsValue} autoSuggest />
          )}

          {step === 'invite' && (
            <div className="space-y-3">
              {invites.map((row, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex flex-wrap items-start gap-2">
                    <Input
                      className="min-w-48 flex-1"
                      type="email"
                      dir="ltr"
                      placeholder="name@company.com"
                      aria-label={t('auth.email')}
                      value={row.email}
                      disabled={row.status === 'sent'}
                      onChange={(e) => setInvites((list) => list.map((x, j) => (j === i ? { ...x, email: e.target.value, status: undefined } : x)))}
                    />
                    <Input
                      className="min-w-40 flex-1"
                      placeholder={t('invite.fullName')}
                      aria-label={t('invite.fullName')}
                      value={row.full_name}
                      disabled={row.status === 'sent'}
                      onChange={(e) => setInvites((list) => list.map((x, j) => (j === i ? { ...x, full_name: e.target.value, status: undefined } : x)))}
                    />
                    <NativeSelect
                      className="w-36"
                      aria-label={t('settings.users.role')}
                      value={row.role}
                      disabled={row.status === 'sent'}
                      onChange={(e) => setInvites((list) => list.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))}
                    >
                      {INVITABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </NativeSelect>
                    {row.status === 'sent' ? (
                      <span className="inline-flex h-10 items-center gap-1 text-sm font-semibold text-success-fg">
                        <Check className="size-4" aria-hidden="true" />
                        {t('users.sent')}
                      </span>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setInvites((list) => list.filter((_, j) => j !== i))} aria-label={t('common.remove')}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  {row.status === 'error' && <FormError error={row.error} />}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setInvites((list) => [...list, { email: '', full_name: '', role: 'driver' }])}>
                <Plus aria-hidden="true" />
                {t('onboarding.invite.add')}
              </Button>
              <p className="text-xs text-fg-3">{t('onboarding.invite.optional')}</p>
            </div>
          )}

          {stepError && <FormError error={stepError} className="mt-4" />}
        </section>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(STEPS[index - 1] ?? step)} disabled={index === 0 || busy}>
            <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
            {t('common.back')}
          </Button>
          <Button onClick={() => void next()} disabled={busy}>
            {busy ? t('common.saving') : step === 'invite' ? t('onboarding.finish') : t('common.next')}
            <ArrowRight className="rtl:-scale-x-100" aria-hidden="true" />
          </Button>
        </div>
      </main>
    </div>
  );
}
