import * as authService from './authService';
import * as notificationService from './notificationService';
import { queryClient } from './queryClient';
import { useAuthStore } from '../store/authStore';
import { useCameraStore } from '../store/cameraStore';
import { useUploadQueueStore } from '../store/uploadQueueStore';

/** Hard cap on the push-token DELETE so a dead network can't hold logout open. */
const UNREGISTER_TIMEOUT_MS = 3_000;

/**
 * Races unregister() against a timer. apiClient's own timeout is 30s and the
 * token fetch makes a second network call before that, so without a cap a
 * flaky connection could stall the logout tap for the better part of a minute.
 *
 * Losing the race only stops us waiting — the request stays in flight and
 * usually still lands, since its Authorization header was set before signOut.
 */
async function unregisterPushToken(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      notificationService.unregister(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS);
      }),
    ]);
  } catch (error: unknown) {
    // unregister() is contractually non-throwing; belt-and-braces so a
    // regression there can never strand a user in a half-logged-out state.
    console.error('[sessionService] push unregister failed', error);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Logs out and wipes ALL user-scoped client state so nothing from this
 * session can render under the next one. Order matters:
 *
 * 1. Push token unregister — MUST run first: it's an authed API call, so it
 *    needs the Cognito token that step 2 destroys. Capped at 3s.
 * 2. Amplify signOut — revokes/clears Cognito tokens. Any in-flight API
 *    request after this fails at the auth interceptor (no token).
 * 3. queryClient.clear() — drops the entire React Query cache. Selective
 *    invalidation is not enough: invalidated queries still serve cached
 *    data to the next render while refetching.
 * 4. Upload queue reset — clears queued/failed items (memory + AsyncStorage)
 *    so the previous user's pending uploads never run under the next account.
 *    Camera destination reset too, so the pick never leaks across accounts.
 * 5. Auth store reset LAST — this is what flips the UI to AuthFlow, so by
 *    the time anything re-renders, every other cache is already empty.
 */
export async function logout(): Promise<void> {
  await unregisterPushToken();
  await authService.signOut();
  queryClient.clear();
  useUploadQueueStore.getState().reset();
  useCameraStore.getState().reset();
  useAuthStore.getState().reset();
}
