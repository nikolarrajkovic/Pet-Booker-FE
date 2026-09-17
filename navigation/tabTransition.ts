import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Easing, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
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
 * ## Distance: the window width, which is never too short
 *
 * A scene is the whole window on the phone design, and the window minus the sidebar on the web
 * one — so the window width is exactly right on a phone and slightly generous on the web. That
 * asymmetry is deliberate, because the two ways of being wrong are not equally bad:
 *
 * - **Too short** and the scenes overlap, which is the ghosting this whole animation exists to
 *   avoid. Unacceptable.
 * - **Too long** and the incoming scene spends the start of the animation still off its own
 *   edge, which reads as lag. With `Easing.out` almost all the distance is covered in the first
 *   moments, so the sidebar's worth of overshoot hides in about 14ms of a 260ms slide.
 *
 * This used to subtract `SIDENAV_WIDTH.desktop` to get the web scene exactly. That was right
 * while the sidebar was a fixed 244px and wrong the moment it became `fit-content` (it is sized
 * by its labels now, so it varies with the language and is only capped at 280). Subtracting a
 * guess risks subtracting *too little*, which lands on the unacceptable side; the window width
 * cannot, whatever the sidebar does next.
 *
 * `useReducedMotion` opts out entirely rather than shortening the animation — someone who asked
 * the OS for less motion is not asking for a faster slide.
 *
 * ## Phone design only
 *
 * A slide is how a phone says "you moved sideways along a bar at the bottom of the screen" — the
 * gesture and the motion match. The web design has no such bar: tabs are rows in a permanent
 * sidebar, and clicking one is a jump to a destination, not a swipe to a neighbour. Sliding a
 * whole page in from the edge on every sidebar click reads as a page transition the user did not
 * ask for, and the sidebar itself stays still while the content flies past it — the two disagree.
 * So the web design cuts, which is what it did before this animation existed.
 */
export function useTabSlideOptions(): TabSlideOptions {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { isWebLayout } = useResponsive();

  if (reduced || isWebLayout) return { animation: 'none' };

  const sceneWidth = Math.max(1, width);

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
