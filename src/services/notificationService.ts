import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { apiClient } from './api';

/**
 * Outcome of a permission request + token registration round-trip. Split three
 * ways on purpose: "user said no" is final, but "user said yes and the network
 * call failed" is retryable on the next launch via registerIfGranted().
 */
export type RegistrationResult =
  | 'granted_registered'
  | 'granted_register_failed'
  | 'denied';

/**
 * Backend's token contract is iOS-only for now. Hardcoded rather than read from
 * Platform.OS so an accidental Android build can't post a platform the API
 * rejects — revisit when/if Android ships.
 */
const PLATFORM = 'ios';

const TOKENS_ENDPOINT = '/notifications/tokens';

/**
 * Push tokens need real APNs registration, which the simulator has no hardware
 * path for. Every exported method no-ops there instead of throwing, so calling
 * code doesn't need its own guard.
 */
function isPhysicalDevice(): boolean {
  return Device.isDevice;
}

/**
 * getExpoPushTokenAsync requires the EAS project id. It lives at
 * expo.extra.eas.projectId in app.json; easConfig is the runtime mirror EAS
 * injects into built apps, so check both before giving up.
 */
function resolveProjectId(): string | null {
  const fromExtra: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) {
    return fromExtra;
  }

  const fromEasConfig: unknown = Constants.easConfig?.projectId;
  if (typeof fromEasConfig === 'string' && fromEasConfig.length > 0) {
    return fromEasConfig;
  }

  return null;
}

/** Fetches this device's Expo push token. Returns null on any failure. */
async function fetchPushToken(): Promise<string | null> {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.warn('[notificationService] no EAS projectId — cannot fetch a push token');
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error: unknown) {
    // Offline, APNs registration refused, or Expo's token service unreachable.
    console.error('[notificationService] getExpoPushTokenAsync failed', error);
    return null;
  }
}

/** POSTs the token to the backend (upserts + reassigns). False on failure. */
async function postToken(token: string): Promise<boolean> {
  try {
    await apiClient.post(TOKENS_ENDPOINT, { token, platform: PLATFORM });
    return true;
  } catch (error: unknown) {
    console.error('[notificationService] token registration failed', error);
    return false;
  }
}

/**
 * Current OS-level notification permission. Never throws — fails closed to
 * DENIED so a broken read can't make the pre-prompt appear and then dead-end.
 */
export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
  if (!isPhysicalDevice()) {
    console.log('[notificationService] simulator — reporting permission as denied');
    return Notifications.PermissionStatus.DENIED;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (error: unknown) {
    console.error(
      '[notificationService] getPermissionsAsync failed — the native module may be missing from this dev client',
      error,
    );
    return Notifications.PermissionStatus.DENIED;
  }
}

/**
 * Asks for system permission and, if granted, registers the token. Never
 * throws. Call this from an explicit user action only (the pre-prompt's
 * "Enable"), never on launch — iOS gives exactly one shot at this dialog.
 */
export async function requestPermissionAndRegister(): Promise<RegistrationResult> {
  if (!isPhysicalDevice()) {
    console.log('[notificationService] simulator — skipping permission request');
    return 'denied';
  }

  let granted = false;
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    granted = status === Notifications.PermissionStatus.GRANTED;
  } catch (error: unknown) {
    console.error('[notificationService] requestPermissionsAsync failed', error);
    return 'denied';
  }

  if (!granted) {
    return 'denied';
  }

  const token = await fetchPushToken();
  if (!token) {
    return 'granted_register_failed';
  }

  return (await postToken(token)) ? 'granted_registered' : 'granted_register_failed';
}

/**
 * Re-registers the current token when permission is already granted. Safe to
 * fire on every login and warm launch: it covers token rotation and account
 * switches (the backend upserts the token and reassigns it to the caller).
 * Never throws.
 */
export async function registerIfGranted(): Promise<void> {
  if (!isPhysicalDevice()) {
    console.log('[notificationService] simulator — skipping token registration');
    return;
  }

  const status = await getPermissionStatus();
  if (status !== Notifications.PermissionStatus.GRANTED) {
    return;
  }

  const token = await fetchPushToken();
  if (!token) {
    return;
  }

  await postToken(token);
}

/**
 * Drops this device's token from the account. MUST run BEFORE auth is cleared
 * on logout — the axios interceptor needs a live JWT or the request is rejected
 * before it leaves the device. Never throws: logout must never be blocked by a
 * failed unregister (a stale token is the backend's problem to prune).
 */
export async function unregister(): Promise<void> {
  if (!isPhysicalDevice()) {
    console.log('[notificationService] simulator — skipping token unregistration');
    return;
  }

  // Re-reading the token can fail if the user revoked permission since login;
  // the row is then left for the backend to prune on its first send failure.
  const token = await fetchPushToken();
  if (!token) {
    return;
  }

  try {
    // axios sends a DELETE body only via `data` — a second positional arg is
    // treated as config, so the payload would silently vanish.
    await apiClient.delete(TOKENS_ENDPOINT, { data: { token } });
  } catch (error: unknown) {
    console.error('[notificationService] token unregistration failed', error);
  }
}
