import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
  type IRetryPolicy,
} from '@microsoft/signalr';
import { getApiBaseUrl } from './http';

/**
 * Shared SignalR connection factory for the backend's hubs (/hubs/*).
 *
 * The JWT rides the `?access_token=` query param (SignalR cannot send an
 * Authorization header on the WebSocket handshake); the backend accepts that
 * only for /hubs/* paths. The token factory below mirrors apiAuthFetch's
 * refresh-then-attach flow (services/http.ts) with the same lazy imports to
 * avoid circular deps, and is re-invoked by SignalR on every negotiate /
 * reconnect — so the 30-minute access-token TTL is handled transparently.
 *
 * Deliberately does NOT trigger the global session-expired sign-out: a dropped
 * hub connection shouldn't force-logout the user — the next REST call decides.
 */
async function getHubAccessToken(): Promise<string> {
  const tokenStorage = await import('./token-storage');
  const token = await tokenStorage.getAccessToken();
  if (token) return token;

  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error('Not signed in.');

  const { refreshAccessToken } = await import('./auth');
  const result = await refreshAccessToken(refreshToken);
  await tokenStorage.saveTokens(result.accessToken, result.refreshToken);
  return result.accessToken;
}

/**
 * Waits before each attempt to (re)connect a hub. The last delay repeats for as long as the
 * connection is wanted — there is no attempt after which it gives up.
 *
 * It used to be a plain array handed to `withAutomaticReconnect`, which stops after its last
 * entry: an API that was away for more than ~47s (a redeploy, a container restart) left every
 * open tab with a dead chat and notification channel until someone reloaded it, with nothing on
 * screen to say so. REST kept working, so the app looked fine and simply stopped being live.
 */
const RETRY_DELAYS_MS = [0, 2000, 5000, 10000, 30000] as const;

function retryDelay(previousAttempts: number): number {
  return RETRY_DELAYS_MS[Math.min(previousAttempts, RETRY_DELAYS_MS.length - 1)];
}

/** The reconnect policy every hub uses: never returns `null`, which is SignalR's "give up". */
export const hubRetryPolicy: IRetryPolicy = {
  nextRetryDelayInMilliseconds: ({ previousRetryCount }) => retryDelay(previousRetryCount),
};

/**
 * Starts a connection, retrying until it is up or its owner has gone (`isCancelled`).
 *
 * `withAutomaticReconnect` only covers a connection that was up and then dropped; a *first*
 * `start()` that fails — the API restarting, a network blip, a phone waking up offline — is
 * final. The providers used to log it and carry on, so one failed negotiate at load meant no
 * live messages, badge or toasts for the rest of the session.
 *
 * Resolves with how many attempts failed before it connected (so a caller can re-read what the
 * gap may have cost it), or `null` when the owner went away first.
 */
export async function startHubConnection(
  connection: HubConnection,
  isCancelled: () => boolean,
  label: string
): Promise<number | null> {
  for (let failed = 0; ; failed++) {
    if (failed > 0) await new Promise((resolve) => setTimeout(resolve, retryDelay(failed)));
    if (isCancelled()) return null;
    try {
      await connection.start();
      return isCancelled() ? null : failed;
    } catch (error) {
      // A stop() from the owner's teardown lands here too; the next check ends the loop.
      if (__DEV__) console.warn(`[${label}] hub connect failed, retrying`, error);
    }
  }
}

/**
 * Builds a (not yet started) connection to a backend hub. Callers own the
 * lifecycle: `startHubConnection()`, register handlers, and `stop()` on teardown.
 */
export function createHubConnection(hubPath: string): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}${hubPath}`, {
      accessTokenFactory: getHubAccessToken,
      // The signalr client defaults to credentialed requests (cookies), but the
      // API's CORS policy is an origin allowlist WITHOUT AllowCredentials
      // ("Cors:AllowedOrigins" in the backend appsettings) — auth is the bearer
      // token, never a cookie. Keep requests non-credentialed to match, or the
      // browser rejects the negotiate call.
      withCredentials: false,
    })
    .withAutomaticReconnect(hubRetryPolicy)
    .configureLogging(__DEV__ ? LogLevel.Information : LogLevel.Error)
    .build();
}
