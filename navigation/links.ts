import { Platform, type GestureResponderEvent } from 'react-native';
import { getPathFromState } from '@react-navigation/native';
import { linking } from './linking';

/**
 * The web address of a screen opened over the tabs (a service, a provider, a booking form) — the
 * `href` that makes a card a real link, so it can be middle-clicked, Ctrl/Cmd-clicked or opened
 * from the context menu in a new tab. Undefined off the web, or for a screen with no URL.
 */
export function screenHref(route: string, params?: object): string | undefined {
  if (Platform.OS !== 'web' || !linking.config) return undefined;
  try {
    return getPathFromState(
      { index: 1, routes: [{ name: 'MainTabs' }, { name: route, params }] } as any,
      linking.config
    );
  } catch {
    return undefined;
  }
}

/**
 * `onPress` for a link: a plain click runs `go`, moving within the app (and stops the browser
 * following the href, which would reload the page); a click the browser means for a new tab or
 * window — Ctrl/Cmd or Shift held — is left to the browser. A middle click never reaches here (it
 * is an `auxclick`, not a `click`), so the browser opens the href for that one too.
 */
export function followLink(event: GestureResponderEvent | undefined, go: () => void): void {
  if (Platform.OS === 'web' && event) {
    const click = event as unknown as MouseEvent;
    if (click.metaKey || click.ctrlKey || click.shiftKey) return;
    event.preventDefault();
  }
  go();
}

/**
 * A card's `href` + `onPress` for opening `route`: spread it on the card. A card made a link must
 * hold no button of its own — a click on one would follow the link too.
 */
export function linkTo(
  navigation: { navigate: (...args: any[]) => void },
  route: string,
  params?: object
): { href?: string; onPress: (event?: GestureResponderEvent) => void } {
  return {
    href: screenHref(route, params),
    onPress: (event) => followLink(event, () => navigation.navigate(route, params)),
  };
}
