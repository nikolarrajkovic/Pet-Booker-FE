import React from 'react';
import { Platform } from 'react-native';
import { render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';

/**
 * Fixed insets so `useSafeAreaInsets` resolves without a native measurement pass — without
 * these the provider renders nothing on first pass and every screen under it stays blank.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Wraps a screen in the providers it reads but doesn't care about in a test.
 *
 * `ThemeProvider` is used for real rather than mocked: `useThemeColors` derives the whole palette
 * from it, and stubbing that would mean maintaining a second copy of the palette's shape in
 * every test file. Everything with a network or native surface behind it (auth, toasts, locale,
 * navigation) is mocked per test instead, since those are usually what a given test asserts on.
 */
export function withProviders(ui: React.ReactElement): React.ReactElement {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}

// ── Rendering at a chosen layout ─────────────────────────────────────────────────────────────

/** Viewports the two designs are tested at. Chosen to sit clear of the breakpoints, not on them. */
export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
} as const;

export type LayoutName = keyof typeof VIEWPORTS;

/**
 * Overrides `Platform.OS` for the current test. Restore it yourself, or let `setViewport` do it.
 *
 * `Platform.OS` is a getter on a frozen-ish module object, so it takes `defineProperty` rather
 * than assignment.
 */
export function setPlatform(os: 'web' | 'ios' | 'android'): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

/**
 * Forces the window size — and the platform — every subsequent render sees, which together pick
 * the design.
 *
 * **Mock `useWindowDimensions`, never `useResponsive`.** Stubbing the hook under test would make
 * every breakpoint assertion vacuous — the point is that the real hook maps a real width to the
 * right design. This reaches one level below it instead.
 *
 * The platform is forced to `'web'` because that is the target where **both** designs exist: a
 * phone browser draws the mobile one and a desktop browser the web one, and the width is what
 * separates them. Under `jest-expo` the default platform is native, where `RESPONSIVE_ON_NATIVE`
 * pins every width to the mobile design — so without this, a "desktop" render would silently be
 * a mobile render and every web assertion would be testing the wrong design. The native gate
 * itself is asserted directly in `useResponsive.test.ts`.
 */
export function setViewport(layout: LayoutName): void {
  const size = VIEWPORTS[layout];
  setPlatform('web');
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
    ...size,
    scale: 2,
    fontScale: 1,
  });
}

/** Renders at 390×844 — the phone design (bottom tab bar, one column, full-screen sheets). */
export function renderMobile(ui: React.ReactElement): RenderResult {
  setViewport('mobile');
  return render(withProviders(ui));
}

/** Renders at 1440×900 — the web design (sidebar, capped content column, dialogs). */
export function renderDesktop(ui: React.ReactElement): RenderResult {
  setViewport('desktop');
  return render(withProviders(ui));
}

/** Renders at 820×1180 — the tablet design (collapsed icon rail, two columns). */
export function renderTablet(ui: React.ReactElement): RenderResult {
  setViewport('tablet');
  return render(withProviders(ui));
}

type LayoutCase = {
  layout: LayoutName;
  /** True for tablet and desktop — the two widths that draw the web design. */
  isWeb: boolean;
  renderScreen: (ui: React.ReactElement) => RenderResult;
};

/**
 * Runs the same block once per design.
 *
 * The whole risk of shipping two layouts from one tree is a change that is correct in the design
 * you happened to be looking at and broken in the other. Writing "this must hold in both" has to
 * be cheaper than writing it twice, or nobody writes it at all — so assertions that hold
 * everywhere go in the body unguarded, and the ones that differ branch on `isWeb`, which puts the
 * *difference itself* in the test rather than leaving it as an assumption.
 *
 * ```tsx
 * describeBothLayouts('MyBookings', ({ renderScreen, isWeb }) => {
 *   it('lists the bookings', () => {
 *     renderScreen(<MyBookingsScreen />);
 *     expect(screen.getByText('Upcoming')).toBeTruthy();
 *     if (isWeb) expect(screen.queryByLabelText('Notifications')).toBeNull();
 *   });
 * });
 * ```
 */
export function describeBothLayouts(name: string, body: (ctx: LayoutCase) => void): void {
  const cases: LayoutCase[] = [
    { layout: 'mobile', isWeb: false, renderScreen: renderMobile },
    { layout: 'desktop', isWeb: true, renderScreen: renderDesktop },
  ];
  cases.forEach((ctx) => {
    describe(`${name} — ${ctx.layout} design`, () => body(ctx));
  });
}
