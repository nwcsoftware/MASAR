import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Button } from '@/components/ui/button';
import type { RouterContext } from '@/features/auth/guards';

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <EmptyState
        icon={Compass}
        title={t('errors.notFound')}
        body={t('errors.notFoundBody')}
        action={
          <Button asChild variant="outline">
            <Link to="/">{t('common.goHome')}</Link>
          </Button>
        }
      />
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <ErrorState error={error} onRetry={reset} />
    </div>
  ),
});
