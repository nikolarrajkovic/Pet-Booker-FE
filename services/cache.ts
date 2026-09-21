/**
 * A tiny server-state cache: one copy of each fetched resource, shared by every screen that asks
 * for it, plus the invalidation that tells those screens it changed.
 *
 * ## Why this exists
 *
 * React Navigation keeps a screen you navigate away from MOUNTED (`App.tsx` declares its stack
 * and tabs with no `unmountOnBlur` / `freezeOnBlur`), so its `useState` survives untouched. With
 * every screen owning a private copy of whatever it fetched in a mount effect, that meant:
 *
 *  - going back to a screen showed the data as it was when the screen first opened, forever —
 *    verified live against the running stack: renaming a service in SQL, then returning to the
 *    Search tab, issued **no request at all** and kept rendering the old name;
 *  - a write on one screen could not reach the same row held by another, because there was no
 *    shared copy to update — only two unrelated `useState`s;
 *  - the screens that *did* reload on focus reloaded from scratch with a spinner, which is why
 *    that pattern stayed opt-in instead of becoming the rule.
 *
 * The cache is what gives those three problems one answer: screens read the same entry, a write
 * marks it stale, and every mounted reader revalidates in the background while still showing what
 * it already had.
 *
 * ## Shape
 *
 * An entry is keyed by a **resource** (`'services'`, `'bookings'` — the API path segment) plus the
 * parameters that identify the query. Invalidation works on the resource, never the exact key, so
 * a write can say "bookings changed" without enumerating every filter combination anyone holds.
 *
 * Nothing here is React-aware; `hooks/useResource.ts` and `hooks/usePagedList.ts` are the bindings.
 */

/** How long a freshly fetched entry is served without a background refresh. */
export const DEFAULT_TTL_MS = 30_000;

type Listener = (reason: 'data' | 'invalidated') => void;

export interface CacheEntry<T = unknown> {
  data: T;
  /** When this data arrived. */
  fetchedAt: number;
  /** Set by `invalidate`: still renderable, but known to be behind. */
  stale: boolean;
}

const store = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<Listener>>();
/**
 * One promise per key while a fetch is running, so two screens mounting at once — or a mount
 * effect meeting a focus effect on the very first focus — make ONE request and share its result.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Deterministic serialization: object keys are sorted, so `{ a, b }` and `{ b, a }` are the same
 * query rather than two cache entries holding identical rows.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${k}:${stableStringify(v)}`).join(',')}}`;
}

/** A key names its resource first — everything after the resource identifies the query. */
export type ResourceKey = readonly [resource: string, ...params: unknown[]];

export function cacheKey(key: ResourceKey): string {
  const [resource, ...params] = key;
  return `${resource}|${params.map(stableStringify).join('|')}`;
}

function resourceOf(key: string): string {
  const separator = key.indexOf('|');
  return separator === -1 ? key : key.slice(0, separator);
}

function notify(key: string, reason: 'data' | 'invalidated'): void {
  const subscribers = listeners.get(key);
  if (!subscribers) return;
  // Copied first: a listener may unsubscribe (a screen unmounting on what it just read) while we
  // are iterating, and mutating the live set mid-loop skips whoever came after it.
  for (const listener of [...subscribers]) listener(reason);
}

export function peek<T>(key: string): CacheEntry<T> | undefined {
  return store.get(key) as CacheEntry<T> | undefined;
}

/** True when an entry should be refreshed — invalidated by a write, or simply old. */
export function isStale(entry: CacheEntry | undefined, ttlMs = DEFAULT_TTL_MS): boolean {
  if (!entry) return true;
  return entry.stale || Date.now() - entry.fetchedAt > ttlMs;
}

/** Stores data and wakes every reader of this key. */
export function put<T>(key: string, data: T): void {
  // Re-inserting moves the key to the end of the Map's iteration order, which is what makes
  // `evictIfOversized` a true least-recently-written eviction without a second index.
  store.delete(key);
  store.set(key, { data, fetchedAt: Date.now(), stale: false });
  evictIfOversized();
  notify(key, 'data');
}

/**
 * Upper bound on cached entries.
 *
 * Without one the cache only ever grows: a session that browses a few hundred services or
 * bookings would hold every one of them until sign-out. On a phone that is the kind of slow leak
 * nobody notices until the app is killed in the background, so the ceiling is set here rather
 * than left to chance. Generous enough that ordinary use never reaches it.
 */
const MAX_ENTRIES = 100;

/**
 * Drops the oldest entries once the store is over its limit — but **never one a mounted screen is
 * reading**. Evicting a subscribed key would pull the data out from under a screen currently
 * rendering it, turning it back into a spinner for no reason the user can see. Anything on screen
 * is by definition worth its memory; what gets dropped is what nothing is looking at.
 */
function evictIfOversized(): void {
  if (store.size <= MAX_ENTRIES) return;
  for (const key of store.keys()) {
    if (store.size <= MAX_ENTRIES) return;
    if (listeners.has(key)) continue;
    store.delete(key);
  }
}

