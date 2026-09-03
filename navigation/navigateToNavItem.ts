import { useEffect, useState } from 'react';
import { navigateFromOutside, navigationRef } from './navigationRef';
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
  } else {
    navigateFromOutside(item.route, item.params);
  }
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
