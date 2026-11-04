import { Link } from '@tanstack/react-router';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  ChartColumn,
  Contact,
  FileBadge,
  Star,
  LayoutDashboard,
  ListTodo,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/logo';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SiteSwitcher } from '@/components/layout/site-switcher';
import { UserMenu } from '@/components/layout/user-menu';
import { useCurrentUser } from '@/features/auth/session';
import { isAdmin } from '@/features/auth/guards';
import { cn } from '@/lib/utils';

type NavTo = '/dashboard' | '/calendar' | '/map' | '/tasks' | '/requests' | '/drivers' | '/documents' | '/staff' | '/ratings' | '/sites' | '/reports' | '/settings';

const NAV: { to: NavTo; icon: LucideIcon; key: string; adminOnly?: boolean; badge?: 'conflicts' | 'documents' | 'requests' }[] = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
  { to: '/calendar', icon: CalendarDays, key: 'nav.calendar', badge: 'conflicts' },
  { to: '/map', icon: MapPin, key: 'nav.liveMap' },
  { to: '/tasks', icon: ListTodo, key: 'nav.tasks' },
  { to: '/requests', icon: ClipboardList, key: 'nav.requests', badge: 'requests' },
  { to: '/drivers', icon: UsersRound, key: 'nav.drivers' },
  { to: '/documents', icon: FileBadge, key: 'nav.documents', badge: 'documents' },
  { to: '/staff', icon: Contact, key: 'nav.staff' },
  { to: '/ratings', icon: Star, key: 'nav.ratings', adminOnly: true },
  { to: '/sites', icon: Building2, key: 'nav.sites' },
  { to: '/reports', icon: ChartColumn, key: 'nav.reports' },
  { to: '/settings', icon: Settings, key: 'nav.settings', adminOnly: true },
];

/** docs/DESIGN.md §4.1 — 256 px, collapses to 72 px; sits on the right in RTL. */
export function Sidebar({
  collapsed,
  onToggle,
  conflictCount,
  documentCount = 0,
  requestCount = 0,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  conflictCount: number;
  /** expired + missing driver documents (0005) */
  documentCount?: number;
  /** pending passenger trip requests (0007) */
  requestCount?: number;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { profile } = useCurrentUser();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <nav
      aria-label={t('nav.main')}
      className={cn(
        'flex h-full flex-col gap-1 border-e border-border bg-surface-2 px-3 py-4 transition-[width] duration-base',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <div className={cn('mb-3 flex items-center justify-between gap-2 px-1', collapsed && 'justify-center')}>
        <Logo collapsed={collapsed} />
        {onToggle && !collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="grid size-8 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg"
            aria-label={t('nav.collapse')}
          >
            <ToggleIcon className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mb-3">
        <SiteSwitcher collapsed={collapsed} />
      </div>

      {NAV.filter((item) => !item.adminOnly || isAdmin(profile.role)).map((item) => {
        const label = t(item.key);
        const count = item.badge === 'conflicts' ? conflictCount : item.badge === 'documents' ? documentCount : item.badge === 'requests' ? requestCount : 0;
        const badge = count > 0 ? count : null;
        const badgeLabel =
          item.badge === 'documents' ? t('documents.needAction', { count }) : item.badge === 'requests' ? t('requests.pendingCount', { count }) : t('conflicts.count', { count });
        const link = (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg',
              collapsed && 'justify-center px-0',
            )}
            activeProps={{ className: '!bg-brand-500 !text-fg-on-brand', 'aria-current': 'page' }}
          >
            {({ isActive }) => (
              <>
                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                {!collapsed && <span className="flex-1 truncate">{label}</span>}
                {badge !== null &&
                  (collapsed ? (
                    <span className="absolute end-2 top-1.5 size-2 rounded-full bg-danger" aria-label={badgeLabel} />
                  ) : (
                    <span
                      className={cn(
                        'tabular rounded-full px-1.5 text-[11px] font-bold leading-[18px]',
                        isActive ? 'bg-[color-mix(in_srgb,var(--text-on-brand)_25%,transparent)] text-fg-on-brand' : 'bg-danger text-fg-on-brand',
                      )}
                      aria-label={badgeLabel}
                    >
                      {badge}
                    </span>
                  ))}
              </>
            )}
          </Link>
        );
        return collapsed ? (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ) : (
          link
        );
      })}

      <div className="mt-auto space-y-1 pt-3">
        {onToggle && collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="mx-auto grid size-9 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg"
            aria-label={t('nav.expand')}
          >
            <ToggleIcon className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </button>
        )}
        <UserMenu collapsed={collapsed} />
      </div>
    </nav>
  );
}
