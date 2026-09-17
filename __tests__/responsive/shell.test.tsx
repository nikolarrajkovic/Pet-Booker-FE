import React from 'react';
import { Text, View } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { withProviders, setViewport, setPlatform } from '../test-utils';

/**
 * The shell: which navigation each design draws, and that it is never both at once.
 *
 * These assertions are the reason the two-design approach is safe to work in. Everything else in
 * the app can be checked by looking at it; "the phone's tab bar is ALSO rendering behind the
 * sidebar" is the class of bug that only shows at one window width, on one platform, in a build
 * nobody opened.
 */

// `mock`-prefixed so jest's hoisting of the factories below is legal.
const mockNavigate = jest.fn();
const mockReset = jest.fn();
let mockCurrentRoute: string | undefined = 'Home';

jest.mock('../../navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => ({ name: mockCurrentRoute }),
    addListener: () => () => undefined,
  },
  navigateFromOutside: (...args: unknown[]) => mockNavigate(...args),
  resetFromOutside: (...args: unknown[]) => mockReset(...args),
}));

let mockRoles = { isPartner: false, isAdmin: false };
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    ...mockRoles,
    currentUser: { id: 1, firstName: 'Ana', lastName: 'Petrović', email: 'ana@example.com' },
    signOut: jest.fn(),
  }),
}));

// The real English dictionary, so the tests assert on the strings a user actually sees rather
// than on key names — a label that stops resolving should fail here, not render "profile.pets".
jest.mock('../../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown) => String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => ({ unreadCount: 3, refreshUnreadCount: jest.fn(), subscribe: jest.fn() }),
}));
jest.mock('../../context/MessagesContext', () => ({
  useMessages: () => ({ unreadCount: 0, refreshUnreadCount: jest.fn() }),
}));

// TabBar navigates with the screen's own navigator rather than the container ref.
const mockTabNavigate = jest.fn();
let mockTabRoute = 'Home';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockTabNavigate, canGoBack: () => false, goBack: jest.fn() }),
  useRoute: () => ({ name: mockTabRoute, key: 'k', params: undefined }),
}));

import AppShell from '../../components/layout/AppShell';
import TabBar from '../../components/shared/TabBar';
import ScreenLayout from '../../components/shared/ScreenLayout';

const Body = () => <Text>screen body</Text>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRoles = { isPartner: false, isAdmin: false };
  mockCurrentRoute = 'Home';
  mockTabRoute = 'Home';
});

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform('web');
});

describe('AppShell', () => {
  it('draws the sidebar and top bar on the web design', () => {
    setViewport('desktop');
    render(
      withProviders(
        <AppShell enabled>
          <Body />
        </AppShell>
      )
    );

    expect(screen.getByLabelText('Main navigation')).toBeTruthy();
    expect(screen.getByLabelText('Account')).toBeTruthy();
    expect(screen.getByText('screen body')).toBeTruthy();
  });

  it('draws neither on the phone design', () => {
    setViewport('mobile');
    render(
      withProviders(
        <AppShell enabled>
          <Body />
        </AppShell>
      )
    );

    expect(screen.queryByLabelText('Main navigation')).toBeNull();
    expect(screen.queryByLabelText('Account')).toBeNull();
    // The screen itself must still render — the shell is chrome, not a gate.
    expect(screen.getByText('screen body')).toBeTruthy();
  });

  it('draws no chrome for a signed-out user, however wide the window', () => {
    // The auth screens are full-page and have no navigation to offer; a sidebar with every
    // destination behind a login is worse than useless, it is a list of dead links.
    setViewport('desktop');
    render(
      withProviders(
        <AppShell enabled={false}>
          <Body />
        </AppShell>
      )
    );

    expect(screen.queryByLabelText('Main navigation')).toBeNull();
    expect(screen.getByText('screen body')).toBeTruthy();
  });
});

