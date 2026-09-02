import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCurrentRouteName } from '../../navigation/navigateToNavItem';
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
 * Wraps the navigator in the web design's chrome: sidebar on the left, top bar above the content.
 *
 * **On mobile it renders `children` untouched** — the phone design is exactly what it was, and
 * this component adds one `useResponsive()` call to the tree.
 *
 * ## Why the shell wraps the navigator instead of living in `ScreenLayout`
 *
 * The obvious alternative is to have each screen draw its own sidebar, which is what the phone
 * does with `TabBar` today. That works on a phone because tab switches are instant
 * (`animation: 'none'`) — but stack pushes are not: they slide the incoming screen over the
 * outgoing one. A per-screen sidebar would slide in on top of the sidebar already on screen,
 * animating a second copy of the navigation across the window on every navigation.
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

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: hex.bg }}>
      <SideNav activeRoute={activeRoute} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TopBar />
        {/* `minHeight: 0` is what lets the navigator scroll inside this row instead of growing
            the page — without it a long screen pushes the whole shell taller than the window and
            the sidebar scrolls away with it. */}
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      </View>
    </View>
  );
}
