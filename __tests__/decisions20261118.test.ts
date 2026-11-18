import { formatDistanceKm } from '../services/distance';
import { AdminBookingAction, adminActionsFor, BookingStatusType } from '../services/bookings';

// The rest of the 2026-11-13 review, built 2026-11-18: distance on the search cards (44) and the
// support actions a booking offers an admin (40).

describe('formatDistanceKm', () => {
  it('keeps one decimal close by and whole kilometres further out', () => {
    expect(formatDistanceKm(0.27, 'en')).toBe('0.3 km');
    expect(formatDistanceKm(2.44, 'en')).toBe('2.4 km');
    expect(formatDistanceKm(12.6, 'en')).toBe('13 km');
  });

  it("writes the reader's decimal mark", () => {
    expect(formatDistanceKm(0.27, 'sr')).toBe('0,3 km');
  });
});

describe('adminActionsFor', () => {
  const now = new Date('2026-11-18T12:00:00').getTime();
  const at = (status: number, from: string) => ({ currentStatus: status, bookingFrom: from });

  it('offers calling off for a request, but no no-show before it was due', () => {
    expect(
      adminActionsFor(at(BookingStatusType.ServiceRequestedByUser, '2026-11-20T10:00:00'), now)
    ).toEqual([AdminBookingAction.CallOffWithFullRefund, AdminBookingAction.CallOffKeepingDeposit]);
  });

  it('offers everything for a confirmed booking that was due', () => {
    expect(adminActionsFor(at(BookingStatusType.PrePayment, '2026-11-18T09:00:00'), now)).toEqual([
      AdminBookingAction.CallOffWithFullRefund,
      AdminBookingAction.CallOffKeepingDeposit,
      AdminBookingAction.Complete,
      AdminBookingAction.CustomerNoShow,
      AdminBookingAction.ProviderNoShow,
    ]);
  });

  it('only completes a started service, and offers nothing once it ended', () => {
    expect(
      adminActionsFor(at(BookingStatusType.ServiceStarted, '2026-11-18T09:00:00'), now)
    ).toEqual([AdminBookingAction.Complete]);
    expect(adminActionsFor(at(BookingStatusType.ServiceEnded, '2026-11-18T09:00:00'), now)).toEqual(
      []
    );
  });
});
