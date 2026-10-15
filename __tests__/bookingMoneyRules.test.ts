/**
 * The client mirrors of the server's money and lifecycle rules from the 2026-10-15 review: a card
 * booking's deposit gates its start (G3), a no-show can be recorded from the start until a day
 * after the end (G6), and checkout knows whether a service asks a deposit at all.
 */
import {
  awaitingDeposit,
  canMarkNoShow,
  BookingStatusType,
  PaymentType,
} from '../services/bookings';
import { serviceAsksDeposit } from '../services/services';

jest.mock('../services/token-storage', () => ({
  getAccessToken: jest.fn(async () => null),
  getRefreshToken: jest.fn(async () => null),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

describe('awaitingDeposit', () => {
  const confirmed = {
    currentStatus: BookingStatusType.ServiceConfirmedByProvider,
    paymentType: PaymentType.Card,
    depositAmount: 300,
  };

  it('is a confirmed card booking that asks a deposit', () => {
    expect(awaitingDeposit(confirmed)).toBe(true);
  });

  it('is over once the deposit is paid (PrePayment)', () => {
    expect(awaitingDeposit({ ...confirmed, currentStatus: BookingStatusType.PrePayment })).toBe(
      false
    );
  });

  it('never holds a cash booking or one without a deposit', () => {
    expect(awaitingDeposit({ ...confirmed, paymentType: PaymentType.Cash })).toBe(false);
    expect(awaitingDeposit({ ...confirmed, depositAmount: 0 })).toBe(false);
  });
});

describe('canMarkNoShow', () => {
  const booking = {
    currentStatus: BookingStatusType.PrePayment,
    bookingFrom: '2026-10-15T10:00:00',
    bookingTo: '2026-10-15T11:00:00',
  };
  const at = (iso: string) => new Date(iso).getTime();

  it('opens at the start and closes a day after the end', () => {
    expect(canMarkNoShow(booking, at('2026-10-15T09:59:00'))).toBe(false);
    expect(canMarkNoShow(booking, at('2026-10-15T10:00:00'))).toBe(true);
    expect(canMarkNoShow(booking, at('2026-10-16T10:59:00'))).toBe(true);
    expect(canMarkNoShow(booking, at('2026-10-16T11:01:00'))).toBe(false);
  });

  it('only on a confirmed booking that has not started', () => {
    const now = at('2026-10-15T10:30:00');
    expect(
      canMarkNoShow(
        { ...booking, currentStatus: BookingStatusType.ServiceConfirmedByProvider },
        now
      )
    ).toBe(true);
    expect(
      canMarkNoShow({ ...booking, currentStatus: BookingStatusType.ServiceStarted }, now)
    ).toBe(false);
    expect(
      canMarkNoShow({ ...booking, currentStatus: BookingStatusType.ServiceRequestedByUser }, now)
    ).toBe(false);
  });
});

describe('serviceAsksDeposit', () => {
  const pricing = { basePrice: 1500, isEscrowPercentEnabled: false, escrowAmount: 0 };

  it('follows the percent when percent escrow is on, else the flat amount', () => {
    expect(serviceAsksDeposit({ pricing } as any)).toBe(false);
    expect(serviceAsksDeposit({ pricing: { ...pricing, escrowAmount: 200 } } as any)).toBe(true);
    expect(
      serviceAsksDeposit({
        pricing: { ...pricing, isEscrowPercentEnabled: true, escrowPercent: 20 },
      } as any)
    ).toBe(true);
    expect(
      serviceAsksDeposit({
        pricing: { ...pricing, isEscrowPercentEnabled: true, escrowPercent: 0, escrowAmount: 200 },
      } as any)
    ).toBe(false);
  });
});
