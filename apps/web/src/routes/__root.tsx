import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-bold text-fg">{t('errors.notFound')}</h1>
      <p className="text-fg-2">{t('errors.notFoundBody')}</p>
    </div>
  );
}

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});
