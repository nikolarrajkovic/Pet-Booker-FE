/**
 * The one place an access token is renewed — for REST calls (`apiAuthFetch`), the SignalR hubs and
 * session restore alike.
 *
 * Each of those used to refresh on its own. The backend rotates refresh tokens (a refresh revokes
 * the token it was given), so when the access token expired every request in flight at that moment
 * — Home alone fires four rails at once, plus up to three hubs reconnecting — sent its own
 * `POST /auth/refresh` with the SAME refresh token. The first succeeded, a later one was refused,
 * and its catch cleared the tokens: the user was signed out at random, and on a slow mobile network
 * reliably (front-end review 2026-10-14, S1; reproduced with 400 ms of jitter).
 *
 * Now:
 *  - **One refresh in flight per app.** Every caller awaits the same promise.
 *  - **Across browser tabs too**, which share `localStorage` but not this module: the refresh runs
 *    under a Web Lock, and a tab that waited re-reads storage first and reuses the token the other
 *    tab just stored instead of spending the refresh token again. (The backend also honours a
 *    just-rotated refresh token for 60 s, so a race that slips through still succeeds.)
 *  - **Only a rejected refresh ends the session.** A network error, a 429 or a 5xx leaves the tokens
 *    alone — being offline for a moment used to sign people out.
 */
import { Platform } from 'react-native';
import { refreshAccessToken } from './auth';
import { ApiError, notifySessionExpired } from './http';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './token-storage';

export { tokenAgeMs } from './jwt';

/** The session is over: the server refused the refresh token, or there was none to send. */
export class SessionEndedError extends Error {
  constructor(message = 'Session expired. Please log in again.') {
    super(message);
    this.name = 'SessionEndedError';
  }
}

let inFlight: Promise<string> | null = null;

/** A usable access token: the stored one while it is valid, else a renewed one. */
export async function getValidAccessToken(): Promise<string> {
  const token = await getAccessToken();
  if (token) return token;
  return refreshSession();
}

/**
 * Renews the access token, sharing a refresh already under way.
 *
 * `force` renews even though the stored token has not expired — for a token whose permissions are
 * behind the server's (an application approved since it was issued). Pass that token as
 * `staleToken`: a renewal another caller or tab finished while this one waited for the lock counts,
 * and is returned instead of spending the refresh token a second time.
 */
export function refreshSession(
  options: { force?: boolean; staleToken?: string } = {}
): Promise<string> {
  if (inFlight) return inFlight;
  inFlight = withRefreshLock(() => renew(options)).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function renew({
  force,
  staleToken,
}: {
  force?: boolean;
  staleToken?: string;
}): Promise<string> {
  // Another caller (or tab) may have renewed while this one waited for the lock.
  const current = await getAccessToken();
  if (current && (!force || (staleToken !== undefined && current !== staleToken))) return current;

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return endSession();

  try {
    const result = await refreshAccessToken(refreshToken);
    await saveTokens(result.accessToken, result.refreshToken);
    return result.accessToken;
  } catch (error) {
    if (isRefreshRejected(error)) return endSession();
    // Offline, rate-limited or a server error: nothing is known about the session, so keep it.
    throw error;
  }
}

/** 400/401/403 from `/auth/refresh` is the server refusing this refresh token (or a ban). */
function isRefreshRejected(error: unknown): boolean {
  return error instanceof ApiError && [400, 401, 403].includes(error.status);
}

async function endSession(): Promise<never> {
  await clearTokens();
  notifySessionExpired();
  throw new SessionEndedError();
}

type LockManager = {
  request: (name: string, callback: () => Promise<unknown>) => Promise<unknown>;
};

/** Serialises refreshes across browser tabs; a plain call on native (one JS runtime) or without Web Locks. */
async function withRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  const locks =
    Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? (navigator as unknown as { locks?: LockManager }).locks
      : undefined;
  if (!locks?.request) return work();
  return (await locks.request('petbooker-token-refresh', work)) as T;
}
