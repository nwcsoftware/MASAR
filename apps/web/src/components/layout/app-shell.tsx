import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { TaskSheetContext } from '@/components/layout/task-sheet-context';
import { TaskWizardContext, type WizardRequest } from '@/components/layout/task-wizard-context';
import { SosAlerts } from '@/components/layout/sos-alerts';
import { OfflineBanner } from '@/components/offline-banner';
import { TaskDetailSheet } from '@/components/task-detail-sheet';
import { TaskWizard } from '@/components/task-wizard/task-wizard';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useScopedSiteIds } from '@/features/sites/site-scope';
import { useCompliance } from '@/features/documents/use-compliance';
import { useTripRequests } from '@/features/passenger/queries';
import { useTasks } from '@/features/tasks/queries';
import { at } from '@/mocks/fixtures';

const COLLAPSE_KEY = 'masar.sidebarCollapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Today's open conflict count for the Calendar nav badge. */
function useConflictCount() {
  const siteIds = useScopedSiteIds();
  const tasks = useTasks({ from: at(0, '00:00'), to: at(1, '00:00'), siteIds });
  return (tasks.data ?? []).reduce((sum, task) => sum + (task.conflicts.some((c) => c.severity !== 'info') ? 1 : 0), 0);
}

/**
 * docs/DESIGN.md §4.1 dispatcher/admin shell. Sidebar on the inline-start
 * side (right in RTL), slide-overs from inline-end; below lg the sidebar is
 * a drawer.
 */
export function AppShell({
  children,
  taskId,
  onTaskChange,
}: {
  children: ReactNode;
  taskId: string | undefined;
  onTaskChange: (taskId: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizard, setWizard] = useState<WizardRequest | null>(null);
  const conflictCount = useConflictCount();
  const documentCount = useCompliance().items.filter((i) => i.status === 'expired' || i.status === 'missing').length;
  const requestCount = (useTripRequests().data ?? []).filter((r) => r.status === 'pending').length;

  const toggle = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        /* storage blocked */
      }
      return !value;
    });
  };

  return (
    <TaskSheetContext.Provider value={onTaskChange}>
      <TaskWizardContext.Provider value={(request) => setWizard(request ?? {})}>
      <div className="flex h-dvh overflow-hidden bg-bg">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-brand-500 px-3 py-2 text-fg-on-brand focus:not-sr-only focus:absolute focus:start-3 focus:top-3"
        >
          {t('nav.skip')}
        </a>
        <div className="hidden shrink-0 lg:block">
          <Sidebar collapsed={collapsed} onToggle={toggle} conflictCount={conflictCount} documentCount={documentCount} requestCount={requestCount} />
        </div>
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="start" className="w-auto p-0" hideClose>
            <SheetTitle className="sr-only">{t('nav.main')}</SheetTitle>
            <Sidebar collapsed={false} conflictCount={conflictCount} documentCount={documentCount} requestCount={requestCount} onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setDrawerOpen(true)} onNewTask={() => setWizard({})} onOpenTask={onTaskChange} />
          <OfflineBanner />
          <SosAlerts />
          <main id="main" className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      <TaskDetailSheet taskId={taskId} onClose={() => onTaskChange(undefined)} />
      <TaskWizard request={wizard} onClose={() => setWizard(null)} onSaved={onTaskChange} />
      </TaskWizardContext.Provider>
    </TaskSheetContext.Provider>
  );
}
