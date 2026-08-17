import { useCallback, useEffect, useRef, useState } from 'react';
import type { PagedResult } from '../services/http';
import { getErrorMessage } from '../services/http';

/**
 * Owns "a list that pages" — the accumulated rows, which page comes next, and the two distinct
 * loading states a paged list needs (first load vs appending).
 *
 * Every list in the app used to render page 1 and stop, so anything past the first 20–50 rows was
 * silently invisible; raising `PerPage` masked it until the API capped that at 200. This is the
 * shared behaviour so each screen doesn't re-derive it (and get the races wrong).
 *
 * Two hazards it handles, both of which produce duplicated or vanishing rows if you don't:
 *  - **Stale responses.** A reload triggered while a `loadMore` is in flight must win. Each run
 *    carries a generation token; a response from an older generation is dropped.
 *  - **Double-firing `loadMore`.** A button double-tap (or two scroll events) must not append the
 *    same page twice, so appends are gated on a ref, not on React state.
 *  - **A redundant `reload`.** The hook loads page 1 itself on mount, so a screen that also
 *    reloads on focus asks for it twice on the first focus. `reload` defers to a first-page load
 *    already in flight instead of superseding it, which is why consumers can call it freely.
 */
export interface PagedListState<T> {
  items: T[];
  /** First page is loading (show a spinner instead of the list). */
  isLoading: boolean;
  /** A further page is loading (keep the list, show a footer spinner). */
  isLoadingMore: boolean;
  error: string | null;
  /** Total rows matching the query across all pages — for "showing X of Y". */
  totalItems: number;
  hasMore: boolean;
  /** Appends the next page. No-op while loading or when the list is complete. */
  loadMore: () => void;
  /** Re-fetches from page 1, discarding what's loaded. */
  reload: () => void;
  /** Replaces the accumulated rows in place (e.g. after an optimistic update). */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * @param fetchPage Fetches one 1-based page. Must be stable — wrap it in `useCallback` with the
 *   query's own dependencies, since a change to it triggers a reload from page 1.
 * @param options.enabled When false, nothing is fetched and the list reports an empty, settled
 *   state — for a screen whose query isn't ready yet (no user id, no provider id).
 * @param options.errorFallback Message used when the failure carries none.
 */
export function usePagedList<T>(
  fetchPage: (page: number) => Promise<PagedResult<T>>,
  options?: { enabled?: boolean; errorFallback?: string }
): PagedListState<T> {
  const enabled = options?.enabled ?? true;
  const errorFallback = options?.errorFallback ?? 'Failed to load.';

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Next page to request, and the generation this hook is on. Refs, not state: both are read
  // inside async callbacks that must see the current value, not the one captured at render.
  const nextPage = useRef(1);
  const generation = useRef(0);
  // What is in flight, not merely whether something is. `reload` has to tell a first-page load
  // (which it can defer to) from an append (which it must supersede) — and, crucially, which
  // *query* is loading: deferring to a load for a query the caller has since changed would leave
  // the old rows on screen and never fetch the new ones.
  const inFlight = useRef<{ mode: 'replace' | 'append'; query: typeof fetchPage } | null>(null);

  const run = useCallback(
    async (page: number, mode: 'replace' | 'append') => {
      if (inFlight.current) return;
      inFlight.current = { mode, query: fetchPage };
      const gen = generation.current;

      if (mode === 'replace') {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const result = await fetchPage(page);
        // A newer reload started while this was in flight — its result is the truth, not ours.
        if (gen !== generation.current) return;

        setItems((prev) => (mode === 'append' ? [...prev, ...result.items] : result.items));
        setTotalItems(result.totalItems);
        setHasMore(result.hasMore);
        nextPage.current = result.currentPage + 1;
      } catch (e) {
        if (gen !== generation.current) return;
        // An append that fails leaves the rows already on screen alone — only the first page
        // replaces the list with an error state.
        setError(getErrorMessage(e, errorFallback));
        if (mode === 'replace') setItems([]);
      } finally {
        // Only the current generation owns the loading flags and the in-flight slot. A run that
        // has been superseded must not clear either — doing so used to hand `loadMore` a green
        // light while the reload that replaced it was still fetching page 1.
        if (gen === generation.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
          inFlight.current = null;
        }
      }
    },
    [fetchPage, errorFallback]
  );

  const reload = useCallback(() => {
    // A first-page load for THIS SAME query is already running — let it stand. This is the mount
    // load meeting a screen that also reloads on focus: both fire on the very first focus, and
    // superseding here fetched page 1 twice and threw the first response away.
    //
    // The query check is what keeps that safe. `fetchPage`'s identity IS the query (callers
    // memoize it on the filters), so a changed filter, a new rail or an id that just arrived
    // gives a different function — and must supersede, not be skipped. A *disabled* reload
    // supersedes too: it has to invalidate the load and clear the rows.
    if (enabled && inFlight.current?.mode === 'replace' && inFlight.current.query === fetchPage) {
      return;
    }
    // Bumping the generation invalidates anything in flight, so a slow page-3 response can't
    // append onto a freshly reloaded page 1.
    generation.current += 1;
    inFlight.current = null;
    nextPage.current = 1;
    if (!enabled) {
      setItems([]);
      setTotalItems(0);
      setHasMore(false);
      setError(null);
      setIsLoading(false);
      return;
    }
    void run(1, 'replace');
  }, [enabled, run, fetchPage]);

  const loadMore = useCallback(() => {
    if (!enabled || isLoading || isLoadingMore || !hasMore) return;
    void run(nextPage.current, 'append');
  }, [enabled, isLoading, isLoadingMore, hasMore, run]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    items,
    isLoading,
    isLoadingMore,
    error,
    totalItems,
    hasMore,
    loadMore,
    reload,
    setItems,
  };
}
