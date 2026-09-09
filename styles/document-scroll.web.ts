/**
 * Makes the page's scrollbar sit at the window edge rather than inside the layout.
 *
 * Every React Native Web `ScrollView` is its own scroll pane. On a phone that is exactly right —
 * the screen *is* the window. On the web design it meant each screen scrolled inside the
 * width-capped content column, so the scrollbar appeared floating in the middle of the page and
 * the browser's own scrollbar never appeared at all.
 *
 * The obvious fix — letting the *document* scroll — does not work here: React Navigation renders
 * its screen cards absolutely positioned, so screen content contributes nothing to the height of
 * anything above it and the shell can never grow past the viewport, however much of RNW's
 * viewport pinning is undone. The navigator needs a definite-height container.
 *
 * So the app stays viewport-tall (which also keeps the sidebar and top bar in place with no
 * sticky positioning), and instead `ScreenLayout` owns a single full-width scroller whose
 * scrollbar lands on the window edge. This rule is the other half: it stops each screen's own
 * ScrollView from being a second, narrower scroll pane inside that one.
 *
 * Only the vertical axis is released. Horizontal rails and filter rows are ScrollViews too, and
 * CSS promotes `overflow-y: visible` back to `auto` whenever `overflow-x` is not `visible`, so
 * they keep scrolling sideways while no longer clipping vertically.
 *
 * `!important` throughout because RNW injects its own sheet lazily at first render — after this
 * runs — so an equal-specificity rule here would lose the cascade. The class is RNW's atomic
 * class for `-webkit-overflow-scrolling`, which nothing but a ScrollView sets.
 *
 * Kept in a `.web` module so it lives with the code that depends on it, and so Metro leaves it
 * out of the native bundle entirely — which is also why no `Platform.OS` branch is needed.
 */
// Deliberately not `!important`. A screen that genuinely needs its own scroll pane — the chat
// thread, whose header and composer belong at the top and bottom of the view — opts out with an
// inline style, and an inline style only beats a stylesheet rule when that rule is not
// `!important`. There is no DOM hook to exempt it with instead: RNW forwards neither `id`,
// `nativeID` nor `dataSet` through a ScrollView.
//
// Injected from an effect rather than at import for the same reason: RNW injects its own sheet
// lazily at first render, and with no `!important` to lean on, this has to land after it.
const CSS = [
  '[class*="r-WebkitOverflowScrolling"] {',
  '  flex: none;',
  '  height: auto;',
  '  max-height: none;',
  '  overflow-y: visible;',
  '}',
].join('\n');

export function enableDocumentScroll(): void {
  if (typeof document === 'undefined') return;

  const id = 'petbooker-document-scroll';
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = CSS;
  document.head.appendChild(style);
}
