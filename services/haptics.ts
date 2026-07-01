import * as Haptics from 'expo-haptics';

/**
 * Thin, crash-proof wrappers around `expo-haptics`. Haptics are a no-op on web
 * and on devices without a taptic engine; every call is guarded so a missing
 * engine (or web) never throws. Match the weight to the event: `success` for a
 * completed/celebratory moment, `selection` for light navigation ticks.
 */
export function hapticSuccess(): void {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    /* no haptics engine — ignore */
  }
}

export function hapticSelection(): void {
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    /* no haptics engine — ignore */
  }
}
