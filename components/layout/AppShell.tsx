import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCurrentRouteName } from '../../navigation/navigateToNavItem';
import PatternBackground from '../shared/PatternBackground';
import SideNav from './SideNav';
import TopBar from './TopBar';

type AppShellProps = {
  children: ReactNode;
  /**
   * Whether to draw the shell at all. The auth screens (Login/Register/…) are full-page and have
   * no navigation to offer, so they render bare on every width.
   */
  enabled: boolean;
};

/**
 * Routes that take the whole window on the web design, chrome included.
 *
 * The shell is the right default — a page belongs beside the navigation that got the user to
 * it. A celebration is not a page: it is a full-bleed moment with one way forward, and drawn
 * inside the content column it became a green panel in the corner of the app with the sidebar,
 * the top bar and the page ground framing it, which is the opposite of the effect.
 *
 * Handled here rather than with `position: fixed` in the screen, because a fixed box is
 * positioned against the nearest transformed ancestor rather than the viewport — and the
 * navigator puts transforms on its scenes whenever anything animates. Unmounting the chrome
 * cannot be defeated by a transform that appears later.
 */
const FULL_BLEED_ROUTES = new Set(['PartnerWelcome']);

/**
 * Wraps the navigator in the web design's chrome: sidebar on the left, top bar above the content.
 *
 * **On mobile it renders `children` untouched** — the phone design is exactly what it was, and
 * this component adds one `useResponsive()` call to the tree.
 *
 * ## Why the shell wraps the navigator instead of living in `ScreenLayout`
 *
 * The obvious alternative is to have each screen draw its own sidebar. `TabBar` was mounted that
 * way once, and it is instructive that it could not stay: a navigation bar drawn *inside* a scene
 * travels with that scene, so it survives only as long as nothing animates. Stack pushes always
 * did — they slide the incoming screen over the outgoing one, so a per-screen sidebar would slide
 * a second copy of the navigation across the window on every push — and once tab switches became
 * a slide too, the bar had to move onto the tab navigator for the same reason (see
 * `navigation/tabTransition.ts`).
 *
 * Mounted here, the sidebar and top bar are outside the navigator entirely, so they never remount,
 * never animate, and hold their own state (an open account menu, the sidebar's scroll position)
 * across navigation. The cost is that neither can use `useNavigation`/`useNavigationState` — there
 * is no navigator above them — which is why both go through the container ref
 * (`navigation/navigateToNavItem.ts`).
 */
export default function AppShell({ children, enabled }: AppShellProps) {
  const { isWebLayout } = useResponsive();
  const { hex } = useThemeColors();
  // Subscribed to unconditionally: hooks cannot be called behind a branch, and the listener is a
  // single subscription on a ref the app already keeps.
  const activeRoute = useCurrentRouteName();

  if (!enabled || !isWebLayout) return <>{children}</>;
  // Same bare render as a signed-out screen: the route on screen wants the whole window.
  if (activeRoute && FULL_BLEED_ROUTES.has(activeRoute)) return <>{children}</>;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: hex.bg }}>
      <SideNav activeRoute={activeRoute} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TopBar />
        {/* `minHeight: 0` is what lets the navigator scroll inside this row instead of growing
            the page — without it a long screen pushes the whole shell taller than the window and
            the sidebar scrolls away with it. */}
        <PatternBackground style={{ minHeight: 0 }}>{children}</PatternBackground>
      </View>
    </View>
  );
}
