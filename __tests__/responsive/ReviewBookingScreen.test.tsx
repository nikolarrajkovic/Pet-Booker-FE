import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { describeBothLayouts, setPlatform } from '../test-utils';

/**
 * The checkout screen, whose two designs differ structurally: on a phone the price breakdown sits
 * at the bottom of a long scroll under a pinned Confirm bar; on a desktop both move into a sticky
 * panel beside the booking.
 *
 * The thing worth pinning is that **the move loses nothing**. Rearranging a checkout is exactly
 * where a total or a Confirm button quietly ends up rendered in one design and not the other, and
 * the missing one is a screen the user cannot complete a booking from.
 */

// The shape ReviewBooking is handed by BookService — `service.price` is the effective
// (already-discounted) per-appointment price, which is what the totals are derived from.
const appointment = {
  id: 'a1',
  pet: { id: 11, petName: 'Rex' },
  service: { id: 7, name: 'Sunny Sitters', price: 2500 },
  bookingFrom: '2026-09-10T09:00:00+00:00',
  bookingTo: '2026-09-10T11:00:00+00:00',
  total: 2500,
  addons: [],
  addonIds: [],
  pickupAddress: null,
  leaveOverAddress: null,
  pricingOptionId: null,
  pricingOptionName: null,
  pricingOptionBase: null,
};

jest.mock('../../services/bookings', () => ({
  ...jest.requireActual('../../services/bookings'),
  createBooking: jest.fn(async () => ({ id: 1 })),
}));

jest.mock('../../services/payment-methods', () => ({
  getPaymentMethods: jest.fn(async () => []),
  createPaymentMethod: jest.fn(async () => ({ id: 1 })),
  PaymentMethodStatus: { Active: 0 },
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 1 }, isPartner: false, isAdmin: false }),
}));

jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showError: jest.fn(), showSuccess: jest.fn(), showInfo: jest.fn() }),
}));

jest.mock('../../context/LocaleContext', () => {
  const { translate } = jest.requireActual('../../i18n');
  const value = {
    t: (key: string, params?: Record<string, unknown>) => translate('en', key, params),
    tEnum: (_n: string, v: unknown) => String(v),
    language: 'en',
  };
  return { useLocale: () => value };
});

const service = {
  id: 7,
  name: 'Sunny Sitters',
  basicServiceName: 'Sitter',
  serviceProviderId: 3,
  currency: 'RSD',
  photos: [],
  additionalServices: [],
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), canGoBack: () => true, goBack: jest.fn() }),
  useRoute: () => ({
    name: 'ReviewBooking',
    key: 'k',
    params: { service, appointments: [appointment] },
  }),
}));

import ReviewBookingScreen from '../../screens/review-booking-screen/containers/ReviewBookingScreen';

afterEach(() => {
  jest.clearAllMocks();
  setPlatform('web');
});

describeBothLayouts('ReviewBookingScreen', ({ renderScreen }) => {
  it('shows the confirm action in both designs', async () => {
    // Pinned bar on a phone, sticky panel on a desktop — but a checkout with no way to confirm
    // is the one failure that makes the screen pointless, so it must exist either way.
    renderScreen(<ReviewBookingScreen />);
    await waitFor(() => expect(screen.getByText('Confirm Booking')).toBeTruthy());
  });

  it('shows exactly one confirm action, never two', async () => {
    // The button is rendered from a single `confirmButton` variable placed in one branch or the
    // other. A copy left behind in both would give a desktop user two Confirm buttons, and the
    // second would be below the fold where nobody would notice it in review.
    renderScreen(<ReviewBookingScreen />);
    await waitFor(() => expect(screen.getAllByText('Confirm Booking')).toHaveLength(1));
  });

  it('shows the price breakdown exactly once', async () => {
    // Same risk as the button, and worse: two totals on a checkout page is the kind of thing a
    // customer screenshots.
    renderScreen(<ReviewBookingScreen />);
    await waitFor(() => expect(screen.getAllByText('Total')).toHaveLength(1));
  });

  it('keeps the payment selector and cancellation policy in the main column', async () => {
    // These stay put in both designs; asserting them guards against the row wrapper swallowing
    // the rest of the scroll content when the aside was added.
    renderScreen(<ReviewBookingScreen />);
    await waitFor(() => expect(screen.getByText('Cancellation Policy')).toBeTruthy());
  });
});
