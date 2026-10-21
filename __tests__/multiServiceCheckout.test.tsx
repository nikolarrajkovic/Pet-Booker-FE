import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { withProviders } from './test-utils';

/**
 * Booking several different services in one checkout (feedback 2026-10-21): the booking form sets
 * appointments aside in the cart, and Review sends every service's appointments in one
 * all-or-nothing batch, each with its own provider and the customer's note.
 */

const mockCreateBookings = jest.fn(async (_inputs: unknown[]) => [] as unknown[]);
jest.mock('../services/bookings', () => ({
  ...jest.requireActual('../services/bookings'),
  createBookings: (inputs: unknown[]) => mockCreateBookings(inputs),
}));

jest.mock('../services/payment-methods', () => ({
  ensurePaymentMethodId: jest.fn(async () => 99),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 1 }, isPartner: false, isAdmin: false }),
}));

jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ showError: jest.fn(), showSuccess: jest.fn(), showInfo: jest.fn() }),
}));

jest.mock('../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown) => String(v),
    tPlural: (n: number) => String(n),
    language: 'en',
  };
  return { useLocale: () => value };
});

const walk = { id: 7, name: 'City Walk', serviceProviderId: 3, currency: 'RSD', photos: [] };
const groom = { id: 8, name: 'Full Groom', serviceProviderId: 5, currency: 'RSD', photos: [] };
const appointment = (
  id: number,
  service: { id: number; name: string },
  price: number,
  note?: string
) => ({
  id,
  pet: { id: 11, name: 'Rex', image: '' },
  service: { id: service.id, name: service.name, price },
  bookingFrom: '2026-11-02T10:00:00+00:00',
  bookingTo: '2026-11-02T11:00:00+00:00',
  total: price,
  addons: [],
  addonIds: [],
  note,
});

const mockNavigate = jest.fn();
let mockParams: unknown = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, canGoBack: () => true, goBack: jest.fn() }),
  useRoute: () => ({ name: 'ReviewBooking', key: 'k', params: mockParams }),
}));

import { BookingCartProvider, useBookingCart } from '../context/BookingCartContext';
import ReviewBookingScreen from '../screens/review-booking-screen/containers/ReviewBookingScreen';

afterEach(() => {
  jest.clearAllMocks();
});

describe('the booking cart', () => {
  it('keeps each service once, adding appointments to one already in it', () => {
    let cart: ReturnType<typeof useBookingCart> | null = null;
    const Probe = () => {
      cart = useBookingCart();
      return <Text>{cart.count}</Text>;
    };
    render(
      <BookingCartProvider>
        <Probe />
      </BookingCartProvider>
    );

    act(() => cart!.add(walk as any, [appointment(1, walk, 900) as any]));
    act(() => cart!.add(groom as any, [appointment(2, groom, 3000) as any]));
    act(() => cart!.add(walk as any, [appointment(3, walk, 900) as any]));

    expect(cart!.sections.map((s) => s.service.id)).toEqual([7, 8]);
    expect(cart!.count).toBe(3);
    // The form's own service joins the cart's section rather than repeating it.
    expect(
      cart!.withSection(groom as any, [appointment(4, groom, 3000) as any])[1].appointments
    ).toHaveLength(2);

    act(() => cart!.removeService(7));
    expect(cart!.count).toBe(1);
  });
});

describe('Review with several services', () => {
  beforeEach(() => {
    mockParams = {
      sections: [
        { service: walk, appointments: [appointment(1, walk, 900, 'Pulls on the lead.')] },
        { service: groom, appointments: [appointment(2, groom, 3000)] },
      ],
    };
  });

  it('shows each service and a grand total', async () => {
    render(withProviders(<ReviewBookingScreen />));
    await waitFor(() => expect(screen.getAllByText('City Walk').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Full Groom').length).toBeGreaterThan(0);
    expect(screen.getByText('Total for 2 appointments')).toBeTruthy();
    expect(screen.getByText('Note: Pulls on the lead.')).toBeTruthy();
  });

  it('books every service in one batch, each with its own provider and note', async () => {
    render(withProviders(<ReviewBookingScreen />));
    fireEvent.press(await screen.findByText('Confirm Booking'));
    await waitFor(() => expect(mockCreateBookings).toHaveBeenCalledTimes(1));

    const sent = mockCreateBookings.mock.calls[0][0] as {
      serviceId: number;
      serviceProviderId: number;
      note?: string;
    }[];
    expect(sent.map((b) => [b.serviceId, b.serviceProviderId])).toEqual([
      [7, 3],
      [8, 5],
    ]);
    expect(sent[0].note).toBe('Pulls on the lead.');
    expect(mockNavigate).toHaveBeenCalledWith('BookingConfirmed', { serviceName: '2 services' });
  });
});
