import { useEffect, useState } from 'react';
import { Platform, type GestureResponderEvent } from 'react-native';
import { getPathFromState } from '@react-navigation/native';
import { navigateFromOutside, resetFromOutside, navigationRef } from './navigationRef';
import { linking } from './linking';
import type { NavItem } from './navItems';

/**
 * The web address a nav item opens — the `href` that makes a sidebar entry a real link, so it can
 * be middle-clicked, Ctrl/Cmd-clicked or opened from the context menu in a new tab. The entries
 * used to be press handlers only: the browser saw no link at all, and none of that worked.
 * Undefined off the web.
 */
export function navItemHref(item: NavItem): string | undefined {
  if (Platform.OS !== 'web' || !linking.config) return undefined;
  const route = { name: item.route, params: item.params };
  const state = item.isTab
    ? { routes: [{ name: 'MainTabs', state: { routes: [route] } }] }
    : { index: 1, routes: [{ name: 'MainTabs' }, route] };
  try {
    return getPathFromState(state as any, linking.config);
  } catch {
    return undefined;
  }
}

/**
 * `onPress` for a nav link: a plain click moves within the app (and stops the browser following
 * the href, which would reload the page); a click the browser means for a new tab or window —
 * Ctrl/Cmd or Shift held — is left to the browser. A middle click never reaches here (it is an
 * `auxclick`, not a `click`), so the browser opens the href for that one too.
 */
export function pressNavItem(item: NavItem | undefined, event?: GestureResponderEvent): void {
  if (Platform.OS === 'web' && event) {
    const click = event as unknown as MouseEvent;
    if (click.metaKey || click.ctrlKey || click.shiftKey) return;
    event.preventDefault();
  }
  navigateToNavItem(item);
}

/**
 * Navigates to a nav item from the shell, which sits **outside** the navigator.
 *
 * `AppShell` renders the sidebar and top bar as siblings of `Stack.Navigator`, not inside it, so
 * `useNavigation()` is unavailable there (it throws — there is no navigator above it). The
 * container ref is the supported way in, and it is already how pushes and toasts navigate.
 *
 * The tab/stack split matters: a tab route only exists **inside** `MainTabs`, so navigating to
 * `'Home'` from the root would find no such route and silently do nothing. Tab items are
 * addressed through their parent.
 */
export function navigateToNavItem(item: NavItem | undefined): void {
  if (!item) return;
  if (item.isTab) {
    navigateFromOutside('MainTabs', { screen: item.route, params: item.params });
    return;
  }
  // RESET rather than navigate for a stack destination.
  //
  // `navigate()` PUSHES, and the sidebar is always on screen, so every side-nav click stacked
  // another root route: visit Notifications then Settings and the stack is
  // [MainTabs, Notifications, Settings] — so Back from Settings went to Notifications, and the
  // deeper you browsed the further back "back" pointed. These are top-level destinations, not a
  // drill-down; going to one is a move, not a descent.
  //
  // Resetting to [MainTabs, route] keeps the stack two deep forever: Back (where it is still
  // shown) lands on the tabs, and a nested push from here — Settings → Change Password — still
  // pops correctly because it lands on top of this pair.
  //
  // MainTabs is left to its own initialRouteName, which is already role-aware (a managed
  // ProviderProfile opens on Partner Hub, everyone else on Home), so this does not strand a
  // provider on a tab their account cannot use.
  resetFromOutside({
    index: 1,
    routes: [{ name: 'MainTabs' }, { name: item.route, params: item.params }],
  });
}

/**
 * The name of the route currently on screen, tracked from outside the navigator.
 *
 * The shell needs this to mark the active sidebar item. `useNavigationState` is not available to
 * it for the same reason `useNavigation` isn't, so this subscribes to the container's `state`
 * event instead.
 *
 * Returns the **deepest** active route name, so a tab screen reports `'Home'` rather than
 * `'MainTabs'` — otherwise every tab would highlight as one item.
 */
export function useCurrentRouteName(): string | undefined {
  const [routeName, setRouteName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const read = () => {
      if (!navigationRef.isReady()) return;
      setRouteName(navigationRef.getCurrentRoute()?.name);
    };
    read();
    // Fires on every navigation, including the initial one resolved from a deep-linked URL.
    const unsubscribe = navigationRef.addListener('state', read);
    return unsubscribe;
  }, []);

  return routeName;
}
