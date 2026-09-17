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

  it('cuts rather than slides on the web design', () => {
    // A slide is how a PHONE says "you moved sideways along the bar at the bottom of the screen":
    // the motion matches the gesture. The web design has no such bar — tabs are rows in a
    // permanent sidebar, so clicking one is a jump to a destination, not a swipe to a neighbour.
    // Sliding a whole page in from the edge on every sidebar click reads as a transition nobody
    // asked for, and the sidebar sits still while the content flies past it.
    for (const size of ['desktop', 'tablet'] as const) {
      setViewport(size);
      const { result } = renderHook(() => useTabSlideOptions());

      expect(result.current.animation).toBe('none');
      // No interpolator at all — an inactive scene must not be parked off the edge, which is what
      // made the switch animate in the first place.
      expect(result.current.sceneStyleInterpolator).toBeUndefined();
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
