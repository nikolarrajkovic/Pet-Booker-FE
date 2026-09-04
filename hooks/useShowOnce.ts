import { useEffect, useState } from 'react';

/**
 * Keys already shown in this app session.
 *
 * Module-level rather than storage on purpose: a welcome message should greet you when you open
 * the app, not once in your lifetime. Persisting it would mean a returning user never sees it
 * again, and the first person to reinstall would wonder where it went. This resets on reload,
 * and explicitly on sign-out.
 */
const shown = new Set<string>();

/** Forget everything shown this session. Called on sign-out so the next account gets its own. */
export function resetShownOnce(): void {
  shown.clear();
}

/**
 * True the first time a given key is rendered in this app session, false every time after.
 *
 * Used for the Home welcome card: it belongs on the screen you land on, and becomes noise on the
 * twentieth visit — tab screens stay mounted in React Navigation, but coming back from a booking
 * flow remounts Home often enough that a permanent banner reads as clutter.
 *
 * ```tsx
 * const showWelcome = useShowOnce('home-welcome');
 * ```
 *
 * The key is marked as seen in an **effect**, not in the state initialiser: React re-invokes
 * initialisers under StrictMode, and marking it there would make the second invocation return
 * false and hide the banner on the very render that should show it.
 */
export function useShowOnce(key: string): boolean {
  const [show] = useState(() => !shown.has(key));

  useEffect(() => {
    shown.add(key);
  }, [key]);

  return show;
}