describe('SideNav — role gating', () => {
  const renderShell = () =>
    render(
      withProviders(
        <AppShell enabled>
          <Body />
        </AppShell>
      )
    );

  it('shows a plain user the primary and manage groups only', () => {
    setViewport('desktop');
    renderShell();

    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('My Bookings')).toBeTruthy();
    expect(screen.queryByLabelText('Partner')).toBeNull();
    expect(screen.queryByLabelText('Admin')).toBeNull();
    // A group with no visible items must not leave its heading behind.
    expect(screen.queryByText('PARTNER')).toBeNull();
  });

  it('adds the partner group for a partner', () => {
    mockRoles = { isPartner: true, isAdmin: false };
    setViewport('desktop');
    renderShell();

    expect(screen.getByLabelText('Partner')).toBeTruthy();
    expect(screen.getByLabelText('My Schedule')).toBeTruthy();
    expect(screen.queryByLabelText('Admin')).toBeNull();
  });

  it('adds the admin group for an admin', () => {
    mockRoles = { isPartner: false, isAdmin: true };
    setViewport('desktop');
    renderShell();

    expect(screen.getByLabelText('Admin')).toBeTruthy();
    expect(screen.getByLabelText('Reviews')).toBeTruthy();
    expect(screen.queryByLabelText('Partner')).toBeNull();
  });

  it('addresses a tab route through MainTabs and RESETS to a stack route', () => {
    // B1. A tab route exists only INSIDE the tab navigator, so navigating to 'Home' from the root
    // finds nothing and silently does nothing — the failure mode is a dead sidebar link, with no
    // error anywhere. This is the assertion that catches it.
    setViewport('desktop');
    renderShell();

    fireEvent.press(screen.getByLabelText('Home'));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'Home',
      params: undefined,
    });

    // A stack destination RESETS rather than pushes. The sidebar never goes away, so pushing grew
    // the root stack by one route per click and "back" ended up pointing at whichever nav item was
    // visited previously. Resetting pins the stack at [MainTabs, route] however much you browse.
    fireEvent.press(screen.getByLabelText('My Bookings'));
    expect(mockReset).toHaveBeenCalledWith({
      index: 1,
      routes: [{ name: 'MainTabs' }, { name: 'MyBookings', params: undefined }],
    });
  });

  it('marks the item for the route currently on screen', () => {
    mockCurrentRoute = 'MyPets';
    setViewport('desktop');
    renderShell();

    expect(screen.getByLabelText('My Pets').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Home').props.accessibilityState.selected).toBe(false);
  });
});

describe('TabBar', () => {
  it('renders the phone design’s bar below the breakpoint', () => {
    setViewport('mobile');
    render(withProviders(<TabBar />));

    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Profile')).toBeTruthy();
  });

  it('renders nothing on the web design', () => {
    // Two navigations on one screen is the obvious failure of running both designs from one tree:
    // the bar would sit across the bottom of the window with the sidebar beside it.
    setViewport('desktop');
    render(withProviders(<TabBar />));

    expect(screen.queryByLabelText('Home')).toBeNull();
  });

  it('navigates with the navigator’s own object, not the enclosing screen’s', () => {
    // Mounted as the tab navigator’s `tabBar`, this bar renders OUTSIDE every tab scene, so
    // `useNavigation()` resolves to the root stack — which has no `Search`, `Home` or
    // `Profile` route. Tapping a tab then only logged "was not handled by any navigator" and
    // went nowhere. The navigator passes its own navigation in; that is the one to use.
    setViewport('mobile');
    const tabNavigate = jest.fn();
    render(
      withProviders(
        <TabBar
          state={
            {
              index: 0,
              routes: [{ name: 'Home', key: 'home' }],
            } as any
          }
          navigation={{ navigate: tabNavigate } as any}
        />
      )
    );

    fireEvent.press(screen.getByLabelText('Search'));

    expect(tabNavigate).toHaveBeenCalledWith('Search', expect.anything());
    expect(mockTabNavigate).not.toHaveBeenCalled();
  });

  it('gates the same routes the sidebar does', () => {
    // Both read navItems.ts. Asserting the gating twice is what would catch the two drifting
    // apart if one of them ever grew its own list.
    mockRoles = { isPartner: true, isAdmin: false };
    setViewport('mobile');
    render(withProviders(<TabBar />));

    expect(screen.getByLabelText('Partner')).toBeTruthy();
    expect(screen.queryByLabelText('Admin')).toBeNull();
  });
});

