import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Plane, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { redirectIfSignedIn } from '@/features/auth/guards';

export const Route = createFileRoute('/(auth)')({
  beforeLoad: ({ context, search, location }) => {
    // Supabase's invite link signs the user in before they set a password.
    if (location.pathname === '/accept-invite') return;
    const target = (search as { redirect?: unknown }).redirect;
    redirectIfSignedIn(context.session, typeof target === 'string' ? target : undefined);
  },
  component: AuthLayout,
});

/** Screen 1 — split layout: brand panel with map illustration + form (docs/DESIGN.md §6). */
function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900 p-10 text-fg-on-brand lg:flex lg:flex-col">
        <svg className="absolute inset-0 size-full opacity-25" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d="M-20 120 C80 90 140 180 240 150 S380 80 440 110" strokeWidth="10" opacity=".35" />
            <path d="M60 -20 C90 140 40 260 110 620" strokeWidth="10" opacity=".35" />
            <path d="M300 -20 C280 160 380 260 320 620" strokeWidth="10" opacity=".35" />
            <path d="M-20 400 C120 380 240 440 440 390" strokeWidth="10" opacity=".35" />
            <path d="M90 430 C150 330 220 260 300 170" strokeWidth="4" strokeDasharray="10 10" />
          </g>
          <g fill="currentColor">
            <circle cx="90" cy="430" r="9" />
            <circle cx="300" cy="170" r="13" />
          </g>
        </svg>
        <div className="relative">
          <span className="inline-flex rounded-lg bg-surface px-3 py-2">
            <Logo />
          </span>
        </div>
        <div className="relative mt-auto max-w-md space-y-6">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">{t('auth.brandTitle')}</h2>
          <ul className="space-y-3 text-sm text-brand-100">
            <li className="flex gap-3">
              <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
              {t('auth.brandPoint1')}
            </li>
            <li className="flex gap-3">
              <Plane className="size-5 shrink-0" aria-hidden="true" />
              {t('auth.brandPoint2')}
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
              {t('auth.brandPoint3')}
            </li>
          </ul>
        </div>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="lg:invisible">
            <Logo />
          </span>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle compact />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
