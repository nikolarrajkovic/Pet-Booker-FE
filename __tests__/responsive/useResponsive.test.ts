import { Platform, useWindowDimensions } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { BREAKPOINTS, byMode, modeForWidth, useResponsive } from '../../hooks/useResponsive';
import { setPlatform } from '../test-utils';

/**
 * The breakpoints themselves.
 *
 * Every other responsive test and every screen in the app hangs off this one function, so it is
 * worth pinning the boundaries **exactly** rather than at comfortable widths: an off-by-one here
 * shows up as a design that switches a pixel early on one class of device and nowhere else.
 */

const setWidth = (width: number) =>
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width, height: 900, scale: 2, fontScale: 1 });

const nativePlatform = Platform.OS;

// Every width case below is about the BROWSER target, which is the one where both designs exist.
// `jest-expo` defaults to a native platform, where `RESPONSIVE_ON_NATIVE` pins every width to the
// mobile design — so without this the whole file would assert 'mobile' six times over.
beforeEach(() => setPlatform('web'));

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform(nativePlatform as 'ios' | 'android' | 'web');
});

describe('modeForWidth — the boundaries', () => {
  it.each([
    [320, 'mobile'],
    [BREAKPOINTS.tablet - 1, 'mobile'],
    [BREAKPOINTS.tablet, 'tablet'],
    [BREAKPOINTS.desktop - 1, 'tablet'],
    [BREAKPOINTS.desktop, 'desktop'],
    [1920, 'desktop'],
  ])('%ipx resolves to %s', (width, expected) => {
    expect(modeForWidth(width as number)).toBe(expected);
  });
});

describe('useResponsive', () => {
  it('reports the mode and its derived flags together', () => {
    setWidth(1440);
    const { result } = renderHook(() => useResponsive());

    expect(result.current.mode).toBe('desktop');
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
    // `isWebLayout` is the flag screens branch on, so it must cover tablet as well as desktop.
    expect(result.current.isWebLayout).toBe(true);
  });

  it('treats a tablet as the web design, not the phone one', () => {
    setWidth(820);
    const { result } = renderHook(() => useResponsive());

    expect(result.current.mode).toBe('tablet');
    expect(result.current.isWebLayout).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('gives a phone-width browser the phone design', () => {
    setWidth(390);
    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isWebLayout).toBe(false);
  });

  it('only flags isWide past the wide breakpoint', () => {
    setWidth(BREAKPOINTS.wide - 1);
    expect(renderHook(() => useResponsive()).result.current.isWide).toBe(false);

    setWidth(BREAKPOINTS.wide);
    expect(renderHook(() => useResponsive()).result.current.isWide).toBe(true);
  });

  it('keeps a native build on the phone design however wide the device is', () => {
    // The gate that makes this true is a single constant (`RESPONSIVE_ON_NATIVE`). This test is
    // what will fail — loudly, and in one place — the day someone flips it, which is the point:
    // turning it on is a decision about every screen, not a tweak.
    setPlatform('android');
    setWidth(1440);

    const { result } = renderHook(() => useResponsive());
    expect(result.current.mode).toBe('mobile');
    expect(result.current.isWebLayout).toBe(false);
  });
});

describe('byMode', () => {
  it('picks the value for the current mode', () => {
    expect(byMode('mobile', { mobile: 1, tablet: 2, desktop: 3 })).toBe(1);
    expect(byMode('tablet', { mobile: 1, tablet: 2, desktop: 3 })).toBe(2);
    expect(byMode('desktop', { mobile: 1, tablet: 2, desktop: 3 })).toBe(3);
  });

  it('falls back to the narrower design when a level is omitted', () => {
    // Degrading toward mobile rather than to undefined is what makes a partially-specified value
    // safe: the worst case is the phone layout on a wide screen, not a crash.
    expect(byMode('desktop', { mobile: 1 })).toBe(1);
    expect(byMode('tablet', { mobile: 1, desktop: 3 })).toBe(1);
    expect(byMode('desktop', { mobile: 1, tablet: 2 })).toBe(2);
  });
});

// Guards the mock itself: if `useWindowDimensions` stopped being the hook's input, every test
// above would keep passing while asserting nothing.
it('derives the mode from useWindowDimensions', () => {
  const spy = setWidth(1024);
  renderHook(() => useResponsive());
  expect(spy).toHaveBeenCalled();
  expect(useWindowDimensions).toBe(spy);
});