describe('ScreenLayout', () => {
  it('uses the green app header on the phone design', () => {
    setViewport('mobile');
    render(
      withProviders(
        <ScreenLayout headerTitle="My Bookings" showNotificationButton>
          <Body />
        </ScreenLayout>
      )
    );

    expect(screen.getByText('My Bookings')).toBeTruthy();
    expect(screen.getByText('screen body')).toBeTruthy();
    // B3: on a phone the bell is part of the screen's own header.
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });

  it('drops the per-screen bell on the web design', () => {
    // B3. The TopBar owns the bell there, and rendering both puts two on the same page — the
    // kind of duplication that is invisible unless you look at exactly this width.
    setViewport('desktop');
    render(
      withProviders(
        <ScreenLayout headerTitle="My Bookings" showNotificationButton>
          <Body />
        </ScreenLayout>
      )
    );

    expect(screen.getByText('My Bookings')).toBeTruthy();
    expect(screen.queryByLabelText('Notifications')).toBeNull();
  });

  it('offers a back affordance in both designs on a NESTED screen', () => {
    // B2. Different chrome, same capability — a screen that can be reached must be leavable
    // whichever design drew it. ChangePassword is nested (Settings → Change Password) and is not
    // a sidebar destination, so both designs keep the affordance.
    mockTabRoute = 'ChangePassword';

    setViewport('mobile');
    const mobile = render(
      withProviders(
        <ScreenLayout headerTitle="Details" showBackButton>
          <Body />
        </ScreenLayout>
      )
    );
    expect(mobile.getByLabelText('Back')).toBeTruthy();
    mobile.unmount();

    setViewport('desktop');
    render(
      withProviders(
        <ScreenLayout headerTitle="Details" showBackButton>
          <Body />
        </ScreenLayout>
      )
    );
    expect(screen.getByLabelText('Back')).toBeTruthy();
  });

  it('hides back on the web design for a screen the sidebar links to', () => {
    // A sidebar destination is top-level on the web design: the sidebar is permanently on screen
    // and is how you get there, so "Back" above the title promises a parent page that does not
    // exist. It was worse than cosmetic before the sidebar started resetting — the root stack grew
    // one route per click, so Back pointed at whichever nav item had been visited previously.
    mockTabRoute = 'Notifications';

    setViewport('desktop');
    const web = render(
      withProviders(
        <ScreenLayout headerTitle="Notifications" showBackButton>
          <Body />
        </ScreenLayout>
      )
    );
    expect(web.queryByLabelText('Back')).toBeNull();
    web.unmount();

    // The phone design's bar carries only the PRIMARY items, and Notifications is not one — it is
    // pushed from Profile, so removing back there would strand the user.
    setViewport('mobile');
    render(
      withProviders(
        <ScreenLayout headerTitle="Notifications" showBackButton>
          <Body />
        </ScreenLayout>
      )
    );
    expect(screen.getByLabelText('Back')).toBeTruthy();
  });

  it('hides back on the phone design for a bottom-bar tab', () => {
    // The mirror of the rule above for the other design. Profile is in the tab bar, so it is
    // top-level there and has nothing to go back TO — yet it drew a back circle, because the rule
    // used to be a per-screen judgement call and this screen passed `showBackButton` flat.
    mockTabRoute = 'Profile';

    setViewport('mobile');
    const phone = render(
      withProviders(
        <ScreenLayout headerTitle="Profile" showBackButton>
          <Body />
        </ScreenLayout>
      )
    );
    expect(phone.queryByLabelText('Back')).toBeNull();
    phone.unmount();

    setViewport('desktop');
    render(
      withProviders(
        <ScreenLayout headerTitle="Profile" showBackButton>
          <Body />
        </ScreenLayout>
      )
    );
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('renders header extras and the body in both designs', () => {
    setViewport('desktop');
    render(
      withProviders(
        <ScreenLayout
          headerTitle="Promotions"
          headerChildren={
            <View>
              <Text>filter tabs</Text>
            </View>
          }
          webHeaderRight={<Text>New offer</Text>}>
          <Body />
        </ScreenLayout>
      )
    );

    expect(screen.getByText('filter tabs')).toBeTruthy();
    expect(screen.getByText('New offer')).toBeTruthy();
    expect(screen.getByText('screen body')).toBeTruthy();
  });

  it('skips the page header entirely when the screen owns its viewport', () => {
    setViewport('desktop');
    render(
      withProviders(
        <ScreenLayout headerTitle="Live session" webBare>
          <Body />
        </ScreenLayout>
      )
    );

    expect(screen.queryByText('Live session')).toBeNull();
    expect(screen.getByText('screen body')).toBeTruthy();
  });
});
