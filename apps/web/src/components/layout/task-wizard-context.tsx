import { createContext, useContext } from 'react';
import type { TaskFormValues, WizardStep } from '@/features/tasks/schema';

/**
 * No taskId = new task (optionally prefilled, e.g. from a passenger's trip
 * request); with taskId = edit, optionally jumping to a step (e.g. 'assign').
 */
export interface WizardRequest {
  taskId?: string;
  step?: WizardStep;
  prefill?: Partial<TaskFormValues>;
  /** called with the new task's id after a successful save */
  onSaved?: (taskId: string) => void;
}

/** Opens the task wizard from anywhere in the console (topbar, task sheet, calendar). */
export const TaskWizardContext = createContext<(request?: WizardRequest) => void>(() => {});

export function useOpenWizard() {
  return useContext(TaskWizardContext);
}
