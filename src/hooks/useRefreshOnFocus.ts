import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Refetch a query when the screen regains navigation focus.
 *
 * React Query's `refetchOnWindowFocus` is off globally (and means nothing in a
 * native app — there is no window). This is the navigation-focus equivalent, and
 * it is deliberately opt-in per screen rather than wired into the global
 * `focusManager`: an app-wide AppState binding would refetch every mounted query
 * on every foreground, which is far more traffic than the staleness problem
 * warrants. Screens that need freshness ask for it.
 *
 * Skipping the first focus avoids a duplicate request. Tab screens are lazy
 * (`lazy` defaults to true in bottom-tabs v7, and we don't override it), so a
 * screen's first focus is also its mount — the moment `useQuery` fetches on its
 * own. Firing here too would mean two identical requests on the very first
 * visit. `useRef` resets per mount, which is what we want: within the
 * hand-rolled FoldersStack / AgencyStack, list ↔ detail is an unmount/remount
 * rather than a focus change, so each freshly mounted screen skips its own
 * mount-focus and refetches on subsequent tab returns.
 *
 * Note this refetch is unconditional — `refetch()` bypasses `staleTime`, so
 * every focus costs one request per screen. That is the documented React Query
 * pattern for React Native, and it stays invisible to the user: cached data
 * keeps rendering while the request runs (the screens gate their spinners on an
 * empty list, not on `isRefetching`), so focus revalidates in the background
 * instead of flashing a loader.
 */
export function useRefreshOnFocus(refetch: () => Promise<unknown>): void {
  const isFirstFocusRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
