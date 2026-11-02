import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptInviteSchema, type AcceptInviteValues } from '@/features/auth/schema';
import { useSessionApi } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/(auth)/accept-invite')({
  validateSearch: (search: Record<string, unknown>): { email?: string; company?: string } => ({
    email: typeof search.email === 'string' ? search.email : undefined,
    company: typeof search.company === 'string' ? search.company : undefined,
  }),
  component: AcceptInvitePage,
});

/**
 * Screen 1b — invite accept (FR-04). Supabase's invite email signs the user
 * in via the link; this page lets them set a name + password. Sending
 * invites from Settings → Users lands in Phase 1.
 */
function AcceptInvitePage() {
  const { t } = useTranslation();
  const { email, company } = Route.useSearch();
  const { isSupabase } = useSessionApi();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { fullName: '', password: '', confirm: '' },
  });
  const errors = form.formState.errors;

  if (done) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <MailCheck className="size-10 text-success-fg" aria-hidden="true" />
        <h1 className="text-xl font-extrabold">{t('invite.doneTitle')}</h1>
        <Button asChild>
          <Link to="/">{t('common.continue')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('invite.title')}</h1>
        <p className="text-sm text-fg-2">{t('invite.subtitle', { company: company ?? t('common.appName') })}</p>
      </div>
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          setServerError(null);
          if (!supabase) {
            setDone(true);
            return;
          }
          const { error } = await supabase.auth.updateUser({ password: values.password, data: { full_name: values.fullName } });
          if (error) setServerError(error.message);
          else setDone(true);
        })}
      >
        {email && (
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">{t('auth.email')}</Label>
            <Input id="invite-email" value={email} readOnly disabled dir="ltr" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="fullName">{t('invite.fullName')}</Label>
          <Input id="fullName" autoComplete="name" aria-invalid={Boolean(errors.fullName)} {...form.register('fullName')} />
          {errors.fullName?.message && <p className="text-xs font-semibold text-danger">{t(errors.fullName.message)}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">{t('auth.password')}</Label>
          <Input id="new-password" type="password" autoComplete="new-password" dir="ltr" aria-invalid={Boolean(errors.password)} {...form.register('password')} />
          {errors.password?.message && <p className="text-xs font-semibold text-danger">{t(errors.password.message)}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t('invite.confirm')}</Label>
          <Input id="confirm" type="password" autoComplete="new-password" dir="ltr" aria-invalid={Boolean(errors.confirm)} {...form.register('confirm')} />
          {errors.confirm?.message && <p className="text-xs font-semibold text-danger">{t(errors.confirm.message)}</p>}
        </div>
        {serverError && <p role="alert" className="text-sm font-semibold text-danger">{serverError}</p>}
        {!isSupabase && <p className="text-xs text-fg-3">{t('demo.inviteNote')}</p>}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {t('invite.submit')}
        </Button>
      </form>
    </div>
  );
}
