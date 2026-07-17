import * as authService from './authService';
import { queryClient } from './queryClient';
import { useAuthStore } from '../store/authStore';
import { useCameraStore } from '../store/cameraStore';
import { useUploadQueueStore } from '../store/uploadQueueStore';

/**
 * Logs out and wipes ALL user-scoped client state so nothing from this
 * session can render under the next one. Order matters:
 *
 * 1. Amplify signOut — revokes/clears Cognito tokens. Any in-flight API
 *    request after this fails at the auth interceptor (no token).
 * 2. queryClient.clear() — drops the entire React Query cache. Selective
 *    invalidation is not enough: invalidated queries still serve cached
 *    data to the next render while refetching.
 * 3. Upload queue reset — clears queued/failed items (memory + AsyncStorage)
 *    so the previous user's pending uploads never run under the next account.
 *    Camera destination reset too, so the pick never leaks across accounts.
 * 4. Auth store reset LAST — this is what flips the UI to AuthFlow, so by
 *    the time anything re-renders, every other cache is already empty.
 */
export async function logout(): Promise<void> {
  await authService.signOut();
  queryClient.clear();
  useUploadQueueStore.getState().reset();
  useCameraStore.getState().reset();
  useAuthStore.getState().reset();
}
