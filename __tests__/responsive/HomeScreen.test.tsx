import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
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

jest.mock('../../context/NotificationsContext', () => ({
  useNotifications: () => ({ unreadCount: 2, refreshUnreadCount: jest.fn(), subscribe: jest.fn() }),
}));
jest.mock('../../context/MessagesContext', () => ({
  useMessages: () => ({ unreadCount: 1, refreshUnreadCount: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), canGoBack: () => false, goBack: jest.fn() }),
  useRoute: () => ({ name: 'Home', key: 'k', params: undefined }),
  // The screen loads in `useFocusEffect`; in a test there is no navigator to report focus, so
  // this stands in for "the screen is focused now".
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = jest.requireActual('react');
    React.useEffect(cb, []);
  },
}));

import HomeScreen from '../../screens/home-screen/containers/HomeScreen';
import { resetShownOnce } from '../../hooks/useShowOnce';

beforeEach(() => {
  // The welcome banner shows once per app session, so without this the first render in the file
  // consumes the flag and every later one asserts against a screen that has hidden it.
  resetShownOnce();
});

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
