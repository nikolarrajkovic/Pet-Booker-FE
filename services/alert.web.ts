/**
 * The web stand-in for `Alert.alert`, which does nothing at all in a browser.
 *
 * React Native Web ships no implementation: the call returns silently, so on the web build every
 * validation message, every confirmation and every success dialog simply never appeared — and
 * with them the `onPress` handlers attached to their buttons. That is why "Update Password" on an
 * empty form looked like a dead button, and why a successful password change neither confirmed
 * nor navigated back: both lived in `Alert.alert` callbacks.
 *
 * Rendered by the app's own dialog (`AlertHost`, reached through `alert-bus`). The browser's
 * `window.alert`/`confirm` remain only as the fallback before the host has mounted (and in unit
 * tests): they are synchronous and modal the way the call sites assume, but they are the grey
 * system box at the top of the window, which read as a site error rather than part of the app.
 *
 * Button semantics follow `Alert.alert`:
 *  - none or one  → a message, then that button's `onPress`
 *  - two or more  → a confirm; OK runs the first non-cancel button, Cancel the cancel one
 */
import { requestAlert, type AlertButton } from './alert-bus';

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (requestAlert({ title, message, buttons })) return;

  const body = [title, message].filter(Boolean).join('\n\n');

  if (!buttons || buttons.length <= 1) {
    window.alert(body);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancel = buttons.find((b) => b.style === 'cancel');
  const confirm = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];

  if (window.confirm(body)) confirm?.onPress?.();
  else cancel?.onPress?.();
}
