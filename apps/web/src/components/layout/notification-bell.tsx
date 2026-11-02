import { Bell, BellOff, CircleAlert, Clock, Plane, TriangleAlert, UserRoundCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { useMarkNotificationsRead, useNotifications } from '@/features/notifications/queries';
import type { Notification } from '@/mocks/fixtures';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const ICONS: Partial<Record<Notification['type'], typeof Bell>> = {
  task_delayed: Clock,
  conflict_detected: CircleAlert,
  driver_not_acknowledged: TriangleAlert,
  airport_share_hint: Plane,
  task_completed: UserRoundCheck,
};

/**
 * docs/DESIGN.md §5 NotificationBell + NotificationPanel. Titles are
 * localised by type (FR-25); the DB title is the task title. Realtime
 * toasts and inline Acknowledge/Decline actions land in Phase 3.
 */
export function NotificationBell({ onOpenTask, className }: { onOpenTask?: (taskId: string) => void; className?: string }) {
  const { t } = useTranslation();
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
  const items = query.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn('relative size-9 text-fg-2', className)}
          aria-label={unread ? t('notifications.unread', { count: unread }) : t('notifications.title')}
        >
          <Bell aria-hidden="true" />
          {unread > 0 && <span className="absolute end-1.5 top-1.5 size-2 rounded-full border-2 border-surface bg-danger" aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-bold">{t('notifications.title')}</p>
          {unread > 0 && (
            <button type="button" className="text-xs font-semibold text-brand-500 hover:underline" onClick={() => markRead.mutate('all')}>
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto" aria-live="polite">
          {query.isPending ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : !items.length ? (
            <EmptyState compact icon={BellOff} title={t('notifications.empty')} />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn('flex w-full gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-2', !n.read_at && 'bg-[color-mix(in_srgb,var(--brand-500)_5%,transparent)]')}
                      onClick={() => {
                        markRead.mutate([n.id]);
                        if (n.task_id) onOpenTask?.(n.task_id);
                      }}
                    >
                      <Icon className={cn('mt-0.5 size-4 shrink-0', n.type === 'conflict_detected' ? 'text-danger' : n.type === 'task_delayed' || n.type === 'driver_not_acknowledged' ? 'text-warning-fg' : 'text-brand-500')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-fg">{t(`notifications.types.${n.type}`)}</span>
                        <span className="block truncate text-xs text-fg-2">{n.body ?? n.title}</span>
                      </span>
                      <span className="tabular shrink-0 text-[11px] text-fg-3">{formatRelative(n.created_at)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
