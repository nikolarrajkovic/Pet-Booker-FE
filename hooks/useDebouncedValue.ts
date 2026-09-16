import { useEffect, useState } from 'react';

/**
 * A value that settles `delay` ms after the last change.
 *
 * For filters that drive a network request. A chip toggle is one discrete change, but a price
 * slider emits a value per frame of the drag — feeding that straight into the query would fire a
 * search for every intermediate position, and because each one replaces the list from page 1, the
 * results would flicker through a dozen states before landing on the one the user asked for.
 *
 * Deliberately not a debounced *callback*: the query is derived from state, so debouncing the
 * state keeps the fetch a pure function of it and leaves no timer to cancel on unmount beyond the
 * one this owns.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
