import { Linking, Platform } from 'react-native';

/**
 * A link opened while signed out, kept until the user has signed in.
 *
 * The signed-out navigator only has the auth screens, so a shared link — a service someone sent,
 * a booking from an email — resolved to the login screen and the address was lost: after signing
 * in the user landed on Home, not on what they had opened. This remembers it at start-up (and for
 * links that arrive while signed out) so the app can open it once the session exists.
 */

/** Paths that are the auth flow itself, or the root — nothing worth returning to. */
const AUTH_PATHS = new Set([
  '',
  'login',
  'register',
  'verify-email',
  'forgot-password',
  'accept-invite',
  // Public pages: open them as they are, not after a sign-in.
  'legal',
  'help',
]);
const SCHEME = 'petbooker://';

let pending: string | null = null;

/** "services/42?x=1" from a full URL or a path; null for the auth screens and the root. */
export function toLinkPath(url: string | null | undefined): string | null {
  if (!url) return null;
  let path = url;
  if (path.startsWith(SCHEME)) path = path.slice(SCHEME.length);
  else {
    try {
      const parsed = new URL(path);
      path = parsed.pathname + parsed.search;
    } catch {
      // Already a path.
    }
  }
  path = path.replace(/^\/+/, '');
  const route = path.split('?')[0].replace(/\/+$/, '');
  return AUTH_PATHS.has(route) ? null : path;
}

/** Remembers the link the app was opened with. Call once, before the session restore resolves. */
export function captureInitialDeepLink(): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') pending = toLinkPath(window.location.href);
    return;
  }
  Linking.getInitialURL()
    .then((url) => {
      const path = toLinkPath(url);
      if (path) pending = path;
    })
    .catch(() => {});
}

/** Remembers a link that arrived while signed out. */
export function rememberDeepLink(url: string | null | undefined): void {
  const path = toLinkPath(url);
  if (path) pending = path;
}

/** The remembered link, once; null when there is none. */
export function takePendingDeepLink(): string | null {
  const path = pending;
  pending = null;
  return path;
}

/** Forgets it — the session was already signed in, so the navigator handled the link itself. */
export function clearPendingDeepLink(): void {
  pending = null;
}
