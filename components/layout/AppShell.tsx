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
   * Whether someone is signed in. A guest browsing (app review G7) gets the shell too, with the
   * guest navigation; the sign-in screens themselves stay full-page and bare.
   */
  signedIn: boolean;
};

/** The sign-in screens: full-page, no navigation around them. */
const AUTH_ROUTES = new Set(['Login', 'Register', 'VerifyEmail', 'ForgotPassword', 'AcceptInvite']);

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
 * On the phone design, on the sign-in screens and on a full-bleed route there is no chrome: the
 * wrappers are plain flex boxes that draw nothing, so those screens look exactly as they did when
 * this returned bare `children` for them.
 *
 * ## The tree above the navigator never changes shape
 *
 * Every case renders the same three wrappers and only adds or removes the sidebar, the top bar and
 * the pattern inside them. It used to return bare `children` for the chrome-less cases and the
 * wrapped tree otherwise, and React reads a different parent as a different component: each move
 * between the two (Register → the Legal page, Search → Sign in, a tab → the partner celebration,
 * a window resized across the breakpoint) unmounted the whole navigator and built it again. Every
 * screen in the stack lost its state on the way — a half-filled sign-up came back empty.
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
export default function AppShell({ children, signedIn }: AppShellProps) {
  const { isWebLayout } = useResponsive();
  const { hex } = useThemeColors();
  // Subscribed to unconditionally: hooks cannot be called behind a branch, and the listener is a
  // single subscription on a ref the app already keeps.
  const activeRoute = useCurrentRouteName();

  const chrome =
    isWebLayout &&
    // Signed out, bare until the route is known (a cold start on /login must not flash the shell)
    // and on the sign-in screens themselves.
    !(!signedIn && (!activeRoute || AUTH_ROUTES.has(activeRoute))) &&
    // The route on screen wants the whole window.
    !(activeRoute && FULL_BLEED_ROUTES.has(activeRoute));

  // One shape for every case (see "The tree above the navigator never changes shape" above): the
  // chrome comes and goes as siblings *before* `children`, so the navigator keeps its place.
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: chrome ? hex.bg : undefined,
      }}>
      {chrome ? <SideNav activeRoute={activeRoute} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {chrome ? <TopBar /> : null}
        {/* `minHeight: 0` is what lets the navigator scroll inside this row instead of growing
            the page — without it a long screen pushes the whole shell taller than the window and
            the sidebar scrolls away with it. */}
        <PatternBackground hidden={!chrome} style={{ minHeight: 0 }}>
          {children}
        </PatternBackground>
      </View>
    </View>
  );
}
