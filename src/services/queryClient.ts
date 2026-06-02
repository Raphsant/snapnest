import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient singleton.
 * Used by both <QueryClientProvider> in App.tsx and by non-React modules
 * (e.g. uploadManager) that need to invalidate queries.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});
