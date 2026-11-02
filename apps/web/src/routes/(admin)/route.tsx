import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/app-shell';
import { requireConsoleUser } from '@/features/auth/guards';
import { SiteScopeProvider } from '@/features/sites/site-scope';

/** (admin) group — owner, admin, dispatcher, viewer. `?task=<id>` opens the task slide-over on any page. */
export const Route = createFileRoute('/(admin)')({
  validateSearch: (search: Record<string, unknown>): { task?: string } => ({
    task: typeof search.task === 'string' ? search.task : undefined,
  }),
  beforeLoad: ({ context, location }) => {
    requireConsoleUser(context.session, location);
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { task } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <SiteScopeProvider>
      <AppShell
        taskId={task}
        onTaskChange={(taskId) => void navigate({ to: '.', search: (prev) => ({ ...prev, task: taskId }) })}
      >
        <Outlet />
      </AppShell>
    </SiteScopeProvider>
  );
}
