/**
 * Device push on the web: nothing to do (see push-registration.ts — web push needs a service worker
 * and VAPID keys neither end has, so the browser build behaves like a device with notifications
 * switched off).
 *
 * A separate file rather than the `Platform.OS === 'web'` early returns alone, so the browser
 * bundle never imports expo-notifications: importing it registers a push-token listener as a side
 * effect, which logged "Listening to push token changes is not yet fully supported on web" on
 * every page load.
 */
export type PushPermission = {
  supported: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
};

const UNSUPPORTED: PushPermission = { supported: false, status: 'denied', canAskAgain: false };

export function configureForegroundNotifications(): void {}

export async function getPushPermission(): Promise<PushPermission> {
  return UNSUPPORTED;
}

export async function requestPushPermission(): Promise<PushPermission> {
  return UNSUPPORTED;
}

export async function openDeviceNotificationSettings(): Promise<void> {}

export async function getExpoPushToken(): Promise<string | null> {
  return null;
}

export async function registerPushDevice(_userId: number): Promise<boolean> {
  return false;
}

export async function unregisterPushDevice(_userId: number): Promise<void> {}
