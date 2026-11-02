import { createContext, useContext } from 'react';

/** Opens the task detail slide-over from anywhere in the console (?task=<id>). */
export const TaskSheetContext = createContext<(taskId: string) => void>(() => {});

export function useOpenTask() {
  return useContext(TaskSheetContext);
}
