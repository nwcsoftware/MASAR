import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Check, LogOut, MailPlus, Plus, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Field, FormError, NativeSelect } from '@/components/form';
import { LanguageToggle } from '@/components/language-toggle';
import { Logo } from '@/components/logo';
import { Page, Panel } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { requirePlatformAdmin } from '@/features/auth/guards';
import { useCurrentUser, useSessionApi } from '@/features/auth/session';
import { useCreatePlatformCompany, useInviteOwner, usePlatformCompanies, type PlatformCompany } from '@/features/platform/queries';
import { newCompanySchema, ownerInviteSchema, type NewCompanyValues, type OwnerInviteValues } from '@/features/platform/schema';
import { formatDate, isolate } from '@/lib/format';
import { useLocalizedName } from '@/lib/i18n-data';

export const Route = createFileRoute('/platform')({
  beforeLoad: ({ context, location }) => {
    requirePlatformAdmin(context.session, location);
  },
  component: PlatformPage,
});

const NEW_COMPANY_DEFAULTS: NewCompanyValues = {
  name: '',
  name_ar: '',
  country_code: 'SA',
  timezone: 'Asia/Riyadh',
  default_language: 'en',
  owner_name: '',
  owner_email: '',
};

/** FR-01 (0008) — create a company and invite its owner. */
function NewCompanySheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (message: string) => void }) {
  const { t } = useTranslation();
  const create = useCreatePlatformCompany();
  const form = useForm<NewCompanyValues>({ resolver: zodResolver(newCompanySchema), defaultValues: NEW_COMPANY_DEFAULTS });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!open) return;
    form.reset(NEW_COMPANY_DEFAULTS);
    create.reset();
    // reset whenever the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t('platform.new.title')}</SheetTitle>
          <SheetDescription>{t('platform.new.body')}</SheetDescription>
        </SheetHeader>
        <form
          id="new-company-form"
          noValidate
          className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5"
          onSubmit={form.handleSubmit((values) =>
            create.mutate(values, {
              onSuccess: ({ company, invite }) => {
                onCreated(
                  t(invite.existing ? 'platform.created.attached' : 'platform.created.invited', {
                    company: isolate(company.name),
                    email: isolate(values.owner_email),
                  }),
                );
                onOpenChange(false);
              },
            }),
          )}
        >
          <section className="grid gap-4 sm:grid-cols-2">
            <h3 className="eyebrow sm:col-span-2">{t('platform.new.company')}</h3>
            <Field id="pc-name" label={t('settings.company.name')} error={errors.name?.message}>
              <Input id="pc-name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
            </Field>
            <Field id="pc-name-ar" label={t('settings.company.nameAr')}>
              <Input id="pc-name-ar" dir="rtl" {...form.register('name_ar')} />
            </Field>
            <Field id="pc-country" label={t('settings.company.country')} error={errors.country_code?.message}>
              <Input id="pc-country" dir="ltr" maxLength={2} className="uppercase" aria-invalid={Boolean(errors.country_code)} {...form.register('country_code')} />
            </Field>
            <Field id="pc-tz" label={t('settings.company.timezone')} error={errors.timezone?.message}>
              <Input id="pc-tz" dir="ltr" aria-invalid={Boolean(errors.timezone)} {...form.register('timezone')} />
            </Field>
            <Field id="pc-lang" label={t('settings.company.language')}>
              <NativeSelect id="pc-lang" {...form.register('default_language')}>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </NativeSelect>
            </Field>
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-0.5 sm:col-span-2">
              <h3 className="eyebrow">{t('platform.new.owner')}</h3>
              <p className="text-xs text-fg-3">{t('platform.new.ownerHint')}</p>
            </div>
            <Field id="pc-owner-name" label={t('invite.fullName')} error={errors.owner_name?.message}>
              <Input id="pc-owner-name" autoComplete="off" aria-invalid={Boolean(errors.owner_name)} {...form.register('owner_name')} />
            </Field>
            <Field id="pc-owner-email" label={t('auth.email')} error={errors.owner_email?.message}>
              <Input id="pc-owner-email" type="email" dir="ltr" autoComplete="off" aria-invalid={Boolean(errors.owner_email)} {...form.register('owner_email')} />
            </Field>
          </section>
          <FormError error={create.error} />
        </form>
        <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="new-company-form" disabled={create.isPending}>
            {create.isPending ? t('common.saving') : t('platform.new.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Invite the owner of a company that has none (e.g. the first invite failed). */
function InviteOwnerSheet({ company, onOpenChange, onInvited }: { company: PlatformCompany | null; onOpenChange: (open: boolean) => void; onInvited: (message: string) => void }) {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const invite = useInviteOwner();
  const form = useForm<OwnerInviteValues>({ resolver: zodResolver(ownerInviteSchema), defaultValues: { owner_name: '', owner_email: '' } });
  const errors = form.formState.errors;

  useEffect(() => {
    if (!company) return;
    form.reset({ owner_name: '', owner_email: '' });
    invite.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  return (
    <Sheet open={Boolean(company)} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t('platform.invite.title')}</SheetTitle>
          <SheetDescription>{company ? t('platform.invite.body', { company: isolate(name(company)) }) : null}</SheetDescription>
        </SheetHeader>
        <form
          id="invite-owner-form"
          noValidate
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          onSubmit={form.handleSubmit((values) => {
            if (!company) return;
            invite.mutate(
              { companyId: company.id, language: company.default_language, values },
              {
                onSuccess: (result) => {
                  onInvited(
                    t(result.existing ? 'platform.created.attached' : 'platform.created.invited', {
                      company: isolate(company.name),
                      email: isolate(values.owner_email),
                    }),
                  );
                  onOpenChange(false);
                },
              },
            );
          })}
        >
          <Field id="io-name" label={t('invite.fullName')} error={errors.owner_name?.message}>
            <Input id="io-name" autoComplete="off" aria-invalid={Boolean(errors.owner_name)} {...form.register('owner_name')} />
          </Field>
          <Field id="io-email" label={t('auth.email')} error={errors.owner_email?.message}>
            <Input id="io-email" type="email" dir="ltr" autoComplete="off" aria-invalid={Boolean(errors.owner_email)} {...form.register('owner_email')} />
          </Field>
          <FormError error={invite.error} />
        </form>
        <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="invite-owner-form" disabled={invite.isPending}>
            {invite.isPending ? t('common.saving') : t('platform.invite.submit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function OwnerCell({ company, onInvite }: { company: PlatformCompany; onInvite: () => void }) {
  const { t } = useTranslation();
  if (!company.owner_id) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">{t('platform.owner.none')}</Badge>
        <Button size="sm" variant="outline" onClick={onInvite}>
          <MailPlus aria-hidden="true" />
          {t('platform.invite.title')}
        </Button>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="truncate text-sm font-semibold">{company.owner_name}</span>
        {company.owner_pending ? <Badge variant="warning">{t('platform.owner.pending')}</Badge> : <Badge variant="success">{t('platform.owner.active')}</Badge>}
      </span>
      <span className="block truncate text-xs text-fg-2" dir="ltr">
        {company.owner_email}
      </span>
    </div>
  );
}

/** Platform console (0008): every company, its owner and size — never its tasks or people. */
function PlatformPage() {
  const { t } = useTranslation();
  const name = useLocalizedName();
  const user = useCurrentUser();
  const { signOut } = useSessionApi();
  const navigate = useNavigate();
  const companies = usePlatformCompanies();
  const [newOpen, setNewOpen] = useState(false);
  const [inviteFor, setInviteFor] = useState<PlatformCompany | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex h-topbar items-center justify-between gap-2 border-b border-border bg-surface px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <Badge variant="brand">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {t('platform.badge')}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden truncate text-sm text-fg-2 sm:inline">{name(user.profile, 'full_name')}</span>
          <LanguageToggle compact />
          <ThemeToggle compact />
          <Button variant="ghost" size="sm" onClick={() => void signOut().then(() => navigate({ to: '/login' }))}>
            <LogOut className="rtl:-scale-x-100" aria-hidden="true" />
            <span className="hidden sm:inline">{t('auth.signOut')}</span>
          </Button>
        </div>
      </header>

      <NewCompanySheet open={newOpen} onOpenChange={setNewOpen} onCreated={setNotice} />
      <InviteOwnerSheet company={inviteFor} onOpenChange={(open) => !open && setInviteFor(null)} onInvited={setNotice} />

      <Page className="max-w-5xl">
        <PageHeader
          title={t('platform.title')}
          description={t('platform.subtitle')}
          actions={
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus aria-hidden="true" />
              {t('platform.new.title')}
            </Button>
          }
        />

        {notice && (
          <p role="status" className="tint-12 flex items-start gap-2 rounded-md px-3 py-2 text-sm font-semibold text-success-fg [--tint-color:var(--success)]">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        )}

        <Panel title={companies.data ? t('platform.count', { count: companies.data.length }) : t('platform.title')}>
          {companies.isError ? (
            <ErrorState error={companies.error} onRetry={() => void companies.refetch()} />
          ) : companies.isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !companies.data.length ? (
            <EmptyState
              icon={Building2}
              title={t('platform.empty')}
              body={t('platform.emptyBody')}
              action={
                <Button size="sm" onClick={() => setNewOpen(true)}>
                  <Plus aria-hidden="true" />
                  {t('platform.new.title')}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {companies.data.map((c) => (
                <li key={c.id} className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900 dark:text-brand-200">
                      <Building2 className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{name(c)}</span>
                      <span className="block truncate text-xs text-fg-2">
                        {[c.country_code, c.timezone, t('platform.since', { date: formatDate(c.created_at) })].join(' · ')}
                      </span>
                    </span>
                  </div>
                  <OwnerCell company={c} onInvite={() => setInviteFor(c)} />
                  <div className="tabular flex gap-4 text-xs text-fg-2 sm:justify-end">
                    <span>{t('platform.sites', { count: c.site_count })}</span>
                    <span>{t('platform.users', { count: c.user_count })}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <p className="text-xs text-fg-3">{t('platform.privacy')}</p>
      </Page>
    </div>
  );
}
