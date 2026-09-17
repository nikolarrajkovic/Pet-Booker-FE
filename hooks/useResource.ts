import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  CacheEntry,
  DEFAULT_TTL_MS,
  ResourceKey,
  cacheKey,
  fetchInto,
  isStale,
  peek,
  put,
  subscribe,
} from '../services/cache';
import { getErrorMessage } from '../services/http';
import { useScreenFocus } from './useScreenFocus';

/**
 * Reads one server resource through the shared cache — the replacement for the
 * `useState` + `useEffect(load, [])` pair every container used to hand-roll.
 *
 * What it changes, beyond deduplicating that boilerplate:
 *
 *  - **Returning to a screen shows current data.** The screen stays mounted when you navigate
 *    away (see `services/cache.ts` for why), so it revalidates when it regains focus, when the
 *    app returns from the background, and the moment any write invalidates its resource.
 *  - **Revalidating does not blink.** `isLoading` is true only when there is nothing to render;
 *    a refresh over data already on screen reports through `isRefreshing`, which most screens can
 *    ignore entirely. This is what makes refresh-on-focus safe to apply everywhere — reloading
 *    from scratch with a spinner is exactly why it stayed opt-in before.
 *  - **Two screens reading the same thing make one request**, and both see the result.
 *
 * ```ts
 * const { data: booking, isLoading, error, refresh } = useResource(
 *   ['bookings', bookingId],
 *   () => getBooking(bookingId),
 *   { errorFallback: t('bookingDetails.loadFailed') }
 * );
 * ```
 *
 * `fetcher` may be a fresh closure on every render — it is read through a ref, so only the KEY
 * decides when to refetch. Put everything the request depends on in the key.
 */
export interface UseResourceOptions {
  /** When false nothing is fetched and the hook reports a settled, empty state. */
  enabled?: boolean;
  /** How long data is served before a focus or foreground triggers a background refresh. */
  ttlMs?: number;
  /**
   * Set false to load once and then hold still. For a screen that seeds an EDITABLE FORM from
   * what it fetched: a background refresh there would overwrite what the user is typing, so the
   * form screens opt out rather than silently discarding input.
   */
  revalidate?: boolean;
  /** Message used when a failure carries none. */
  errorFallback?: string;
}

export interface ResourceState<T> {
  data: T | undefined;
  /** Nothing to show yet — render a spinner. */
  isLoading: boolean;
  /** Refreshing data already on screen — usually ignorable. */
  isRefreshing: boolean;
  error: string | null;
  /** Force a refresh now (pull-to-refresh, or after an action this screen took). */
  refresh: () => void;
  /** Replaces the cached value in place, for an optimistic update. */
  setData: (data: T) => void;
}

export function useResource<T>(
  key: ResourceKey,
  fetcher: () => Promise<T>,
  options: UseResourceOptions = {}
): ResourceState<T> {
  const { enabled = true, ttlMs = DEFAULT_TTL_MS, revalidate = true, errorFallback } = options;

  const serialized = cacheKey(key);
  const storeKey = enabled ? serialized : null;

  // Read through refs so a re-created closure (every render, for an inline arrow) never counts as
  // a dependency change — only the key does.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;
  const fallbackRef = useRef(errorFallback);
  fallbackRef.current = errorFallback;

  const [isLoading, setIsLoading] = useState(() => enabled && !peek(serialized));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The cached entry drives rendering. `useSyncExternalStore` rather than a manual subscribe +
  // forceUpdate so a concurrent render cannot tear between two different versions of the entry.
  // Entry objects are replaced wholesale on write, so identity is a valid snapshot.
  const subscribeToKey = useCallback(
    (onChange: () => void) => (storeKey ? subscribe(storeKey, onChange) : () => {}),
    [storeKey]
  );
  const getSnapshot = useCallback(() => (storeKey ? peek<T>(storeKey) : undefined), [storeKey]);
  const entry = useSyncExternalStore<CacheEntry<T> | undefined>(
    subscribeToKey,
    getSnapshot,
    getSnapshot
  );

  // Guards against a response from a key we have since moved off (a screen whose id param
  // changed) landing in the new key's loading flags.
  const activeKey = useRef(storeKey);
  activeKey.current = storeKey;

  const run = useCallback(async (mode: 'initial' | 'background') => {
    const key = activeKey.current;
    if (!key) return;
    if (mode === 'initial') setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      await fetchInto(key, () => fetcherRef.current());
    } catch (e) {
      if (activeKey.current !== key) return;
      setError(getErrorMessage(e, fallbackRef.current));
    } finally {
      if (activeKey.current === key) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    const cached = storeKey ? peek(storeKey) : undefined;
    void run(cached ? 'background' : 'initial');
  }, [run, storeKey]);

  /** Fetches only when there is a reason to: nothing cached, or what is cached has gone stale. */
  const revalidateIfNeeded = useCallback(() => {
    if (!storeKey) return;
    const cached = peek(storeKey);
    if (!cached) {
      void run('initial');
      return;
    }
    if (revalidateRef.current && isStale(cached, ttlMs)) void run('background');
  }, [run, storeKey, ttlMs]);

  // First load, and every time the key changes (a different id, a changed filter).
  useEffect(() => {
    if (!storeKey) {
      setIsLoading(false);
      return;
    }
    revalidateIfNeeded();
  }, [storeKey, revalidateIfNeeded]);

  // A write elsewhere invalidated this resource — refresh underneath the user.
  useEffect(() => {
    if (!storeKey) return;
    return subscribe(storeKey, (reason) => {
      if (reason === 'invalidated' && revalidateRef.current) void run('background');
    });
  }, [storeKey, run]);

  // Coming back to the screen, and coming back to the app. The second matters more than it looks:
  // the other side of a booking acts while this app sits in the background, so returning to it is
  // the moment a stale screen is most likely to be wrong.
  useScreenFocus(revalidateIfNeeded);

  useEffect(() => {
    if (!storeKey) return;
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') revalidateIfNeeded();
    });
    return () => subscription.remove();
  }, [storeKey, revalidateIfNeeded]);

  const setData = useCallback(
    (data: T) => {
      if (storeKey) put(storeKey, data);
    },
    [storeKey]
  );

  return {
    data: entry?.data,
    // Cached data outranks the flag: a revalidation must never take the screen back to a spinner.
    isLoading: enabled && isLoading && entry === undefined,
    isRefreshing,
    error: entry === undefined ? error : null,
    refresh,
    setData,
  };
}
