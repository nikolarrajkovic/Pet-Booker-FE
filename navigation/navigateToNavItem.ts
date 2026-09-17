import { useEffect, useState } from 'react';
import { navigateFromOutside, resetFromOutside, navigationRef } from './navigationRef';
import type { NavItem } from './navItems';

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
