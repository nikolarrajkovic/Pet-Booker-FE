// Callback invoked when a token refresh fails and the session must end.
// Registered by AuthContext on mount so http.ts never imports from context directly.
let _onSessionExpired: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: () => void): void {
  _onSessionExpired = handler;
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (__DEV__) {
    console.log('[API Request]', init?.method ?? 'GET', url, init?.body ?? '');
  }

  const response = await fetch(url, init);
  const clone = response.clone();

  if (__DEV__) {
    clone.text().then((body) => {
      console.log('[API Response]', response.status, url, body);
    });
  }

  return response;
}

/**
 * Authenticated fetch — automatically reads the stored access token and
 * attaches it as a Bearer Authorization header.  Works the same way as an
 * Angular HTTP interceptor: callers never have to touch the token manually.
 */
export async function apiAuthFetch(url: string, init?: RequestInit): Promise<Response> {
  // Lazy imports to avoid circular deps: http ↔ token-storage and http ↔ auth
  const tokenStorage = await import('./token-storage');
  let token = await tokenStorage.getAccessToken();

  // Access token is missing or expired — attempt a silent refresh
  if (!token) {
    const refreshToken = await tokenStorage.getRefreshToken();

    if (refreshToken) {
      try {
        const { refreshAccessToken } = await import('./auth');
        const result = await refreshAccessToken(refreshToken);
        await tokenStorage.saveTokens(result.accessToken, result.refreshToken);
        token = result.accessToken;
      } catch {
        // Refresh failed — clear storage and notify AuthContext to sign the user out
        await tokenStorage.clearTokens();
        _onSessionExpired?.();
        throw new Error('Session expired. Please log in again.');
      }
    } else {
      // No refresh token available — session is fully expired
      _onSessionExpired?.();
      throw new Error('Session expired. Please log in again.');
    }
  }

  // Do not set Content-Type for FormData — the runtime must set it automatically
  // so that the multipart boundary is included correctly.
  const isFormData = init?.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    Accept: 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  headers['Authorization'] = `Bearer ${token}`;

  return apiFetch(url, { ...init, headers });
}
