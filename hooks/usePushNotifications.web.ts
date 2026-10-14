/**
 * Device push on the web: a no-op (see usePushNotifications.ts). Kept apart so the browser bundle
 * never imports expo-notifications, whose import alone warns that push-token listening is not
 * supported on web.
 */
export function usePushNotifications(_navReady: boolean): void {}
