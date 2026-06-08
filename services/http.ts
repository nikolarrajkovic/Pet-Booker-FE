// Callback invoked when a token refresh fails and the session must end.
// Registered by AuthContext on mount so http.ts never imports from context directly.
let _onSessionExpired: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: () => void): void {
  _onSessionExpired = handler;
}

/**
 * Returns the API base URL from the environment, with any trailing slash removed.
 * Single source of truth — every service builds its URLs from this.
 */
export function getApiBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set.');
  }
  return baseUrl.replace(/\/$/, '');
}

/**
 * Extracts a human-readable error message from a failed Response body.
 * Resolution order:
 *   1. ASP.NET validation errors — `{ errors: { Field: ["msg"] } }`
 *   2. `{ message }` → `{ detail }` → `{ title }`
 *   3. Raw text (only if it does not look like a JSON blob)
 *   4. The provided fallback
 *
 * @param response - The failed fetch Response (its body is consumed here)
 * @param fallback - Message to use when nothing better can be extracted
 * @param context  - Optional tag for the dev console error log (e.g. "createPet")
 */
export async function parseApiError(
  response: Response,
  fallback: string,
  context?: string,
): Promise<string> {
  const text = await response.text();

  if (context) {
    console.error(`[${context}] error`, response.status, text);
  }

  try {
    const json = JSON.parse(text);
    if (json.errors && typeof json.errors === 'object') {
      const fields = Object.entries(json.errors as Record<string, string[]>)
        .map(([field, msgs]) => `${field}: ${(msgs ?? []).join(', ')}`)
        .join(' | ');
      return fields || json.title || fallback;
    }
    return json.message ?? json.detail ?? json.title ?? (text || fallback);
  } catch {
    // Not JSON — use the raw text only if it looks human-readable
    const trimmed = text.trim();
    return text && !trimmed.startsWith('{') && !trimmed.startsWith('[') ? text : fallback;
  }
}

/**
 * Extracts the items array from a paginated or plain API list response.
 * Handles: plain array, `{ items }`, `{ data }`, `{ results }`, `{ value }`
 */
export function extractPageItems<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const obj = raw as Record<string, unknown>;
  for (const key of ['items', 'data', 'results', 'value']) {
    if (Array.isArray(obj?.[key])) return obj[key] as T[];
  }
  return [];
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
