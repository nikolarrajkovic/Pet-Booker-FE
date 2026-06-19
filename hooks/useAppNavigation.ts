import { useNavigation } from '@react-navigation/native';

/**
 * Navigation helpers that distinguish two intents the bare `goBack()` conflates:
 *
 * - **Back (history)** — `goUp()` pops the push history for linear drill-downs
 *   (Home → Detail → Book). Falls back to a tab if there's nothing to pop.
 * - **Done / Up (hierarchy)** — `resetToTab()` / `resetToScreen()` wipe the
 *   stack so a *completed* flow (booking, application, auth) can't be re-entered
 *   by pressing back. Use these on terminal screens instead of `navigate()`,
 *   which leaves the finished flow sitting in history underneath.
 *
 * See BACKEND_GAPS / CLAUDE.md navigation notes. Navigation is loosely typed
 * (`any`) to match the rest of the app, which has no RootStackParamList yet.
 */
export type MainTab = 'Home' | 'Search' | 'PartnerHub' | 'AdminDashboard' | 'Profile';

export function useAppNavigation() {
  const navigation = useNavigation<any>();

  /** Wipe the stack and land on MainTabs focused on `tab`. Use after a flow completes. */
  const resetToTab = (tab: MainTab = 'Home') =>
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', state: { routes: [{ name: tab }] } }],
    });

  /**
   * Wipe the stack to [MainTabs(tab), routeName] so the user lands on a stack
   * screen whose back button goes to the tab — not back into the finished flow.
   */
  const resetToScreen = (routeName: string, params?: object, tab: MainTab = 'Home') =>
    navigation.reset({
      index: 1,
      routes: [
        { name: 'MainTabs', state: { routes: [{ name: tab }] } },
        { name: routeName, params },
      ],
    });

  /** Wipe the (unauthenticated) stack down to a single auth route, e.g. after verify/reset. */
  const resetToAuth = (route: 'Login' | 'Register' = 'Login') =>
    navigation.reset({ index: 0, routes: [{ name: route }] });

  /** Go back in history, or fall back to a tab when there's nothing to pop. */
  const goUp = (fallbackTab: MainTab = 'Home') => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: fallbackTab });
  };

  return { navigation, resetToTab, resetToScreen, resetToAuth, goUp };
}
