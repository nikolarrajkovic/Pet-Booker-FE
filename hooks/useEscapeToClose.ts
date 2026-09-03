import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Closes an open overlay when the user presses **Esc**, on the web target only.
 *
 * React Native's `<Modal onRequestClose>` fires for Android's hardware back button and for
 * nothing else — a browser key press never reaches it. So without this, every dialog in the app
 * ignores the first key a desktop user reaches for, and the only way out is finding the X.
 *
 * Keyed on the **platform**, not the layout: a narrow browser window draws the phone design but
 * still has a physical keyboard, and refusing Esc there would be a deliberate downgrade. Native
 * has no key to press and no `document` to listen on.
 *
 * ```tsx
 * useEscapeToClose(visible, onClose);
 * ```
 *
 * Pass `false` for `enabled` on an overlay that must not be dismissed by accident — a mid-submit
 * dialog, or the first-run language chooser that has no valid "cancel".
 */
export function useEscapeToClose(enabled: boolean, onClose: (() => void) | undefined): void {
  useEffect(() => {
    // `Platform.OS === 'web'` says which target this is, not that a DOM exists right now —
    // during Expo's static web export there is no `document`, and reaching for it would throw
    // at build time.
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!enabled || !onClose) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, onClose]);
}
