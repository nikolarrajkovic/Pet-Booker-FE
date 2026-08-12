// Callback invoked when a token refresh fails and the session must end.
// Registered by AuthContext on mount so http.ts never imports from context directly.
let _onSessionExpired: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: () => void): void {
  _onSessionExpired = handler;
}

// Active UI language, sent as the Accept-Language header on EVERY request so the
// backend localizes what it produces (validation messages, notifications, emails).
// Registered by LocaleContext on load/change — same pattern as the session handler,
// so http.ts never imports from context directly. English is the safety default.
let _apiLanguage = 'en';

export function registerApiLanguage(lang: string): void {
  _apiLanguage = lang;
}

/** Accept-Language value: active language first, English as explicit fallback. */
function acceptLanguageHeader(): string {
  return _apiLanguage === 'en' ? 'en' : `${_apiLanguage},en;q=0.8`;
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

// The API prefixes a property path with its binding wrapper (`Request.Phone`).
// That first segment names the DTO, not a field the user filled in — drop it.
const BINDING_PREFIXES = new Set(['request', 'command', 'query', 'model', 'dto', 'body', '$']);

/**
 * Turns a server property path into something a user can read:
 * `Request.Phone` → "Phone", `Request.Photos[0].Url` → "Photos #1 Url".
 */
export function humanizeFieldName(propertyName: string): string {
  return propertyName
    .split('.')
    .filter((segment, i) => !(i === 0 && BINDING_PREFIXES.has(segment.toLowerCase())))
    .map((segment) =>
      segment
        .replace(/\[(\d+)\]/g, (_, index: string) => ` #${Number(index) + 1}`)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // phoneNumber → phone Number
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ZIPCode → ZIP Code
        .trim()
    )
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Lowercased, punctuation-free, space-padded — for whole-word containment tests. */
function wordsOf(value: string): string {
  return ` ${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/**
 * Prefixes a validation message with its field label, but only when the message
 * does not already name the field. The backend writes most rules in prose
 * ("Phone must start with +381…"), so blindly prefixing produced "Phone: Phone
 * must start with…"; terse ones ("must not be empty") need the label to mean
 * anything at all.
 */
function labelledMessage(field: string | undefined, message: string): string {
  const msg = message.trim();
  const label = field ? humanizeFieldName(field) : '';
  if (!label) return msg;
  return wordsOf(msg).includes(wordsOf(label)) ? msg : `${label}: ${msg}`;
}

/** One line per rule (de-duplicated) — readable in a toast, alert or inline view. */
function formatValidationEntries(
  entries: { field?: string; message: string }[],
  fallback: string
): string {
  const lines = Array.from(
    new Set(entries.map((e) => labelledMessage(e.field, e.message)).filter(Boolean))
  );
  return lines.length ? lines.join('\n') : fallback;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Extracts a human-readable error message from a failed Response body.
 * Resolution order:
 *   1. FluentValidation envelope — `{ error, details: [{ propertyName, errorMessage }] }`
 *   2. ASP.NET ModelState errors — `{ errors: { Field: ["msg"] } }`
 *   3. `{ message }` → `{ detail }` → `{ title }` → `{ error }`
 *   4. Raw text (only if it does not look like a JSON/HTML blob)
 *   5. The provided fallback
 *
 * Both validation shapes render one rule per line, with the field label added
 * only where the message doesn't already name it. A JSON body we can't read is
 * never shown to the user — the caller's fallback is, since a raw `{"error":…}`
 * blob on screen is worse than a plain "Couldn't save your profile."
 *
 * @param response - The failed fetch Response (its body is consumed here)
 * @param fallback - Message to use when nothing better can be extracted
 * @param context  - Optional tag for the dev console error log (e.g. "createPet")
 */
export async function parseApiError(
  response: Response,
  fallback: string,
  context?: string
): Promise<string> {
  const text = await response.text();

  if (context) {
    console.error(`[${context}] error`, response.status, text);
  }

  const parsed = safeJsonParse(text);

  if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();

  if (parsed && typeof parsed === 'object') {
    const json = parsed as Record<string, unknown>;

    // 1. { error: "Validation failed.", details: [{ propertyName, errorMessage, errorCode }] }
    if (Array.isArray(json.details)) {
      const entries = json.details
        .map((detail) => {
          if (typeof detail === 'string') return { message: detail };
          const d = (detail ?? {}) as Record<string, unknown>;
          const message = d.errorMessage ?? d.message ?? d.description;
          const field = d.propertyName ?? d.property ?? d.field;
          return {
            field: typeof field === 'string' ? field : undefined,
            message: typeof message === 'string' ? message : '',
          };
        })
        .filter((e) => e.message.trim());
      if (entries.length) return formatValidationEntries(entries, fallback);
    }

    // 2. { errors: { "Request.Phone": ["msg"] } }
    if (json.errors && typeof json.errors === 'object' && !Array.isArray(json.errors)) {
      const entries = Object.entries(json.errors as Record<string, unknown>).flatMap(
        ([field, msgs]) =>
          (Array.isArray(msgs) ? msgs : [msgs])
            .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
            .map((message) => ({ field, message }))
      );
      if (entries.length) return formatValidationEntries(entries, fallback);
    }

    // 3. Single-message shapes.
    for (const key of ['message', 'detail', 'details', 'title', 'error']) {
      const value = json[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return fallback;
  }

  // Not JSON — use the raw text only if it looks human-readable
  const trimmed = text.trim();
  return trimmed && !/^[{[<]/.test(trimmed) ? trimmed : fallback;
}

/**
 * Normalizes an unknown thrown value (from a `catch` block) into a
 * human-readable string suitable for display in a toast / inline error.
 *
 * Service functions already throw `Error` instances carrying a message from
 * `parseApiError`, so the common path is `error.message`. This also tolerates
 * raw strings and falls back to a generic message for anything else.
 *
 * Usage:
 * ```ts
 * try { await createPet(input); }
 * catch (e) { showError(getErrorMessage(e)); }
 * ```
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
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

/**
 * One page of a list endpoint, with the counts needed to page through the rest.
 *
 * Mirrors the backend's `PaginationWrapper`. `extractPageItems` above throws this metadata away,
 * which is why every list in the app used to stop at its first page with no way to reach the
 * rest — and why raising `PerPage` looked like a fix. **The API caps `PerPage` at 200** (verified
 * live 2026-08-10: `PerPage=500` comes back `itemsPerPage: 200`), and `Paginate=false` only drops
 * the wrapper — it still returns at most one 200-row page, and a non-positive `Page`/`PerPage` is
 * normalised rather than rejected. So paging is the only way to see a long list.
 */
export interface PagedResult<T> {
  items: T[];
  /** Total rows matching the query, across all pages. */
  totalItems: number;
  totalPages: number;
  /** 1-based. */
  currentPage: number;
  itemsPerPage: number;
  /** Whether another page exists after `currentPage`. */
  hasMore: boolean;
}

/**
 * Reads a list response as a page. Tolerates an endpoint that returns a bare array (or one whose
 * wrapper is missing counts) by reporting a single complete page — so a caller can page uniformly
 * without knowing which shape it is getting.
 */
export function extractPage<T>(raw: unknown): PagedResult<T> {
  const items = extractPageItems<T>(raw);
  const obj = (Array.isArray(raw) ? {} : (raw as Record<string, unknown>)) ?? {};

  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  const currentPage = num(obj.currentPage, 1);
  const itemsPerPage = num(obj.itemsPerPage, items.length);
  const totalItems = num(obj.totalItems, items.length);
  // Derive rather than trust: a wrapper missing totalPages still pages correctly.
  const totalPages = num(
    obj.totalPages,
    itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1
  );

  return {
    items,
    totalItems,
    totalPages,
    currentPage,
    itemsPerPage,
    hasMore: currentPage < totalPages,
  };
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (__DEV__) {
    console.log('[API Request]', init?.method ?? 'GET', url, init?.body ?? '');
  }

  // Attach the active UI language so backend-produced text (validation messages,
  // notifications, emails) comes back localized. Callers can still override.
  const headers: Record<string, string> = {
    'Accept-Language': acceptLanguageHeader(),
    ...(init?.headers as Record<string, string>),
  };

  const response = await fetch(url, { ...init, headers });
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

// ─────────────────────────────────────────────────────────────────────────────
// Request helpers
//
// Every service function used to repeat the same six steps by hand: build the
// URL from `getApiBaseUrl()`, assemble a query string, call `apiAuthFetch`,
// check `response.ok`, throw `parseApiError(...)`, then unwrap the body. That
// boilerplate was ~90 copies of the same `if (!response.ok)` block, and each
// copy was a chance to forget the error context tag or the pagination unwrap.
//
// Use these instead of hand-rolling a `fetch` sequence. They compose the same
// primitives above, so behaviour (auth refresh, Accept-Language, dev logging,
// error resolution order) is identical — there is just one copy of it.
// ─────────────────────────────────────────────────────────────────────────────

/** A value that can appear in a query string. */
export type QueryValue = string | number | boolean | null | undefined;

/**
 * Builds a query string from a plain object, skipping keys that carry no value.
 *
 * `undefined`, `null` and `''` are omitted; `false` and `0` are kept, because
 * they are meaningful filter values (`IsActive=false`, `Page=0`). This matches
 * what the hand-written builders did with their mix of `!== undefined` and
 * truthiness checks.
 *
 * Keys are sent exactly as written — the API binds PascalCase parameter names,
 * and an unknown one binds to nothing rather than erroring, so a typo silently
 * returns unfiltered results. Check names against `/swagger/v1/swagger.json`.
 *
 * @returns The encoded query string WITHOUT a leading `?` (empty when nothing is set).
 */
export function buildQuery(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export interface ApiRequestOptions {
  /** HTTP method. Defaults to `GET`. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Query parameters — assembled with `buildQuery`, so empty values drop out. */
  query?: Record<string, QueryValue>;
  /**
   * Request body. A `FormData` instance is passed through untouched (the runtime
   * must set the multipart boundary); anything else is JSON-stringified.
   */
  body?: unknown;
  /** Message shown when the response carries nothing more specific. */
  fallback: string;
  /** Tag for the dev console log, e.g. `'getReviews'`. */
  context: string;
  /** Set for endpoints that take no Bearer token (the public `/auth/*` routes). */
  isPublic?: boolean;
}

/**
 * Performs a request against the API and returns the raw `Response`, throwing a
 * human-readable `Error` if the status is not ok. Prefer the typed wrappers
 * below (`apiJson` / `apiList` / `apiPage` / `apiVoid`) — reach for this only
 * when you need the `Response` itself (headers, streaming, a custom parse).
 *
 * @param path - API path beginning with a slash, e.g. `/api/reviews`.
 */
export async function apiRequest(path: string, options: ApiRequestOptions): Promise<Response> {
  const { method = 'GET', query, body, fallback, context, isPublic = false } = options;

  const queryString = query ? buildQuery(query) : '';
  const url = `${getApiBaseUrl()}${path}${queryString ? `?${queryString}` : ''}`;

  const isFormData = body instanceof FormData;

  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = isFormData ? (body as FormData) : JSON.stringify(body);
  }

  // `apiAuthFetch` sets the JSON headers itself; `apiFetch` does not, so a public
  // POST must declare them here or ASP.NET rejects the body with a 415. FormData
  // is left alone either way — the runtime sets its multipart boundary.
  if (isPublic && body !== undefined && !isFormData) {
    init.headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  }

  const response = await (isPublic ? apiFetch(url, init) : apiAuthFetch(url, init));

  if (!response.ok) {
    throw new Error(await parseApiError(response, fallback, context));
  }

  return response;
}

/** Request expecting a JSON object in the response body. */
export async function apiJson<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const response = await apiRequest(path, options);
  return (await response.json()) as T;
}

/**
 * Request expecting a list response — returns just the items, unwrapping the
 * pagination envelope via `extractPageItems`.
 */
export async function apiList<T>(path: string, options: ApiRequestOptions): Promise<T[]> {
  return extractPageItems<T>(await apiJson<unknown>(path, options));
}

/**
 * Request expecting a list response — returns one page with the counts needed to
 * fetch the next (for `usePagedList`).
 */
export async function apiPage<T>(
  path: string,
  options: ApiRequestOptions
): Promise<PagedResult<T>> {
  return extractPage<T>(await apiJson<unknown>(path, options));
}

/**
 * Request whose response body is irrelevant (`DELETE`, the `/admin/*` approve and
 * decline actions, the booking lifecycle transitions). The body is never read, so
 * this is safe against a `204 No Content` — calling `.json()` on one would throw.
 */
export async function apiVoid(path: string, options: ApiRequestOptions): Promise<void> {
  await apiRequest(path, options);
}
