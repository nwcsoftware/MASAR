import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { CalendarDays, Clock, House, UserRound, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';
import { NotificationBell } from '@/components/layout/notification-bell';
import { LogoMark } from '@/components/logo';
import { OfflineBanner } from '@/components/offline-banner';
import { requireDriver } from '@/features/auth/guards';
import { cn } from '@/lib/utils';

/** (driver) group — the installable PWA (docs/DESIGN.md §4.2), drivers only. */
export const Route = createFileRoute('/(driver)')({
  beforeLoad: ({ context, location }) => {
    requireDriver(context.session, location);
  },
  component: DriverShell,
});

const TABS: { to: '/driver' | '/driver/week' | '/driver/hours' | '/driver/me'; icon: LucideIcon; key: string; exact?: boolean }[] = [
  { to: '/driver', icon: House, key: 'driver.tabs.today', exact: true },
  { to: '/driver/week', icon: CalendarDays, key: 'driver.tabs.week' },
  { to: '/driver/hours', icon: Clock, key: 'driver.tabs.hours' },
  { to: '/driver/me', icon: UserRound, key: 'driver.tabs.me' },
];

function DriverShell() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg sm:border-x sm:border-border">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
        <span className="flex items-center gap-2">
          <LogoMark className="size-8" />
          <span className="text-base font-extrabold">{t('common.appName')}</span>
        </span>
        <span className="flex items-center gap-1">
          <LanguageToggle compact />
          <NotificationBell />
        </span>
      </header>
      <OfflineBanner />
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <nav
        aria-label={t('driver.tabs.label')}
        className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-md grid-cols-4 border-t border-border bg-surface px-2 pt-1.5"
      >
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: tab.exact }}
            className="flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-bold text-fg-3"
            activeProps={{ className: '!text-brand-500', 'aria-current': 'page' }}
          >
            {({ isActive }) => (
              <>
                <tab.icon className={cn('size-5', isActive && 'stroke-[2.5]')} aria-hidden="true" />
                {t(tab.key)}
              </>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
