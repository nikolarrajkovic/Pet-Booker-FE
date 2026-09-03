import { Platform, useWindowDimensions } from 'react-native';

/**
 * Breakpoints, in dp/CSS pixels. Deliberately the same numbers Tailwind uses for `md` and `lg`,
 * so a `className` breakpoint and a JS branch never disagree about where the layout changes.
 */
export const BREAKPOINTS = {
  /** Below this the app draws its phone design: bottom tab bar, one column, full-screen modals. */
  tablet: 768,
  /** At and above this the app draws its full web design: sidebar + top bar. */
  desktop: 1024,
  /** Above this the content column stops growing and the extra space becomes margin. */
  wide: 1440,
} as const;

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

/**
 * Whether a native build follows the width breakpoints too.
 *
 * `false` today: an Android/iOS build always gets the mobile design regardless of how wide the
 * device is, because the phone design is the shipped product and a tablet showing a sidebar has
 * never been tested. This is a single gate rather than a `Platform.OS` check scattered through
 * the screens **so that flipping it is the whole change** — the day an iPad build wants the
 * two-column design, every screen follows from here.
 */
const RESPONSIVE_ON_NATIVE = false;

/** The layout a given viewport width resolves to. Exported for tests and for `layoutModeFor`. */
export function modeForWidth(width: number): LayoutMode {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

export type Responsive = {
  /** Current viewport width in dp — the number the mode was derived from. */
  width: number;
  height: number;
  mode: LayoutMode;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Wider than `BREAKPOINTS.wide` — used to add a fourth grid column, nothing else. */
  isWide: boolean;
  /**
   * Tablet **or** desktop: "is this the web design?".
   *
   * Branch on this rather than `isDesktop` unless a screen genuinely needs the phone treatment
   * on a tablet — most differences (sidebar instead of tab bar, dialog instead of sheet, capped
   * content width) apply to both.
   */
  isWebLayout: boolean;
};

/**
 * Which of the app's two designs to render, decided by **window width, not platform**.
 *
 * ```
 *  <768px          768–1023px           >=1024px
 *  mobile          tablet               desktop
 *  bottom TabBar   collapsed icon rail  full sidebar + top bar
 *  1 column        2 columns            3–4 columns
 * ```
 *
 * Width rather than `Platform.OS === 'web'` because a phone browser must get the phone design —
 * shared booking links are opened on phones, and a sidebar at 390px is unusable. `Platform.OS`
 * stays the right check for *capability* differences (SecureStore vs localStorage,
 * react-native-maps vs the Maps JS API); using it for layout is exactly what produces a sidebar
 * on a handset.
 *
 * Backed by `useWindowDimensions`, so dragging a browser window across a breakpoint switches
 * designs live with no extra wiring.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  const mode: LayoutMode =
    Platform.OS !== 'web' && !RESPONSIVE_ON_NATIVE ? 'mobile' : modeForWidth(width);

  return {
    width,
    height,
    mode,
    isMobile: mode === 'mobile',
    isTablet: mode === 'tablet',
    isDesktop: mode === 'desktop',
    isWide: mode !== 'mobile' && width >= BREAKPOINTS.wide,
    isWebLayout: mode !== 'mobile',
  };
}

/**
 * Picks one of three values by layout mode, falling back leftward.
 *
 * ```ts
 * const columns = byMode(mode, { mobile: 1, tablet: 2, desktop: 3 });
 * const gap     = byMode(mode, { mobile: 12, desktop: 20 }); // tablet inherits mobile's 12
 * ```
 *
 * The fallback direction matters: an omitted `desktop` inherits `tablet` (else `mobile`), so a
 * partially-specified value degrades to the *narrower* design rather than to undefined.
 */
export function byMode<T>(mode: LayoutMode, values: { mobile: T; tablet?: T; desktop?: T }): T {
  if (mode === 'desktop') return values.desktop ?? values.tablet ?? values.mobile;
  if (mode === 'tablet') return values.tablet ?? values.mobile;
  return values.mobile;
}
