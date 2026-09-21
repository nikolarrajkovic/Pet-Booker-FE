import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { describeBothLayouts, setPlatform } from '../test-utils';

/**
 * Home is the screen whose two designs differ most structurally: four horizontal rails on a
 * phone, four grid sections on a desktop, with a different header on each.
 *
 * What is worth asserting is not the pixels but that **nothing is lost in either direction** —
 * every rail still renders its services, and the chrome the shell already provides is not drawn a
 * second time by the screen.
 */

const service = (id: number, name: string) => ({
  id,
  name,
  basicServiceName: 'Sitter',
  type: 0,
  price: 2500,
  currency: 'RSD',
  rating: 4.5,
  totalRatingNumber: 12,
  imageUrl: null,
  photos: [],
  serviceProviderId: 7,
});

const mockGetMostPopular = jest.fn(async () => [service(1, 'Sunny Sitters')]);
const mockGetOnSale = jest.fn(async () => [service(2, 'Deal Walkers')]);
const mockGetRecentlyBooked = jest.fn(async () => [service(3, 'Repeat Groomers')]);
const mockGetNearMe = jest.fn(async () => [service(4, 'Local Boarders')]);

jest.mock('../../services/home', () => ({
  getMostPopular: (...a: unknown[]) => mockGetMostPopular(...(a as [])),
  getOnSale: (...a: unknown[]) => mockGetOnSale(...(a as [])),
  getRecentlyBooked: (...a: unknown[]) => mockGetRecentlyBooked(...(a as [])),
  getNearMe: (...a: unknown[]) => mockGetNearMe(...(a as [])),
}));

jest.mock('../../hooks/useLocation', () => ({
  useLocation: () => ({
    latitude: 44.8,
    longitude: 20.4,
    address: 'Belgrade, Serbia',
    loading: false,
  }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isPartner: false,
    isAdmin: false,
    currentUser: { id: 1, firstName: 'Ana', lastName: 'Petrović' },
  }),
}));

jest.mock('../../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown, fallback?: string) => fallback ?? String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

const mockNotificationsValue = {
  unreadCount: 2,
  refreshUnreadCount: jest.fn(),
  subscribe: jest.fn(),
};
const mockMessagesValue = { unreadCount: 1, refreshUnreadCount: jest.fn() };

// Returned by identity, not rebuilt per render: the screen's badge effect depends on these
// functions, so a fresh jest.fn() each time would re-run it on every render forever.
jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => mockNotificationsValue,
}));
jest.mock('../../context/MessagesContext', () => ({
  useMessages: () => mockMessagesValue,
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), canGoBack: () => false, goBack: jest.fn() }),
  useRoute: () => ({ name: 'Home', key: 'k', params: undefined }),
  // The screen loads in `useFocusEffect`; in a test there is no navigator to report focus, so
  // this stands in for "the screen is focused now". Keyed on the callback, which is how the real
  // hook behaves — each call site wraps it in useCallback, so a changed dependency re-runs the
  // effect. Pinning `[]` here made Retry untestable: the refetch could never fire.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = jest.requireActual('react');
    React.useEffect(cb, [cb]);
  },
}));

import HomeScreen from '../../screens/home-screen/containers/HomeScreen';

afterEach(() => {
  jest.clearAllMocks();
  setPlatform('web');
});

