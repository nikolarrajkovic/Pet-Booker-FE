import { useRef } from 'react';

/**
 * Loads the next page as the reader nears the bottom of the page scroller.
 *
 * **Native is a no-op.** On a phone the screen's own `ScrollView` is the scroll pane, so
 * `LoadMoreFooter`'s `isNearBottom` on its `onScroll` already does this. The returned ref exists
 * only so callers can attach it unconditionally.
 *
 * The web build has a different scroll model entirely — see `useNearBottomLoader.web.ts`.
 */
export function useNearBottomLoader(
  _enabled: boolean,
  _onLoadMore: () => void
): React.MutableRefObject<any> {
  return useRef<any>(null);
}
