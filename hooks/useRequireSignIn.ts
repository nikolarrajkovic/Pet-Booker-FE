import { useCallback } from 'react';
import { Platform } from 'react-native';
import { getPathFromState, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { linking } from '../navigation/linking';
import { navigationRef } from '../navigation/navigationRef';
import { rememberDeepLink } from '../navigation/pendingDeepLink';

/** The page on screen as a link path ("services/42"), to come back to after signing in. */
function currentPagePath(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.pathname + window.location.search;
  }
  const state = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
  return state && linking.config ? getPathFromState(state as any, linking.config) : null;
}

/**
 * Wraps an action only a signed-in user can take — booking, messaging, a group request — for the
 * pages a guest can browse (app review G7). Signed in, the action runs. A guest is sent to sign in
 * instead, with the page remembered, so signing in (or signing up) brings them back to it.
 */
export function useRequireSignIn() {
  const { isLoggedIn } = useAuth();
  const navigation = useNavigation<any>();

  return useCallback(
    (action: () => void) => {
      if (isLoggedIn) {
        action();
        return;
      }
      rememberDeepLink(currentPagePath());
      navigation.navigate('Login');
    },
    [isLoggedIn, navigation]
  );
}
