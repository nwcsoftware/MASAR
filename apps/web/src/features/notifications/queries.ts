import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/session';
import { mockDb, mockQuery } from '@/mocks/db';
import type { Notification } from '@/mocks/fixtures';

export const notificationKeys = {
  mine: (userId: string) => ['notifications', userId] as const,
};

/** In-app inbox (FR-24). Realtime INSERTs on notifications invalidate this key (Phase 3). */
export function useNotifications() {
  const { id } = useCurrentUser();
  return useQuery({
    queryKey: notificationKeys.mine(id),
    queryFn: () =>
      mockQuery<Notification[]>(
        () => mockDb.notifications.filter((n) => n.user_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
        [],
      ),
  });
}

export function useMarkNotificationsRead() {
  const { id } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      const now = new Date().toISOString();
      mockDb.notifications.forEach((n) => {
        if (n.user_id === id && !n.read_at && (ids === 'all' || ids.includes(n.id))) n.read_at = now;
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.mine(id) }),
  });
}
