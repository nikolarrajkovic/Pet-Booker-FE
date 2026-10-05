/**
 * Hands the web build's `showAlert` calls to the in-app dialog (`AlertHost`).
 *
 * `showAlert` is imperative and called from outside React (35 call sites), so it cannot render a
 * dialog itself; the host subscribes here once it is mounted and renders each request. Until then
 * (and in unit tests, where no host is mounted) `requestAlert` reports false and the caller falls
 * back to the browser's own dialog.
 */
export type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertRequest = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

type Listener = (request: AlertRequest) => void;

let listener: Listener | null = null;

/** The host registers itself; returns the unsubscribe. */
export function setAlertListener(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

/** True when a host took the request. */
export function requestAlert(request: AlertRequest): boolean {
  if (!listener) return false;
  listener(request);
  return true;
}
