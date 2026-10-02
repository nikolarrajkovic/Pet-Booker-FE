import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

/**
 * The provider's Group requests inbox: it pages from the server per tab, Accept goes through the
 * service picker and lands on the booking it created, and a lost race (someone else accepted
 * first) surfaces the server's message and re-reads the list rather than leaving a dead card.
 */

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

const mockGetPage = jest.fn();
const mockCount = jest.fn();
const mockAccept = jest.fn();
const mockDecline = jest.fn();

jest.mock('../services/group-booking-requests', () => {
  const actual = jest.requireActual('../services/group-booking-requests');
  return {
    ...actual,
    getGroupBookingRequestsPage: (...args: unknown[]) => mockGetPage(...args),
    countGroupBookingRequests: (...args: unknown[]) => mockCount(...args),
    acceptGroupBookingRequest: (...args: unknown[]) => mockAccept(...args),
    declineGroupBookingRequest: (...args: unknown[]) => mockDecline(...args),
  };
});

jest.mock('../context/AuthContext', () => {
  const value = { currentUser: { id: 1, serviceProviderId: 77 } };
  return { useAuth: () => value };
});

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: mockShowSuccess, showInfo: jest.fn() }),
}));

jest.mock('../context/LocaleContext', () => {
  const value = {
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    tEnum: (_type: string, value: unknown) => String(value),
    language: 'en',
  };
  return { useLocale: () => value };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => react.useEffect(cb, [cb]),
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true }),
    useRoute: () => ({ params: {} }),
    // `usePagedList` reads it for its refocus refresh; no navigator here is fine.
    NavigationContext: react.createContext(undefined),
  };
});

import GroupRequestsScreen from '../screens/group-requests-screen/containers/GroupRequestsScreen';
import { withProviders } from './test-utils';
import {
  GroupBookingAudience,
  GroupBookingRequestView,
  GroupBookingResponse,
  GroupBookingStatus,
} from '../services/group-booking-requests';

const request = (id: number, petName: string, services = [{ serviceId: 5, name: 'Walk' }]) => ({
  id,
  userId: 9,
  userFirstName: 'Ana',
  petId: 3,
  petName,
  petSpecies: 1,
  petBreed: 'Lab',
  serviceType: 1,
  bookingFrom: '2026-11-20T10:00:00+00:00',
  bookingTo: '2026-11-20T11:00:00+00:00',
  city: 'Belgrade',
  paymentType: 1,
  audience: GroupBookingAudience.AnyEligible,
  status: GroupBookingStatus.Open,
  priceCurrency: 'RSD',
  onSaleOnly: false,
  requiredAddOnNames: [],
  createdAt: '2026-11-01T08:00:00Z',
  recipients: [],
  invitedCount: 0,
  declinedCount: 0,
  myResponse: GroupBookingResponse.Pending,
  myEligibleServices: services.map((s) => ({
    ...s,
    price: 900,
    currency: 'RSD',
    isPreselected: false,
    pricingOptions: [],
  })),
});

const page = (items: unknown[]) => ({
  items,
  totalItems: items.length,
  totalPages: 1,
  currentPage: 1,
  itemsPerPage: 20,
  hasMore: false,
});

describe('GroupRequestsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCount.mockResolvedValue(1);
    mockGetPage.mockResolvedValue(page([request(11, 'Rex'), request(12, 'Milo', [])]));
  });

  it('lists the inbox from the server, paged', async () => {
    render(withProviders(<GroupRequestsScreen />));
    expect(await screen.findByText(/Rex/)).toBeTruthy();
    expect(mockGetPage).toHaveBeenCalledWith(
      expect.objectContaining({ view: GroupBookingRequestView.Inbox, page: 1, perPage: 20 })
    );
    // A request none of the provider's services fits can only be declined.
    expect(screen.getByText('groupRequest.noFittingService')).toBeTruthy();
  });

  it('accepts with the chosen service and opens the booking it created', async () => {
    mockAccept.mockResolvedValue({
      ...request(11, 'Rex'),
      status: GroupBookingStatus.Fulfilled,
      bookingId: 501,
    });
    render(withProviders(<GroupRequestsScreen />));
    await screen.findByText(/Rex/);

    fireEvent.press(screen.getAllByText('requests.accept')[0]);
    fireEvent.press(await screen.findByText('groupRequest.acceptConfirm'));

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith(11, 5, null));
    await flush();
    expect(mockNavigate).toHaveBeenCalledWith('BookingDetails', { bookingId: 501 });
    expect(screen.queryByText(/Rex/)).toBeNull();
  });

  it('surfaces a lost race and re-reads the list', async () => {
    mockAccept.mockRejectedValue(new Error('This group request is no longer open.'));
    render(withProviders(<GroupRequestsScreen />));
    await screen.findByText(/Rex/);
    const callsBefore = mockGetPage.mock.calls.length;

    fireEvent.press(screen.getAllByText('requests.accept')[0]);
    fireEvent.press(await screen.findByText('groupRequest.acceptConfirm'));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('This group request is no longer open.')
    );
    await waitFor(() => expect(mockGetPage.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
