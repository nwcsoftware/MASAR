import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { db, unwrap, useDualMutation, useLiveData } from '@/lib/data-source';
import { mockDb, mockQuery } from '@/mocks/db';
import type { Notification } from '@/mocks/fixtures';

export const notificationKeys = {
  mine: (userId: string) => ['notifications', userId] as const,
};

/** In-app inbox (FR-24). Realtime INSERTs on notifications invalidate this key (Phase 3). */
export function useNotifications() {
  const { id } = useCurrentUser();
  const live = useLiveData();
  return useQuery({
    queryKey: notificationKeys.mine(id),
    queryFn: async () =>
      live
        ? (unwrap(await db().from('notifications').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(50)) ?? [])
        : mockQuery<Notification[]>(
            () => mockDb.notifications.filter((n) => n.user_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
            [],
          ),
  });
}

export function useMarkNotificationsRead() {
  const { id } = useCurrentUser();
  return useDualMutation<string[] | 'all', void>({
    live: async (ids) => {
      let query = db().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', id).is('read_at', null);
      if (ids !== 'all') query = query.in('id', ids);
      unwrap(await query);
    },
    mock: (ids) => {
      const now = new Date().toISOString();
      mockDb.notifications.forEach((n) => {
        if (n.user_id === id && !n.read_at && (ids === 'all' || ids.includes(n.id))) n.read_at = now;
      });
    },
    invalidate: () => [notificationKeys.mine(id)],
  });
}
