import type { ReactNode } from 'react';
import { SharingContext, useLocationReporting } from '@/features/drivers/location';
import { useMyTasks } from '@/features/tasks/driver';
import { ACTIVE_STATUSES } from '@/lib/task-meta';

/** Wraps the driver app: reports the position while one of today's trips is under way (FR-33). */
export function LocationSharingProvider({ children }: { children: ReactNode }) {
  const tasks = useMyTasks(0, 1);
  const active = (tasks.data ?? []).find((x) => ACTIVE_STATUSES.includes(x.status));
  const taskId = active?.id ?? null;
  const sharing = useLocationReporting(taskId);
  return <SharingContext.Provider value={{ ...sharing, taskId }}>{children}</SharingContext.Provider>;
}
