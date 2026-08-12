import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * The app's navigation container ref, as a module rather than a hook.
 *
 * Navigating in response to something that did not come from a screen — a tapped toast, a device
 * push, a hub event — needs the navigator from outside the tree. The contexts that receive those
 * live ABOVE `NavigationContainer`, so `useNavigation` is not available to them; a module-level
 * ref is the standard escape hatch and the only one that also works before any screen is mounted
 * (a cold start from a notification).
 *
 * `App.tsx` passes this to the container, so there is exactly one ref in the app.
 */
export const navigationRef = createNavigationContainerRef();

/**
 * Navigates from outside the tree, doing nothing if the navigator is not mounted yet.
 *
 * Route names are passed as plain strings: the container's generics are keyed to RootParamList,
 * which this app does not declare, and every call site in `App.tsx` casts through `any` for the
 * same reason. Silently no-op'ing beats throwing — the caller is an event handler, and losing a
 * navigation is better than crashing the app that received the push.
 */
export function navigateFromOutside(name: string, params?: object): void {
  if (!navigationRef.isReady()) return;
  // The typed overloads need a route name from RootParamList, which this app doesn't declare;
  // the structural signature is what the call actually is.
  (navigationRef.navigate as (screen: string, params?: object) => void)(name, params);
}
