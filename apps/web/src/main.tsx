import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { DirectionProvider } from '@radix-ui/react-direction';
import { useTranslation } from 'react-i18next';

import '@/lib/i18n';
import { applyThemeToDocument, readStoredTheme } from '@/lib/theme';
import { queryClient } from '@/lib/query-client';
import { registerServiceWorker } from '@/lib/pwa';
import { SessionProvider, useSession } from '@/features/auth/session';
import { ErrorState } from '@/components/error-state';
import { LogoMark } from '@/components/logo';
import { TooltipProvider } from '@/components/ui/tooltip';
import { routeTree } from './routeTree.gen';
import './styles/globals.css';

applyThemeToDocument(readStoredTheme());

const router = createRouter({
  routeTree,
  context: { session: { status: 'loading' } },
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" aria-busy="true">
      <LogoMark className="size-12 animate-pulse" />
    </div>
  );
}

/** Route guards read the session from router context; re-run them when it changes. */
function App() {
  const session = useSession();
  const { i18n } = useTranslation();

  useEffect(() => {
    void router.invalidate();
  }, [session]);

  if (session.status === 'loading') return <Splash />;
  if (session.status === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg p-6">
        <ErrorState error={session.error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <DirectionProvider dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} context={{ session }} />
      </TooltipProvider>
    </DirectionProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);

registerServiceWorker();
