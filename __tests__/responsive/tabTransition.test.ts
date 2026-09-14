import { Animated } from 'react-native';
import { renderHook } from '@testing-library/react-native';

import { useTabSlideOptions } from '../../navigation/tabTransition';
import { VIEWPORTS, setViewport, setPlatform } from '../test-utils';

/**
 * The tab slide's one load-bearing number is how far a scene travels.
 *
 * Tabs cross-faded before this and it looked wrong: the two scenes are siblings, so mid-switch
 * both are partly transparent and each screen's borders and shadows ghost through the other. A
 * slide avoids that **only while the two scenes stay at least one scene-width apart** — shorten
 * the travel and they overlap, and the ghosting is back with no fade in sight. So the distance is
 * asserted here rather than left to be eyeballed on one window size.
 */

/**
 * Resolve the interpolator at a given tab position: -1 = left of the active tab, 0 = active,
 * +1 = right of it. `__getValue` is Animated's own internal read — it is how you see the number
 * an interpolation currently holds without mounting anything, and it is not in the public types.
 */
type ResolvedScene = { transform: { translateX: { __getValue(): number } }[] };

function translateAt(options: ReturnType<typeof useTabSlideOptions>, progress: -1 | 0 | 1): number {
  const interpolator = options.sceneStyleInterpolator;
  if (!interpolator) throw new Error('expected a scene interpolator');
  const { sceneStyle } = interpolator({ current: { progress: new Animated.Value(progress) } });
  return (sceneStyle as unknown as ResolvedScene).transform[0].translateX.__getValue();
}

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform('web');
});

describe('useTabSlideOptions', () => {
  it('parks a tab one full scene-width off its own edge', () => {
    setViewport('mobile');
    const { result } = renderHook(() => useTabSlideOptions());

    // Home, sitting left of the active tab, waits off the left edge and slides in from there.
    expect(translateAt(result.current, -1)).toBe(-VIEWPORTS.mobile.width);
    expect(translateAt(result.current, 0)).toBe(0);
    expect(translateAt(result.current, 1)).toBe(VIEWPORTS.mobile.width);
  });

  it('never travels less than a scene-width, whatever the sidebar is doing', () => {
    // On the web design a scene is the window minus the sidebar, so the window width overshoots
    // slightly — deliberately. The sidebar is `fit-content` (sized by its labels, so it varies
    // with the language and is only capped), and a travel computed by subtracting a guess at its
    // width can come out SHORT, which puts the two scenes back on top of each other. Overshooting
    // cannot: it is bounded by the sidebar's width and hidden by the easing.
    for (const size of ['desktop', 'tablet'] as const) {
      setViewport(size);
      const { result } = renderHook(() => useTabSlideOptions());

      // The window is the widest a scene can possibly be — a scene is the window minus a
      // sidebar of some width, and that width is never negative. Clearing this bar clears
      // every real scene, which is the property that matters.
      expect(translateAt(result.current, 1)).toBeGreaterThanOrEqual(VIEWPORTS[size].width);
      expect(translateAt(result.current, -1)).toBeLessThanOrEqual(-VIEWPORTS[size].width);
    }
  });

  it('animates over a real duration rather than snapping', () => {
    setViewport('mobile');
    const { result } = renderHook(() => useTabSlideOptions());

    expect(result.current.transitionSpec?.animation).toBe('timing');
    // Naming an `animation` preset would pull in that preset's own interpolator as the default
    // and quietly replace the slide with a cross-fade.
    expect(result.current.animation).toBeUndefined();
  });
});
