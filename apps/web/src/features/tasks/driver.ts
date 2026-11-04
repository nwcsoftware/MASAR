import { useCurrentUser } from '@/features/auth/session';
import { at } from '@/mocks/fixtures';
import { useTasks } from './queries';

/** The signed-in driver's tasks between today + `fromDay` and today + `toDay` (RLS: assigned only). */
export function useMyTasks(fromDay = 0, toDay = 1) {
  const { driverId } = useCurrentUser();
  return useTasks({ from: at(fromDay, '00:00'), to: at(toDay, '00:00'), driverId: driverId ?? '__none__' });
}
