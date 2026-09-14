import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/')({
  component: ScaffoldCheck,
});

const CATEGORIES = ['routine', 'airport', 'delivery', 'escort'] as const;
const STATUSES = [
  'draft',
  'scheduled',
  'assigned',
  'acknowledged',
  'en-route',
  'in-progress',
  'delayed',
  'completed',
  'cancelled',
  'no-show',
] as const;

const STATUS_KEY: Record<(typeof STATUSES)[number], string> = {
  draft: 'draft',
  scheduled: 'scheduled',
  assigned: 'assigned',
  acknowledged: 'acknowledged',
  'en-route': 'en_route',
  'in-progress': 'in_progress',
  delayed: 'delayed',
  completed: 'completed',
  cancelled: 'cancelled',
  'no-show': 'no_show',
};

/**
 * Phase 0 scaffold check — proves tokens → Tailwind, dark mode and RTL are
 * wired end to end. Replaced by the AppShell + dashboard in Phase 0 item 3.
 */
function ScaffoldCheck() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex h-topbar items-center justify-between border-b border-border bg-surface px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-brand-500">{t('common.appName')}</span>
          <span className="text-sm text-fg-3">{t('common.tagline')}</span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid max-w-content gap-6 p-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('tasks.title')}</CardTitle>
            <CardDescription>
              {t('tasks.count', { count: CATEGORIES.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {CATEGORIES.map((category) => (
              <div key={category} className={`cat-tint cat-${category} rounded-md p-3 ps-4`}>
                <div className="text-sm font-semibold text-fg">
                  {t(`tasks.category.${category}`)}
                </div>
                <div className="text-xs text-fg-3">cat-{category}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('common.theme')} · RTL</CardTitle>
            <CardDescription>
              tokens.css → tailwind.config.ts (docs/DESIGN.md §3)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-2"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: `var(--status-${status})` }}
                  aria-hidden="true"
                />
                {t(`tasks.status.${STATUS_KEY[status]}`)}
              </span>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