describeBothLayouts('HomeScreen', ({ renderScreen, isWeb }) => {
  it('renders every rail’s services', async () => {
    renderScreen(<HomeScreen />);

    // The rails are the screen. A grid that silently drops its items, or a rail that renders
    // none, looks like "no results" rather than like a bug.
    await waitFor(() => expect(screen.getByText('Sunny Sitters')).toBeTruthy());
    expect(screen.getByText('Deal Walkers')).toBeTruthy();
    expect(screen.getByText('Repeat Groomers')).toBeTruthy();
    expect(screen.getByText('Local Boarders')).toBeTruthy();
  });

  it('shows the category pills in both designs', async () => {
    renderScreen(<HomeScreen />);

    await waitFor(() => expect(screen.getByLabelText('Browse Sitter services')).toBeTruthy());
    expect(screen.getByLabelText('Browse Groomer services')).toBeTruthy();
  });

  it('keeps the location line, which "Near You" is ranked against', async () => {
    renderScreen(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Belgrade, Serbia')).toBeTruthy());
  });

  it('draws the bell and messages icons only on the phone design', async () => {
    // B3. On the web design the TopBar carries both, so a screen drawing its own would put two
    // bells and two message icons on the page — each with its own badge.
    renderScreen(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Sunny Sitters')).toBeTruthy());

    if (isWeb) {
      expect(screen.queryByLabelText('Notifications, 2 unread')).toBeNull();
      expect(screen.queryByLabelText('Messages, 1 unread')).toBeNull();
    } else {
      expect(screen.getByLabelText('Notifications, 2 unread')).toBeTruthy();
      expect(screen.getByLabelText('Messages, 1 unread')).toBeTruthy();
    }
  });

  it('offers a way into each full list, however the rail is laid out', async () => {
    // Mobile ends each rail with a "See more" card; web puts a "See all" link in the section
    // header. Different affordance, same capability — losing it on one design strands the user
    // with whatever three services the rail happened to show.
    renderScreen(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Sunny Sitters')).toBeTruthy());

    const label = isWeb ? 'See All: Most Popular' : 'See More: Most Popular';
    expect(screen.getByLabelText(label)).toBeTruthy();
  });
});

describeBothLayouts('HomeScreen empty rails', ({ renderScreen }) => {
  /**
   * Every rail is drawn, cards or no cards. A row that deleted itself when it was empty took its
   * heading with it, so the page's sections moved around between loads and a reader could not
   * tell a row with nothing in it from a row this build does not have — and on a wide window the
   * page silently collapsed from four sections to one.
   *
   * What the row says depends on WHY it is empty: an empty catalogue is a fact about the
   * catalogue, a dead request is worth a Retry, and the two must not be confused.
   */

  it('keeps a rail that came back empty, and says why', async () => {
    mockGetNearMe.mockResolvedValueOnce([]);
    renderScreen(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('Sunny Sitters')).toBeTruthy());
    expect(screen.getByText('Near You')).toBeTruthy();
    expect(screen.getByText('Nothing near you yet')).toBeTruthy();
    // The other rails are unaffected — one empty row is not a page-wide state.
    expect(screen.getByText('Deal Walkers')).toBeTruthy();
  });

  it('offers a Retry on a rail whose request failed, and only there', async () => {
    mockGetOnSale.mockRejectedValueOnce(new Error('boom'));
    renderScreen(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('Sunny Sitters')).toBeTruthy());
    expect(screen.getByText('Special Deals')).toBeTruthy();
    expect(screen.getByText('Couldn’t load services')).toBeTruthy();
    // "No deals right now" is a claim about the catalogue, and a request that never answered is
    // no evidence for it.
    expect(screen.queryByText('No deals right now')).toBeNull();
    expect(screen.getByLabelText('Retry: Special Deals')).toBeTruthy();
    // The rows that loaded are untouched, and carry no Retry of their own.
    expect(screen.getByText('Local Boarders')).toBeTruthy();
    expect(screen.queryByLabelText('Retry: Near You')).toBeNull();
  });

  it('keeps Recently Booked, which a first-time user needs explained', async () => {
    mockGetRecentlyBooked.mockResolvedValueOnce([]);
    renderScreen(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('Sunny Sitters')).toBeTruthy());
    expect(screen.getByText('Recently Booked')).toBeTruthy();
    expect(screen.getByText('Nothing booked yet')).toBeTruthy();
  });

  it('still shows all four sections when no row loaded anything', async () => {
    mockGetMostPopular.mockResolvedValueOnce([]);
    mockGetOnSale.mockResolvedValueOnce([]);
    mockGetRecentlyBooked.mockResolvedValueOnce([]);
    mockGetNearMe.mockResolvedValueOnce([]);
    renderScreen(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('Nothing near you yet')).toBeTruthy());
    expect(screen.getByText('Recently Booked')).toBeTruthy();
    expect(screen.getByText('Near You')).toBeTruthy();
    expect(screen.getByText('Most Popular')).toBeTruthy();
    expect(screen.getByText('Special Deals')).toBeTruthy();
    // Nothing failed, so nothing offers a retry.
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('calls a failure a failure when nothing loaded at all', async () => {
    mockGetMostPopular.mockRejectedValueOnce(new Error('network'));
    mockGetOnSale.mockRejectedValueOnce(new Error('network'));
    mockGetRecentlyBooked.mockRejectedValueOnce(new Error('network'));
    mockGetNearMe.mockRejectedValueOnce(new Error('network'));
    renderScreen(<HomeScreen />);

    await waitFor(() => expect(screen.getAllByText('Couldn’t load services').length).toBe(4));
    expect(screen.queryByText('Nothing near you yet')).toBeNull();
  });

  it('retries every row from a rail’s Retry', async () => {
    mockGetMostPopular.mockRejectedValueOnce(new Error('network'));
    mockGetOnSale.mockRejectedValueOnce(new Error('network'));
    mockGetRecentlyBooked.mockRejectedValueOnce(new Error('network'));
    mockGetNearMe.mockRejectedValueOnce(new Error('network'));
    renderScreen(<HomeScreen />);

    await waitFor(() => expect(screen.getByLabelText('Retry: Most Popular')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Retry: Most Popular'));

    // The rows answer from one host, so they fail together: a retry that refetched only its own
    // row would leave the reader pressing four buttons to reload one page.
    await waitFor(() => expect(screen.getByText('Sunny Sitters')).toBeTruthy());
    expect(screen.getByText('Local Boarders')).toBeTruthy();
  });
});
