import { useContext, useEffect, useRef } from 'react';
import { NavigationContext } from '@react-navigation/native';

/**
 * Runs `onFocus` each time the surrounding screen is focused again — and does nothing at all
 * when there is no surrounding screen.
 *
 * Two differences from `useFocusEffect`, both of which matter for the data hooks that use this:
 *
 *  - **It does not fire on mount.** `useFocusEffect` runs on the first focus as well, which for a
 *    hook that already loads on mount means requesting the same thing twice on every screen open.
 *    Here, mount loads and focus refreshes — one job each.
 *  - **It is optional.** `useFocusEffect` calls `useNavigation`, which THROWS outside a navigator,
 *    so putting it inside a general-purpose hook silently makes that hook unusable anywhere else —
 *    in a shared component, or in a unit test rendering the hook on its own. Reading the context
 *    directly lets the behaviour degrade to "no focus refresh" instead of crashing.
 */
export function useScreenFocus(onFocus: () => void): void {
  const navigation = useContext(NavigationContext);
  // Held in a ref so an inline arrow — which is what every caller passes — doesn't resubscribe
  // on every render.
  const handler = useRef(onFocus);
  handler.current = onFocus;

  useEffect(() => {
    if (!navigation) return;
    return navigation.addListener('focus', () => handler.current());
  }, [navigation]);
}
