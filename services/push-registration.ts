import { Linking, Platform } from 'react-native';
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
 * What the OS says about this app's notification permission.
 *
 * `supported` is the question that comes first: on web and on a simulator push cannot work at
 * all, so there is no permission to hold an opinion about — the UI has to say "not available
 * here" rather than offer a switch that would never do anything.
 *
 * `canAskAgain` is the difference between a prompt and a trip to the settings app. Once the OS
 * stops offering the dialog (an iOS denial is permanent, Android after two), asking again is a
 * silent no-op — the only way back is `openDeviceNotificationSettings`.
 */
export type PushPermission = {
  supported: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
};

/** Push can't work here (web, simulator) — treated as a hard no, not a denial to appeal. */
const UNSUPPORTED: PushPermission = { supported: false, status: 'denied', canAskAgain: false };

function toPermission(result: Notifications.NotificationPermissionsStatus): PushPermission {
  return {
    supported: true,
    // Expo widens `status` to its own enum; the three values below are the ones it returns.
    status: result.granted ? 'granted' : (result.status as PushPermission['status']),
    canAskAgain: result.canAskAgain,
  };
}

/** Reads the current permission WITHOUT prompting — safe to call on every focus. */
export async function getPushPermission(): Promise<PushPermission> {
  if (Platform.OS === 'web' || !Device.isDevice) return UNSUPPORTED;
  try {
    return toPermission(await Notifications.getPermissionsAsync());
  } catch {
    return UNSUPPORTED;
  }
}

/**
 * Shows the OS permission prompt, if the OS will still show it.
 *
 * Calling this when `canAskAgain` is false resolves immediately with the existing denial rather
 * than doing nothing visible, so a caller can treat "the user said no" and "the OS won't ask"
 * the same way: neither grants push, and both are answered by the settings deep link.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  if (Platform.OS === 'web' || !Device.isDevice) return UNSUPPORTED;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || !current.canAskAgain) return toPermission(current);
    // The Android channel must exist before the prompt, or the grant has nowhere to deliver to.
    await ensureAndroidChannel();
    return toPermission(await Notifications.requestPermissionsAsync());
  } catch {
    return UNSUPPORTED;
  }
}

/**
 * Opens this app's own page in the system settings — the only route back from a permanent
 * denial, since the app can no longer raise the prompt itself.
 */
export async function openDeviceNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Nothing else to offer: the OS refused to open its own settings.
  }
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
    // The channel has to exist for delivery, not just for the prompt — a notification sent to a
    // missing channel is dropped in silence.
    await ensureAndroidChannel();

    if ((await requestPushPermission()).status !== 'granted') return null;

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
 *
 * Returns whether this handset now has a live row. The sign-in caller ignores it (registration
 * there is opportunistic and must never block anything), but the settings screen needs it: a
 * user who just tapped a switch has to be told when the switch could not take effect.
 */
export async function registerPushDevice(userId: number): Promise<boolean> {
  const pushToken = await getExpoPushToken();
  if (!pushToken) return false;

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
      if (existing.pushToken === pushToken && existing.isEnabled) return true;

      await apiJson<UserPushDeviceDto>(`/api/user-push-devices/${existing.id}`, {
        method: 'PUT',
        body: { ...existing, id: existing.id, userId, pushToken, isEnabled: true },
        fallback: 'Failed to update this device.',
        context: 'registerPushDevice/update',
      });
      return true;
    }

    await apiJson<UserPushDeviceDto>('/api/user-push-devices', {
      method: 'POST',
      body: { userId, platform: currentPlatform(), deviceId, pushToken, isEnabled: true },
      fallback: 'Failed to register this device.',
      context: 'registerPushDevice/create',
    });
    return true;
  } catch (error) {
    // Registration is opportunistic — a failure must never block sign-in.
    if (__DEV__) console.warn('[Push] registration failed', error);
    return false;
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
