import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  getPushPermission,
  openDeviceNotificationSettings,
  requestPushPermission,
  type PushPermission,
} from '../services/push-registration';

/**
 * The device's own notification permission, as screen state.
 *
 * The point of this hook is the AppState listener. Every route out of a permanent denial leaves
 * the app: the user taps "Open Settings", flips the switch in the OS, and comes back. Nothing
 * tells the app that happened — no event, no callback — so a screen that read the permission
 * once on mount would still be showing "blocked" over a permission that is now granted, and the
 * user would reasonably conclude the setting is broken. Re-reading whenever the app returns to
 * the foreground is what makes the round trip work.
 *
 * `permission` is null only until the first read lands; treat that as "still loading", not as
 * "denied", or the UI flashes a blocked banner on every open.
 */
export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  // The read is async and the screen can be left mid-flight (the settings deep link, a back
  // press) — without this the resolve lands on an unmounted component.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    getPushPermission().then((next) => {
      if (mountedRef.current) setPermission(next);
    });
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      // 'active' is the return from the settings app — see the note above.
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  /**
   * Raises the OS prompt and returns what the user chose, so the caller can act on the answer
   * in the same turn rather than waiting for the state to settle. Resolves with the existing
   * denial when the OS will no longer ask.
   */
  const request = useCallback(async (): Promise<PushPermission> => {
    setIsRequesting(true);
    try {
      const next = await requestPushPermission();
      if (mountedRef.current) setPermission(next);
      return next;
    } finally {
      if (mountedRef.current) setIsRequesting(false);
    }
  }, []);

  return {
    permission,
    /** True while the OS dialog is up — long enough to want a disabled control behind it. */
    isRequesting,
    request,
    refresh,
    openSettings: openDeviceNotificationSettings,
  };
}
