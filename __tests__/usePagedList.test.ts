import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePagedList, type PagedListState } from '../hooks/usePagedList';
import type { PagedResult } from '../services/http';

/** One page of `n` numbered rows, tagged with which query produced it. */
function page(tag: string, pageNo: number, totalPages = 3): PagedResult<string> {
  return {
    items: [`${tag}-p${pageNo}-a`, `${tag}-p${pageNo}-b`],
    totalItems: totalPages * 2,
    totalPages,
    currentPage: pageNo,
    itemsPerPage: 2,
    hasMore: pageNo < totalPages,
  };
}

/** A fetcher whose promises resolve only when you say so, to hold a load "in flight". */
function deferredFetcher(tag: string) {
  const pending: { resolve: (p: PagedResult<string>) => void; page: number }[] = [];
  const fetchPage = jest.fn(
    (pageNo: number) =>
      new Promise<PagedResult<string>>((resolve) => pending.push({ resolve, page: pageNo }))
  );
  return {
    fetchPage,
    settleAll: async () => {
      const inFlight = pending.splice(0);
      await act(async () => {
        inFlight.forEach((p) => p.resolve(page(tag, p.page)));
      });
    },
    get calls() {
      return fetchPage.mock.calls.length;
    },
  };
}

describe('usePagedList', () => {
  it('loads page 1 once on mount', async () => {
    const f = deferredFetcher('q1');
    renderHook(() => usePagedList(f.fetchPage));
    await f.settleAll();
    expect(f.calls).toBe(1);
  });

  // The Notifications bug: the hook loads page 1 on mount and the screen ALSO reloads on focus,
  // so both fired on the first focus and one response was fetched then thrown away.
  it('does not double-fetch when a screen also reloads on focus', async () => {
    const f = deferredFetcher('q1');
    const { result } = renderHook(() => usePagedList(f.fetchPage));

    // The focus effect fires while the mount load is still in flight.
    act(() => result.current.reload());
    expect(f.calls).toBe(1);

    await f.settleAll();
    expect(f.calls).toBe(1);
    expect(result.current.items).toEqual(['q1-p1-a', 'q1-p1-b']);
  });

  // ...but deferring must never swallow a reload for a DIFFERENT query. This is the regression
  // the first version of the guard introduced: a filter changed mid-load left the old rows on
  // screen forever, because the new query's reload was skipped as "already loading".
  it('supersedes an in-flight load when the query changes', async () => {
    const first = deferredFetcher('old');
    const second = deferredFetcher('new');

    // Explicit generics: `initialProps` sits inside the options object, so TS cannot infer the
    // props type from the render callback alone.
    const { rerender, result } = renderHook<
      PagedListState<string>,
      { fetchPage: (page: number) => Promise<PagedResult<string>> }
    >(({ fetchPage }) => usePagedList(fetchPage), {
      initialProps: { fetchPage: first.fetchPage },
    });
    expect(first.calls).toBe(1);

    // The user changes a filter before page 1 has landed.
    rerender({ fetchPage: second.fetchPage });
    expect(second.calls).toBe(1);

    // The superseded response must not win, even though it arrives first.
    await first.settleAll();
    await second.settleAll();

    await waitFor(() => expect(result.current.items).toEqual(['new-p1-a', 'new-p1-b']));
    expect(result.current.items).not.toContain('old-p1-a');
  });

  it('a reload after the load settles does refetch', async () => {
    const f = deferredFetcher('q1');
    const { result } = renderHook(() => usePagedList(f.fetchPage));
    await f.settleAll();
    expect(f.calls).toBe(1);

    act(() => result.current.reload());
    await f.settleAll();
    expect(f.calls).toBe(2);
  });

  it('loadMore appends the next page and stops at the end', async () => {
    const f = deferredFetcher('q1');
    const { result } = renderHook(() => usePagedList(f.fetchPage));
    await f.settleAll();

    act(() => result.current.loadMore());
    await f.settleAll();
    expect(f.fetchPage).toHaveBeenLastCalledWith(2);
    expect(result.current.items).toEqual(['q1-p1-a', 'q1-p1-b', 'q1-p2-a', 'q1-p2-b']);

    act(() => result.current.loadMore());
    await f.settleAll();
    expect(result.current.hasMore).toBe(false);

    const callsAtEnd = f.calls;
    act(() => result.current.loadMore());
    expect(f.calls).toBe(callsAtEnd); // nothing left to fetch
  });

  it('a reload during an append still supersedes it', async () => {
    const f = deferredFetcher('q1');
    const { result } = renderHook(() => usePagedList(f.fetchPage));
    await f.settleAll();

    act(() => result.current.loadMore()); // page 2 in flight
    act(() => result.current.reload()); // must NOT defer to an append
    await f.settleAll();

    // Back to a single page-1 list, not page 1 + page 2 concatenated.
    await waitFor(() => expect(result.current.items).toEqual(['q1-p1-a', 'q1-p1-b']));
  });

  it('reports an error and empties the list when page 1 fails', async () => {
    const fetchPage = jest.fn(async () => {
      throw new Error('boom');
    });
    const { result } = renderHook(() =>
      usePagedList(fetchPage as any, { errorFallback: 'could not load' })
    );
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.items).toEqual([]);
  });

  it('fetches nothing while disabled, and clears rows when it flips off', async () => {
    const f = deferredFetcher('q1');
    const { rerender, result } = renderHook<PagedListState<string>, { enabled: boolean }>(
      ({ enabled }) => usePagedList(f.fetchPage, { enabled }),
      { initialProps: { enabled: false } }
    );
    expect(f.calls).toBe(0);
    expect(result.current.isLoading).toBe(false);

    rerender({ enabled: true });
    await f.settleAll();
    expect(result.current.items).toHaveLength(2);

    // Flipping off mid-session must clear, not defer to the load that already ran.
    rerender({ enabled: false });
    await waitFor(() => expect(result.current.items).toEqual([]));
  });
});
