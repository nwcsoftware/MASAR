import type { DriverAction, TaskCategory } from '@/lib/task-meta';

/** i18n key for the hero button — "arrive" reads differently per category (FR-30). */
export function actionLabelKey(action: DriverAction, category: TaskCategory): string {
  if (action === 'arrive') return `driver.actions.arrive_${category}`;
  return `driver.actions.${action}`;
}
