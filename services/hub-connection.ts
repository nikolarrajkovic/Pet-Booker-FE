import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
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
 * Builds a (not yet started) connection to a backend hub. Callers own the
 * lifecycle: `await start()`, register handlers, and `stop()` on teardown.
 */
export function createHubConnection(hubPath: string): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}${hubPath}`, {
      accessTokenFactory: getHubAccessToken,
      // The signalr client defaults to credentialed requests (cookies), which the
      // browser rejects against the API's wildcard CORS (`Access-Control-Allow-
      // Origin: *`). Auth is the bearer token, never a cookie — so opt out.
      withCredentials: false,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(__DEV__ ? LogLevel.Information : LogLevel.Error)
    .build();
}
