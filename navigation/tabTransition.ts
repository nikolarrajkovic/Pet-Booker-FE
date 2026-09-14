import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Easing, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { SIDENAV_WIDTH } from '../components/layout/SideNav';
import { useResponsive } from '../hooks/useResponsive';

/** How long a tab switch takes. Long enough to read as a direction, short enough not to wait. */
export const TAB_SLIDE_MS = 260;

export type TabSlideOptions = Pick<
  BottomTabNavigationOptions,
  'animation' | 'transitionSpec' | 'sceneStyleInterpolator'
>;

/**
 * Tab switches as a horizontal pager: the incoming tab slides in from the side it sits on in the
 * bar, and the outgoing one leaves the opposite way. Going Search → Home brings Home in from the
 * left, because Home is the tab to the left of Search.
 *
 * ## Why a slide and not a fade
 *
 * Tabs used to switch with `animation: 'none'` — a hard cut — after `'fade'` and `'shift'` were
 * both tried and dropped. Both of those **cross-fade** the two scenes, and the scenes are
 * siblings, so at the midpoint each one is partly transparent: every card border, shadow and
 * section outline of one screen shows through the other. That is a property of blending, not of
 * animating.
 *
 * A full-width slide has no such midpoint. The two scenes are always exactly one scene-width
 * apart, so they are adjacent rather than overlapping and neither is ever drawn through the
 * other — which is also why this is safe on the web design, where a scene is transparent and the
 * shell paints the ground behind it. The travel distance is therefore load-bearing: shorten it
 * (the way the built-in `'shift'` preset does, at 50px) and the screens overlap again.
 *
 * ## Distance
 *
 * A scene is as wide as the window on the phone design, and the window minus the sidebar on the
 * web one. Getting this wrong is not subtle: too short and the scenes overlap, too long and the
 * incoming screen spends the first part of the animation still off-screen, which reads as lag.
 *
 * `useReducedMotion` opts out entirely rather than shortening the animation — someone who asked
 * the OS for less motion is not asking for a faster slide.
 */
export function useTabSlideOptions(): TabSlideOptions {
  const { width } = useWindowDimensions();
  const { isWebLayout, isDesktop } = useResponsive();
  const reduced = useReducedMotion();

  if (reduced) return { animation: 'none' };

  const sidebar = isDesktop ? SIDENAV_WIDTH.desktop : SIDENAV_WIDTH.tablet;
  const sceneWidth = Math.max(1, isWebLayout ? width - sidebar : width);

  return {
    // Deliberately no `animation` name: naming one would pull in that preset's interpolator as
    // the default, and the pair below is the whole animation.
    transitionSpec: {
      animation: 'timing',
      config: { duration: TAB_SLIDE_MS, easing: Easing.out(Easing.cubic) },
    },
    // `progress` is -1 for a tab left of the active one, 0 for the active one, +1 for a tab to
    // its right — so mapping it straight onto x parks every inactive tab just off its own edge.
    sceneStyleInterpolator: ({ current }) => ({
      sceneStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-sceneWidth, 0, sceneWidth],
            }),
          },
        ],
      },
    }),
  };
}
