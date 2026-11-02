import { useMemo, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, LocateFixed, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';
import { Logo } from '@/components/logo';
import { MapCanvas } from '@/components/map-canvas';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { requireOnboardingUser } from '@/features/auth/guards';
import { companyStepSchema, inviteSchema, siteStepSchema, type CompanyStepValues, type SiteStepValues } from '@/features/onboarding/schema';
import { AIRPORT_CATALOGUE } from '@/mocks/airport-catalogue';
import { distanceKm, estimateDrive } from '@/lib/geo';
import { formatNumber } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: ({ context, location }) => {
    requireOnboardingUser(context.session, location);
  },
  component: OnboardingPage,
});

const STEPS = ['company', 'site', 'airports', 'invite'] as const;
type Step = (typeof STEPS)[number];
type Role = 'admin' | 'dispatcher' | 'driver' | 'viewer';

function FieldError({ message }: { message?: string }) {
  const { t } = useTranslation();
  return message ? <p className="text-xs font-semibold text-danger">{t(message)}</p> : null;
}

/** Screen 2 — Company → First site (MapPicker) → Airports (AirportPicker) → Invite users (FR-01…04). */
function OnboardingPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('company');
  const index = STEPS.indexOf(step);

  const companyForm = useForm<CompanyStepValues>({
    resolver: zodResolver(companyStepSchema),
    defaultValues: { name: '', name_ar: '', country_code: 'SA', timezone: 'Asia/Riyadh', default_language: 'en' },
  });
  const siteForm = useForm<SiteStepValues>({
    resolver: zodResolver(siteStepSchema),
    defaultValues: { name: '', name_ar: '', type: 'construction_site', address: '', lat: 24.7136, lng: 46.6753 },
  });
  const [lat, lng] = siteForm.watch(['lat', 'lng']);

  // AirportPicker — demo stand-in for ai-suggest-airports: nearest 5 from the catalogue.
  const suggestions = useMemo(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return AIRPORT_CATALOGUE.map((a) => {
      const km = distanceKm(lat, lng, a.lat, a.lng);
      return { ...a, ...estimateDrive(km) };
    })
      .sort((a, b) => a.roadKm - b.roadKm)
      .slice(0, 5);
  }, [lat, lng]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [defaultIata, setDefaultIata] = useState<string | null>(null);
  const chosen = suggestions.filter((s) => picked[s.iata] ?? s === suggestions[0]);
  const effectiveDefault = defaultIata && chosen.some((c) => c.iata === defaultIata) ? defaultIata : (chosen[0]?.iata ?? null);

  const [invites, setInvites] = useState<{ email: string; role: Role }[]>([{ email: '', role: 'dispatcher' }]);
  const inviteErrors = invites.map((inv) => (inv.email ? inviteSchema.safeParse(inv).error?.issues[0]?.message : undefined));

  const next = async () => {
    if (step === 'company' && !(await companyForm.trigger())) return;
    if (step === 'site' && !(await siteForm.trigger())) return;
    if (step === 'invite') {
      if (inviteErrors.some(Boolean)) return;
      // Phase 1: create company/site/airports via Supabase + invite Edge Function.
      void navigate({ to: '/dashboard' });
      return;
    }
    setStep(STEPS[index + 1] ?? step);
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">{t('settings.company.name')}</Label>
                <Input id="c-name" aria-invalid={Boolean(companyForm.formState.errors.name)} {...companyForm.register('name')} />
                <FieldError message={companyForm.formState.errors.name?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-name-ar">{t('settings.company.nameAr')}</Label>
                <Input id="c-name-ar" dir="rtl" {...companyForm.register('name_ar')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-tz">{t('settings.company.timezone')}</Label>
                <Input id="c-tz" dir="ltr" {...companyForm.register('timezone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-lang">{t('settings.company.language')}</Label>
                <Select value={companyForm.watch('default_language')} onValueChange={(v) => companyForm.setValue('default_language', v as 'en' | 'ar')}>
                  <SelectTrigger id="c-lang">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 'site' && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-name">{t('onboarding.site.name')}</Label>
                  <Input id="s-name" aria-invalid={Boolean(siteForm.formState.errors.name)} {...siteForm.register('name')} />
                  <FieldError message={siteForm.formState.errors.name?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-type">{t('onboarding.site.type')}</Label>
                  <Select value={siteForm.watch('type')} onValueChange={(v) => siteForm.setValue('type', v as SiteStepValues['type'])}>
                    <SelectTrigger id="s-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['construction_site', 'office', 'warehouse', 'other'] as const).map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`sites.type.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-address">{t('onboarding.site.address')}</Label>
                  <Input id="s-address" placeholder={t('onboarding.site.addressHint')} {...siteForm.register('address')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-lat">{t('onboarding.site.lat')}</Label>
                    <Input id="s-lat" type="number" step="any" dir="ltr" className="tabular" aria-invalid={Boolean(siteForm.formState.errors.lat)} {...siteForm.register('lat', { valueAsNumber: true })} />
                    <FieldError message={siteForm.formState.errors.lat?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="s-lng">{t('onboarding.site.lng')}</Label>
                    <Input id="s-lng" type="number" step="any" dir="ltr" className="tabular" aria-invalid={Boolean(siteForm.formState.errors.lng)} {...siteForm.register('lng', { valueAsNumber: true })} />
                    <FieldError message={siteForm.formState.errors.lng?.message} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition((pos) => {
                      siteForm.setValue('lat', Number(pos.coords.latitude.toFixed(5)), { shouldValidate: true });
                      siteForm.setValue('lng', Number(pos.coords.longitude.toFixed(5)), { shouldValidate: true });
                    })
                  }
                >
                  <LocateFixed aria-hidden="true" />
                  {t('onboarding.site.useLocation')}
                </Button>
              </div>
              <div className="space-y-2">
                <MapCanvas
                  className="h-64 rounded-lg border border-border md:h-full md:min-h-64"
                  caption={t('onboarding.site.mapCaption')}
                  pins={Number.isFinite(lat) && Number.isFinite(lng) ? [{ id: 'site', lat, lng, label: siteForm.watch('name') || t('onboarding.site.newSite'), colorVar: 'var(--brand-500)', kind: 'site' }] : []}
                />
              </div>
            </div>
          )}

          {step === 'airports' && (
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 text-sm text-fg-2">
                <Sparkles className="size-4 text-brand-500" aria-hidden="true" />
                {t('onboarding.airports.suggested')}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {suggestions.map((a) => {
                  const checked = picked[a.iata] ?? a === suggestions[0];
                  return (
                    <li key={a.iata} className="flex items-center gap-3 px-4 py-3">
                      <Checkbox id={`ap-${a.iata}`} checked={checked} onCheckedChange={(v) => setPicked((p) => ({ ...p, [a.iata]: v === true }))} />
                      <label htmlFor={`ap-${a.iata}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-sm font-bold">
                          {a.iata} · {name(a)}
                        </span>
                        <span className="tabular block text-xs text-fg-2">
                          {name({ name: a.city, name_ar: a.city_ar })} · {t('units.km', { value: formatNumber(a.roadKm, 0) })} · {t('units.minutes', { value: a.minutes })}
                        </span>
                      </label>
                      <button
                        type="button"
                        disabled={!checked}
                        onClick={() => setDefaultIata(a.iata)}
                        aria-pressed={effectiveDefault === a.iata}
                        className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold disabled:opacity-40', effectiveDefault === a.iata ? 'text-warning-fg' : 'text-fg-3 hover:text-fg')}
                      >
                        <Star className={cn('size-3.5', effectiveDefault === a.iata && 'fill-current')} aria-hidden="true" />
                        {t('sites.defaultAirport')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {step === 'invite' && (
            <div className="space-y-3">
              {invites.map((invite, i) => (
                <div key={i} className="flex flex-wrap items-start gap-2">
                  <div className="min-w-56 flex-1 space-y-1">
                    <Input
                      type="email"
                      dir="ltr"
                      placeholder="name@company.com"
                      aria-label={t('auth.email')}
                      value={invite.email}
                      aria-invalid={Boolean(inviteErrors[i])}
                      onChange={(e) => setInvites((list) => list.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                    />
                    <FieldError message={inviteErrors[i]} />
                  </div>
                  <Select value={invite.role} onValueChange={(v) => setInvites((list) => list.map((x, j) => (j === i ? { ...x, role: v as Role } : x)))}>
                    <SelectTrigger className="w-40" aria-label={t('settings.users.role')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['admin', 'dispatcher', 'driver', 'viewer'] as const).map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(`roles.${r}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setInvites((list) => list.filter((_, j) => j !== i))} aria-label={t('common.remove')}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setInvites((list) => [...list, { email: '', role: 'driver' }])}>
                <Plus aria-hidden="true" />
                {t('onboarding.invite.add')}
              </Button>
            </div>
          )}
        </section>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(STEPS[index - 1] ?? step)} disabled={index === 0}>
            <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
            {t('common.back')}
          </Button>
          <Button onClick={() => void next()}>
            {step === 'invite' ? t('onboarding.finish') : t('common.next')}
            <ArrowRight className="rtl:-scale-x-100" aria-hidden="true" />
          </Button>
        </div>
      </main>
    </div>
  );
}
