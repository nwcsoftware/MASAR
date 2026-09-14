import { QueryClient } from '@tanstack/react-query';

/**
 * Shared query client. Realtime invalidates keys, so we do not poll;
 * query keys follow ['tasks', companyId, filters] (CLAUDE.md conventions).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
