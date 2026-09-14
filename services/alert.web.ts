/**
 * The web stand-in for `Alert.alert`, which does nothing at all in a browser.
 *
 * React Native Web ships no implementation: the call returns silently, so on the web build every
 * validation message, every confirmation and every success dialog simply never appeared — and
 * with them the `onPress` handlers attached to their buttons. That is why "Update Password" on an
 * empty form looked like a dead button, and why a successful password change neither confirmed
 * nor navigated back: both lived in `Alert.alert` callbacks.
 *
 * The browser's own dialogs are used deliberately. They are plain, but they are synchronous and
 * modal in the way the call sites assume — a promise-based replacement would need all 32 of them
 * rewritten, and a styled one needs a provider the imperative callers cannot reach. Replacing
 * these with the app's own dialog is worth doing; having the buttons work is worth doing first.
 *
 * Button semantics follow `Alert.alert`:
 *  - none or one  → a message, then that button's `onPress`
 *  - two or more  → a confirm; OK runs the first non-cancel button, Cancel the cancel one
 */
type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
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