/**
 * Listeners that care about a whole resource rather than one cached key — a paged list, which
 * accumulates its rows itself and so has no single entry to watch, but still has to know when
 * "bookings changed".
 */
const resourceListeners = new Map<string, Set<() => void>>();

export function subscribeResource(resource: string, listener: () => void): () => void {
  let subscribers = resourceListeners.get(resource);
  if (!subscribers) {
    subscribers = new Set();
    resourceListeners.set(resource, subscribers);
  }
  subscribers.add(listener);
  return () => {
    subscribers!.delete(listener);
    if (subscribers!.size === 0) resourceListeners.delete(resource);
  };
}

export function subscribe(key: string, listener: Listener): () => void {
  let subscribers = listeners.get(key);
  if (!subscribers) {
    subscribers = new Set();
    listeners.set(key, subscribers);
  }
  subscribers.add(listener);
  return () => {
    subscribers!.delete(listener);
    if (subscribers!.size === 0) listeners.delete(key);
  };
}

/**
 * Runs `fetcher` for this key unless an identical fetch is already in flight, in which case the
 * caller joins that one. The result is stored and broadcast; a failure stores nothing, so the
 * previous data keeps rendering instead of the screen going blank on a flaky network.
 */
export function fetchInto<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    try {
      const data = await fetcher();
      put(key, data);
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

/**
 * Writes that touch one resource almost always change what another one reports. Declared once
 * here rather than at each call site, because the call sites are `services/*.ts` functions that
 * have no idea which screens are mounted.
 *
 * Kept deliberately generous: a redundant background refresh costs one request on a screen the
 * user is already looking at, while a missing one is the bug this whole module exists to fix.
 */
const RESOURCE_FANOUT: Record<string, string[]> = {
  // A booking changes the provider's calendar, both dashboards, the "recently booked" rail and
  // the service's own free/busy — none of which live under /api/bookings.
  bookings: ['stats', 'home', 'services', 'app-notifications'],
  services: ['home', 'stats', 'service-providers'],
  'service-providers': ['services', 'home', 'stats'],
  // Rating and review count are rendered on the service row and the provider profile.
  reviews: ['services', 'service-providers', 'bookings', 'stats'],
  'service-discounts': ['services', 'home'],
  'service-pricing-options': ['services'],
  'service-schedules': ['services'],
  pets: ['bookings'],
  addresses: ['users', 'service-providers', 'bookings'],
  'user-notification-settings': ['users'],
  payments: ['bookings', 'stats'],
  chat: ['chat'],
};

/**
 * Marks everything held for these resources as stale and tells mounted readers to refresh.
 *
 * Entries are kept, not dropped: a stale row still renders while its replacement is on the way,
 * which is the difference between "the list updates" and "the list blinks".
 */
export function invalidate(resources: string | string[]): void {
  const requested = Array.isArray(resources) ? resources : [resources];
  const affected = new Set<string>();
  for (const resource of requested) {
    affected.add(resource);
    for (const related of RESOURCE_FANOUT[resource] ?? []) affected.add(related);
  }

  for (const [key, entry] of store) {
    if (!affected.has(resourceOf(key))) continue;
    entry.stale = true;
  }
  // Every key of an affected resource is notified, including ones with no entry yet (a screen
  // whose first load failed still holds a listener and should retry).
  for (const key of listeners.keys()) {
    if (affected.has(resourceOf(key))) notify(key, 'invalidated');
  }
  for (const [resource, subscribers] of resourceListeners) {
    if (!affected.has(resource)) continue;
    for (const listener of [...subscribers]) listener();
  }
}

/**
 * Drops everything. Called on sign-out: the next account must not be handed the previous one's
 * bookings, pets or messages out of a cache that outlives the session.
 */
export function clearCache(): void {
  store.clear();
  inFlight.clear();
  for (const key of listeners.keys()) notify(key, 'invalidated');
  for (const subscribers of resourceListeners.values()) {
    for (const listener of [...subscribers]) listener();
  }
}

/**
 * Maps an API path to the resource whose entries a write to it should invalidate.
 *
 * Both prefixes the API actually serves are handled: the generated CRUD sits under `/api/{resource}`,
 * while the booking lifecycle transitions (`/bookings/{id}/confirm`) and the moderation actions
 * (`/admin/reviews/approve`) do not carry the `/api` prefix at all.
 */
export function resourceForPath(path: string): string | null {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  if (segments.length === 0) return null;

  let head = segments[0].toLowerCase();
  let rest = segments.slice(1);
  if (head === 'api' || head === 'admin') {
    if (rest.length === 0) return null;
    head = rest[0].toLowerCase();
    rest = rest.slice(1);
  }

  // `/auth/*` is identity, not a CRUD resource: the only cached thing it moves is the profile.
  if (head === 'auth') return 'users';
  // `/payments/bookings/{id}/pay` — the resource that changed is the booking and its money.
  if (head === 'payments') return 'payments';
  return head;
}
