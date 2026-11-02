import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Building2, Car, Eye, KeyRound, Mail, MailCheck, Radio, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { magicLinkSchema, signInSchema, type MagicLinkValues, type SignInValues } from '@/features/auth/schema';
import { useSessionApi, type DemoRole } from '@/features/auth/session';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/(auth)/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
});

function FieldError({ message }: { message?: string }) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-semibold text-danger">
      {t(message)}
    </p>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const { signInWithPassword } = useSessionApi();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        setServerError(null);
        try {
          await signInWithPassword(values.email, values.password);
        } catch (error) {
          setServerError(error instanceof Error ? error.message : t('errors.generic'));
        }
      })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input id="email" type="email" autoComplete="email" dir="ltr" aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t('auth.password')}</Label>
        <Input id="password" type="password" autoComplete="current-password" dir="ltr" aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      {serverError && (
        <p role="alert" className="tint-12 rounded-md px-3 py-2 text-sm font-semibold text-danger [--tint-color:var(--danger)]">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t('common.loading') : t('auth.signIn')}
      </Button>
    </form>
  );
}

function MagicLinkForm() {
  const { t } = useTranslation();
  const { signInWithMagicLink } = useSessionApi();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<MagicLinkValues>({ resolver: zodResolver(magicLinkSchema), defaultValues: { email: '' } });

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 text-center">
        <MailCheck className="size-8 text-success-fg" aria-hidden="true" />
        <p className="font-bold">{t('auth.magicSentTitle')}</p>
        <p className="text-sm text-fg-2">{t('auth.magicSentBody', { email: sentTo })}</p>
        <Button variant="link" onClick={() => setSentTo(null)}>
          {t('auth.useDifferentEmail')}
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        setServerError(null);
        try {
          await signInWithMagicLink(values.email);
          setSentTo(values.email);
        } catch (error) {
          setServerError(error instanceof Error ? error.message : t('errors.generic'));
        }
      })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="magic-email">{t('auth.email')}</Label>
        <Input id="magic-email" type="email" autoComplete="email" dir="ltr" aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      {serverError && (
        <p role="alert" className="tint-12 rounded-md px-3 py-2 text-sm font-semibold text-danger [--tint-color:var(--danger)]">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        <Mail aria-hidden="true" />
        {t('auth.sendMagicLink')}
      </Button>
    </form>
  );
}

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, 'auth.errors.nameRequired'),
});
type SignUpValues = z.infer<typeof signUpSchema>;

/** FR-01 — an owner creates an account, then onboarding creates the company. */
function SignUpForm() {
  const { t, i18n } = useTranslation();
  const { signUp } = useSessionApi();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema), defaultValues: { fullName: '', email: '', password: '' } });
  const errors = form.formState.errors;

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 text-center">
        <MailCheck className="size-8 text-success-fg" aria-hidden="true" />
        <p className="font-bold">{t('auth.confirmTitle')}</p>
        <p className="text-sm text-fg-2">{t('auth.confirmBody', { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        setServerError(null);
        try {
          const { needsConfirmation } = await signUp({
            email: values.email,
            password: values.password,
            fullName: values.fullName,
            language: i18n.language.startsWith('ar') ? 'ar' : 'en',
          });
          if (needsConfirmation) setSentTo(values.email);
        } catch (error) {
          setServerError(error instanceof Error ? error.message : t('errors.generic'));
        }
      })}
    >
      <div className="space-y-1.5">
        <Label htmlFor="su-name">{t('invite.fullName')}</Label>
        <Input id="su-name" autoComplete="name" aria-invalid={Boolean(errors.fullName)} {...form.register('fullName')} />
        <FieldError message={errors.fullName?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">{t('auth.email')}</Label>
        <Input id="su-email" type="email" autoComplete="email" dir="ltr" aria-invalid={Boolean(errors.email)} {...form.register('email')} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-password">{t('auth.password')}</Label>
        <Input id="su-password" type="password" autoComplete="new-password" dir="ltr" aria-invalid={Boolean(errors.password)} {...form.register('password')} />
        <FieldError message={errors.password?.message} />
      </div>
      {serverError && (
        <p role="alert" className="tint-12 rounded-md px-3 py-2 text-sm font-semibold text-danger [--tint-color:var(--danger)]">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t('common.loading') : t('auth.createAccount')}
      </Button>
      <p className="text-center text-xs text-fg-3">{t('auth.signUpHint')}</p>
    </form>
  );
}

const DEMO_ROLES: { role: DemoRole; icon: typeof UserRound }[] = [
  { role: 'owner', icon: Building2 },
  { role: 'dispatcher', icon: Radio },
  { role: 'driver', icon: Car },
  { role: 'viewer', icon: Eye },
];

/** Demo mode: no Supabase keys yet — pick a seeded persona. The (auth) guard redirects once signed in. */
function DemoPicker() {
  const { t } = useTranslation();
  const { signInDemo } = useSessionApi();

  return (
    <div className="space-y-4">
      <div className="tint-12 rounded-md px-3 py-2.5 text-sm text-fg-2 [--tint-color:var(--warning)]">
        <p className="font-bold text-fg">{t('demo.title')}</p>
        <p>{t('demo.body')}</p>
      </div>
      <div className="grid gap-2" role="list">
        {DEMO_ROLES.map(({ role, icon: Icon }) => (
          <button
            key={role}
            type="button"
            role="listitem"
            onClick={() => signInDemo(role)}
            className={cn(
              'group flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-start shadow-xs transition-colors hover:border-brand-400',
            )}
          >
            <span className="grid size-10 place-items-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900 dark:text-brand-200">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-fg">{t(`demo.roles.${role}.title`)}</span>
              <span className="block text-xs text-fg-2">{t(`demo.roles.${role}.body`)}</span>
            </span>
            <ArrowRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function LoginPage() {
  const { t } = useTranslation();
  const { isSupabase } = useSessionApi();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('auth.welcome')}</h1>
        <p className="text-sm text-fg-2">{isSupabase ? t('auth.subtitle') : t('demo.subtitle')}</p>
      </div>

      {isSupabase ? (
        <Tabs defaultValue="password">
          <TabsList className="w-full">
            <TabsTrigger value="password" className="flex-1">
              <KeyRound className="size-4" aria-hidden="true" />
              {t('auth.password')}
            </TabsTrigger>
            <TabsTrigger value="magic" className="flex-1">
              <Mail className="size-4" aria-hidden="true" />
              {t('auth.magicLink')}
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              <Building2 className="size-4" aria-hidden="true" />
              {t('auth.newCompany')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="password">
            <PasswordForm />
          </TabsContent>
          <TabsContent value="magic">
            <MagicLinkForm />
          </TabsContent>
          <TabsContent value="signup">
            <SignUpForm />
          </TabsContent>
        </Tabs>
      ) : (
        <DemoPicker />
      )}

      <p className="text-center text-xs text-fg-3">{t('auth.inviteOnly')}</p>
    </div>
  );
}
