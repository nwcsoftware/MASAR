import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Building2, LogOut, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { requireNoCompanyUser } from '@/features/auth/guards';
import { useCurrentUser, useSessionApi } from '@/features/auth/session';
import { isolate } from '@/lib/format';

export const Route = createFileRoute('/no-company')({
  beforeLoad: ({ context, location }) => {
    requireNoCompanyUser(context.session, location);
  },
  component: NoCompanyPage,
});

/**
 * 0008: only the platform super admin creates companies, so an account that
 * is not attached to one waits here until an owner invite or a passenger
 * registration attaches it.
 */
function NoCompanyPage() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { refresh, signOut } = useSessionApi();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-topbar items-center justify-between border-b border-border bg-surface px-4 lg:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <LanguageToggle compact />
          <ThemeToggle compact />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-10 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900 dark:text-brand-200">
          <Building2 className="size-7" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">{t('noCompany.title')}</h1>
          <p className="text-sm text-fg-2">{t('noCompany.body', { email: isolate(user.email ?? user.profile.email ?? '') })}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => void refresh().then(() => navigate({ to: '/' }))}>
            <RefreshCw aria-hidden="true" />
            {t('noCompany.check')}
          </Button>
          <Button variant="ghost" onClick={() => void signOut().then(() => navigate({ to: '/login' }))}>
            <LogOut className="rtl:-scale-x-100" aria-hidden="true" />
            {t('auth.signOut')}
          </Button>
        </div>
        <p className="text-sm">
          <Link to="/register" className="font-semibold text-brand-500 hover:underline">
            {t('passenger.register.link')}
          </Link>
        </p>
      </main>
    </div>
  );
}
