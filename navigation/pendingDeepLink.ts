import { Linking, Platform } from 'react-native';

/**
 * A link opened while signed out, kept until the user has signed in.
 *
 * A guest can browse (app review G7): Home, Search and the service and partner pages open as they
 * are. Anything else a link points at — a booking from an email, a chat — needs a session, so it
 * is remembered at start-up (and for links that arrive while signed out), the guest is sent to
 * sign in, and the app opens it once the session exists. The sign-in gate on a guest page
 * (`hooks/useRequireSignIn`) remembers that page the same way, so signing in returns to it.
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

/** Pages a guest opens directly; a link to one is not held for after sign-in. */
const GUEST_PATH = /^(search|profile|services\/\d+|providers\/\d+)$/;

/** True for a path a guest can open without signing in (Home is the root). */
export function isGuestPath(path: string): boolean {
  return GUEST_PATH.test(path.split('?')[0].replace(/\/+$/, ''));
}

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
    if (typeof window !== 'undefined') {
      const path = toLinkPath(window.location.href);
      pending = path && !isGuestPath(path) ? path : null;
    }
    return;
  }
  Linking.getInitialURL()
    .then((url) => {
      const path = toLinkPath(url);
      if (path && !isGuestPath(path)) pending = path;
    })
    .catch(() => {});
}

/** True while a link that needs a session is waiting for one. */
export function hasPendingDeepLink(): boolean {
  return pending !== null;
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
