import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiJson, apiList, apiVoid } from './http';

/**
 * Device push registration — the half of notifications that works when the app is CLOSED.
 *
 * SignalR only reaches a live connection, so everything in NotificationsContext /
 * MessagesContext goes quiet the moment the app is backgrounded. The backend sends to Expo's
 * push service instead, which needs a token from this device; that token is what
 * `UserPushDevice` stores.
 *
 * ## Why an upsert on deviceId
 *
 * Expo reissues a token on reinstall, and a user signs in on more than one device. Keying the
 * row on a stable per-install `deviceId` means a refreshed token UPDATES the row rather than
 * accumulating dead siblings the backend has to prune — it prunes the ones it can detect
 * (DeviceNotRegistered), but not registering duplicates in the first place is cheaper.
 *
 * ## Not on web
 *
 * Web push needs a service worker and VAPID keys that neither end has, and Expo's token API
 * throws off-device. Every entry point below no-ops rather than throwing, so the web bundle and
 * the simulator behave like a device that simply has notifications switched off.
 */

/** Wire shape of the backend's UserPushDevice resource. */
type UserPushDeviceDto = {
  id?: number;
  userId: number;
  /** PushPlatform: 0 = iOS, 1 = Android, 2 = Web. */
  platform: number;
  deviceId: string;
  pushToken: string;
  isEnabled: boolean;
};

/** Matches Domain.PushPlatform. */
const PLATFORM = { ios: 0, android: 1, web: 2 } as const;

/**
 * How a notification behaves while the app is in the FOREGROUND. Without a handler Expo shows
 * nothing at all when the app is open — which would be right for a thread the user is already
 * reading, but wrong for every other screen, so the banner is shown and the in-app UI
 * de-dupes by id.
 */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Android requires a channel before anything can be shown on API 26+, and a notification sent
 * to a channel that does not exist is dropped silently. The id must match the backend's
 * `Push:AndroidChannelId`.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/** A stable id for this install, so a refreshed token updates its row instead of adding one. */
function resolveDeviceId(): string {
  const installationId =
    (Constants as unknown as { installationId?: string }).installationId ??
    Constants.sessionId ??
    `${Device.modelName ?? 'device'}-${Device.osName ?? Platform.OS}`;
  return String(installationId).slice(0, 200);
}

function currentPlatform(): number {
  if (Platform.OS === 'ios') return PLATFORM.ios;
  if (Platform.OS === 'android') return PLATFORM.android;
  return PLATFORM.web;
}

/**
 * Asks for permission (once — the OS remembers the answer) and returns this device's Expo push
 * token, or null when push is unavailable: web, a simulator, a denied prompt, or a project
 * without an EAS id.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  // Simulators cannot receive push, and asking throws rather than returning null.
  if (!Device.isDevice) return null;

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    // Only prompt when the user has not answered yet — re-asking a denial does nothing on iOS
    // and is a poor experience on Android.
    if (status !== 'granted' && existing.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    // EAS project id is required for a token on SDK 49+. It is absent in bare Expo Go usage
    // against a project that was never configured, which is a no-op rather than an error.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      if (__DEV__) console.warn('[Push] no EAS projectId; skipping push registration');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data ?? null;
  } catch (error) {
    // Never fatal: the app works without push, it just cannot reach a closed device.
    if (__DEV__) console.warn('[Push] token request failed', error);
    return null;
  }
}

/**
 * Registers (or refreshes) this device for the signed-in user. Safe to call on every launch —
 * it upserts on `deviceId`, so repeated calls do not multiply rows.
 */
export async function registerPushDevice(userId: number): Promise<void> {
  const pushToken = await getExpoPushToken();
  if (!pushToken) return;

  const deviceId = resolveDeviceId();

  try {
    // The generated CRUD has no upsert, so find this device's existing row first. Scoped to the
    // caller server-side (IUserScopedRequest), so this only ever sees their own devices.
    const mine = await apiList<UserPushDeviceDto>('/api/user-push-devices', {
      query: { PerPage: 200 },
      fallback: 'Failed to read push devices.',
      context: 'registerPushDevice/list',
    });
    const existing = mine.find((d) => d.deviceId === deviceId);

    if (existing?.id) {
      // Nothing changed and the row is live — don't spend a write on every cold start.
      if (existing.pushToken === pushToken && existing.isEnabled) return;

      await apiJson<UserPushDeviceDto>(`/api/user-push-devices/${existing.id}`, {
        method: 'PUT',
        body: { ...existing, id: existing.id, userId, pushToken, isEnabled: true },
        fallback: 'Failed to update this device.',
        context: 'registerPushDevice/update',
      });
      return;
    }

    await apiJson<UserPushDeviceDto>('/api/user-push-devices', {
      method: 'POST',
      body: { userId, platform: currentPlatform(), deviceId, pushToken, isEnabled: true },
      fallback: 'Failed to register this device.',
      context: 'registerPushDevice/create',
    });
  } catch (error) {
    // Registration is opportunistic — a failure must never block sign-in.
    if (__DEV__) console.warn('[Push] registration failed', error);
  }
}

/**
 * Stops push to this device on sign-out. Disabled rather than deleted, so signing back in on
 * the same handset reuses the row instead of creating another.
 *
 * Without this, a shared or resold device keeps buzzing with the previous account's messages.
 */
export async function unregisterPushDevice(userId: number): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  const deviceId = resolveDeviceId();
  try {
    const mine = await apiList<UserPushDeviceDto>('/api/user-push-devices', {
      query: { PerPage: 200 },
      fallback: 'Failed to read push devices.',
      context: 'unregisterPushDevice/list',
    });
    const existing = mine.find((d) => d.deviceId === deviceId);
    if (!existing?.id) return;

    await apiVoid(`/api/user-push-devices/${existing.id}`, {
      method: 'PUT',
      body: { ...existing, id: existing.id, userId, isEnabled: false },
      fallback: 'Failed to unregister this device.',
      context: 'unregisterPushDevice',
    });
  } catch (error) {
    if (__DEV__) console.warn('[Push] unregistration failed', error);
  }
}
