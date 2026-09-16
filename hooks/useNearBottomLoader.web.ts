import { useEffect, useRef } from 'react';

/** Distance from the bottom, in px, at which the next page starts loading. */
const THRESHOLD = 320;

/**
 * The nearest ancestor that actually scrolls vertically, or null when the document does.
 *
 * Matched on computed overflow rather than on a marker class or attribute, so it keeps working
 * whichever element ends up owning the scroll.
 */
function findScrollParent(from: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = from.parentElement;
  while (node && node !== document.body) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Loads the next page as the reader nears the bottom — on the web design's **page** scroller.
 *
 * **Why this exists.** A paged list normally watches its own `ScrollView`'s `onScroll`
 * (`LoadMoreFooter.isNearBottom`). On the web design that handler never fires: `ScreenLayout` owns
 * a single full-width scroll pane and `styles/document-scroll.web.ts` deliberately *flattens*
 * every screen's own `ScrollView` into it, so the list never scrolls — the page does. The result
 * was an "infinite" scroll that simply stopped at the first page on desktop, with only the footer
 * button to go further. This listens to the element that actually moves.
 *
 * It finds that element by walking up from the list itself and taking the first ancestor that
 * actually scrolls — not by looking for `ScreenLayout`'s `[data-page-scroll]` marker. Which
 * element owns the scroll depends on whether that flattening rule is in effect, and the marker is
 * not always in the rendered tree; resolving it from computed overflow works under either model,
 * and walking up (rather than querying the document) picks THIS screen's scroller, where React
 * Navigation keeps several mounted at once.
 *
 * The effect re-runs whenever `onLoadMore` changes identity — which `usePagedList` does on every
 * loading-state change — so the listener always closes over fresh state, and the immediate call
 * covers the case where a freshly-appended page still leaves the reader within the threshold.
 * `usePagedList.loadMore` swallows the repeat calls a scroll gesture inevitably produces.
 */
export function useNearBottomLoader(
  enabled: boolean,
  onLoadMore: () => void
): React.MutableRefObject<any> {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;
    // In react-native-web a View's ref IS the DOM node.
    const node = ref.current as HTMLElement | null;
    if (!node) return;

    const scroller = findScrollParent(node);
    const target: HTMLElement | Window = scroller ?? window;

    const check = () => {
      const [offset, viewport, total] = scroller
        ? [scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight]
        : [window.scrollY, window.innerHeight, document.documentElement.scrollHeight];
      if (offset + viewport >= total - THRESHOLD) onLoadMore();
    };

    target.addEventListener('scroll', check, { passive: true });
    // A list shorter than the viewport is already "at the bottom" and would otherwise never
    // trigger — the reader has nothing left to scroll.
    check();
    return () => target.removeEventListener('scroll', check);
  }, [enabled, onLoadMore]);

  return ref;
}
