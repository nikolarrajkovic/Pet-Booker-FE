import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

/**
 * Lets every pending promise, state update and effect settle.
 *
 * Needed because the assertion here is a NEGATIVE one — "no second request was made" — and that
 * can only be judged once everything the handler scheduled has actually run. Asserting earlier
 * passes against both implementations, which makes the test worthless.
 */
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

/**
 * The render+click path for the "patch, don't refetch" change.
 *
 * The claim being tested is behavioural, not structural: tapping Accept must update the card the
 * partner is looking at using the booking the transition returned, WITHOUT re-listing every
 * booking they have. Asserting on `getBookings` call counts is the whole point — a refetch would
 * still turn the card green, so only the call count distinguishes the two implementations.
 */

// `mock`-prefixed because jest hoists the factories below above these declarations.
const mockGetBookings = jest.fn();
const mockConfirmBooking = jest.fn();
const mockDeclineBooking = jest.fn();

jest.mock('../services/bookings', () => {
  const actual = jest.requireActual('../services/bookings');
  return {
    ...actual, // keep applyBookingTransition, the enums and parseBookingDate real
    getBookings: (...args: unknown[]) => mockGetBookings(...args),
    confirmBooking: (...args: unknown[]) => mockConfirmBooking(...args),
    declineBooking: (...args: unknown[]) => mockDeclineBooking(...args),
  };
});

jest.mock('../context/AuthContext', () => {
  const value = { currentUser: { id: 1, serviceProviderId: 77 } };
  return { useAuth: () => value };
});

const mockShowError = jest.fn();
jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }),
}));

// The locale value must be STABLE across renders. The screen memoizes its loader on `t`, so a
// fresh function each render invalidates it, re-runs the focus effect, sets state, and loops —
// which shows up as the list being fetched over and over.
jest.mock('../context/LocaleContext', () => {
  const value = {
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    tEnum: (_type: string, value: unknown) => String(value),
    language: 'en',
  };
  return { useLocale: () => value };
});

// useFocusEffect must actually run its callback on mount, or nothing loads. React is required
// inside the factory because jest hoists it above the imports.
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => react.useEffect(cb, [cb]),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
  };
});

import NewRequestsScreen from '../screens/new-requests-screen/containers/NewRequestsScreen';
import { withProviders } from './test-utils';
import { BookingState, BookingStatusType } from '../services/bookings';

/** A pending request as GET /api/bookings returns it, includes and all. */
const pendingBooking = (id: number, petName: string) => ({
  id,
  userId: 9,
  serviceProviderId: 77,
  serviceId: 5,
  petId: 3,
  state: BookingState.Upcoming,
  currentStatus: BookingStatusType.ServiceRequestedByUser,
  cancelReason: null,
  bookingFrom: '2026-08-20T10:00:00+00:00',
  bookingTo: '2026-08-20T11:00:00+00:00',
  basePrice: 10,
  discountAmount: 0,
  totalPrice: 10,
  priceCurrency: 'RSD',
  paymentType: 0,
  paymentMethodId: 1,
  additionalServices: [],
  createdAt: '2026-08-13T08:00:00+00:00',
  updatedAt: '2026-08-13T08:00:00+00:00',
  user: { id: 9, userName: 'ana', email: 'ana@example.com', photos: [] },
  pet: { id: 3, name: petName, photos: [] },
  service: { id: 5, name: 'Morning walk', photos: [] },
  serviceProvider: { id: 77, name: 'Walkers Ltd', photos: [] },
});

describe('NewRequestsScreen — accepting a request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBookings.mockResolvedValue([pendingBooking(101, 'Rex'), pendingBooking(102, 'Milo')]);
  });

  it('renders the partner’s pending requests', async () => {
    render(withProviders(<NewRequestsScreen />));
    expect(await screen.findByText('Rex')).toBeTruthy();
    expect(screen.getByText('Milo')).toBeTruthy();
    expect(mockGetBookings).toHaveBeenCalledTimes(1);
    expect(mockGetBookings).toHaveBeenCalledWith(
      expect.objectContaining({ serviceProviderId: 77 })
    );
  });

  it('accepting patches the row from the response instead of re-listing every booking', async () => {
    mockConfirmBooking.mockResolvedValue({
      ...pendingBooking(101, 'Rex'),
      state: BookingState.Accepted,
      currentStatus: BookingStatusType.ServiceConfirmedByProvider,
      updatedAt: '2026-08-13T08:05:00+00:00',
    });

    render(withProviders(<NewRequestsScreen />));
    await screen.findByText('Rex');
    expect(mockGetBookings).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getAllByText('requests.accept')[0]);
    await waitFor(() => expect(mockConfirmBooking).toHaveBeenCalledWith(101));
    await flush();

    // The heart of it: the row moved without a second list call. Only checkable after the
    // flush — a refetch is scheduled *after* confirmBooking resolves, and mid-flight the list
    // is briefly hidden behind its loading state, so every earlier signal reads the same for
    // both implementations.
    expect(mockGetBookings).toHaveBeenCalledTimes(1);

    // And the row really moved out of the "new" tab, so it was patched rather than left alone.
    expect(screen.queryByText('Rex')).toBeNull();
    // The untouched request is still listed.
    expect(screen.getByText('Milo')).toBeTruthy();
  });

  it('keeps the card and surfaces the error when the transition fails', async () => {
    mockConfirmBooking.mockRejectedValue(new Error('Only pending bookings can be decided on.'));

    render(withProviders(<NewRequestsScreen />));
    await screen.findByText('Rex');

    fireEvent.press(screen.getAllByText('requests.accept')[0]);

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('Only pending bookings can be decided on.')
    );
    // Still pending, and still no refetch storm.
    expect(screen.getByText('Rex')).toBeTruthy();
    expect(mockGetBookings).toHaveBeenCalledTimes(1);
  });
});
