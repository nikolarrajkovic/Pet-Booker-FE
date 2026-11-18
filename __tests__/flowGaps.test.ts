import {
  AcceptedPayments,
  ServiceVenue,
  defaultVenueFor,
  hasDurationTiers,
  uiToServiceDto,
  visitMinutesOf,
  type WorkingHours,
} from '../screens/my-services-screen/serviceModel';
import {
  BookingStatusType,
  canChangeTime,
  canReportProviderNoShow,
  formatBookingDate,
  toBookingLocation,
} from '../services/bookings';

/**
 * The app's side of the 2026-11-13 review's flow gaps (17–29), decided on 2026-11-18: who may say
 * the provider never came (19), payment types and where a service happens (22, 26), a visit's
 * length (25), and when a booking may move to another time (28).
 */

const everyDay = (): WorkingHours => {
  const h: WorkingHours = {};
  for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    h[d] = { enabled: true, startTime: '09:00', endTime: '17:00' };
  }
  return h;
};

const form = {
  serviceProviderId: 42,
  serviceType: 'Sitter',
  serviceName: 'Sitting',
  description: 'd',
  maxPetCapacity: 1,
  additionalServices: [],
  photos: [],
  address: null,
  pricingTiers: [{ duration: '', price: '1500' }],
  pricingUnit: 0,
  workingHours: everyDay(),
};

const at = (offsetMs: number) => formatBookingDate(new Date(Date.now() + offsetMs));
const HOUR = 60 * 60 * 1000;

describe('the service editor writes the new settings', () => {
  it('card only, at the customer’s, a 45-minute visit', () => {
    const dto = uiToServiceDto({
      ...form,
      acceptedPayments: AcceptedPayments.Card,
      venue: ServiceVenue.AtCustomer,
      visitMinutes: 45,
    });
    expect(dto.details).toMatchObject({
      acceptedPayments: 1,
      venue: 1,
      minDurationMinutes: 45,
      maxDurationMinutes: 45,
    });
  });

  it('a new service takes both ways of paying and starts from its type’s usual place', () => {
    const dto = uiToServiceDto(form);
    expect(dto.details?.acceptedPayments).toBe(3);
    expect(dto.details?.venue).toBe(ServiceVenue.Either);
    expect(defaultVenueFor(4)).toBe(ServiceVenue.AtProvider); // a groomer
  });

  it('the editor’s "Standard" row is not a duration tier, so a stored unit survives a save', () => {
    expect(hasDurationTiers([{ duration: 'Standard', price: '1500' }])).toBe(false);
    expect(hasDurationTiers([{ duration: '1 hour', price: '1500' }])).toBe(true);
    const perHour = uiToServiceDto({
      ...form,
      pricingTiers: [{ duration: 'Standard', price: '900' }],
      pricingUnit: 1,
    });
    expect(perHour.pricing?.unit).toBe(1);
  });

  it('reads a stated visit back, and only when both ends agree', () => {
    expect(visitMinutesOf({ minDurationMinutes: 60, maxDurationMinutes: 60 } as any)).toBe(60);
    expect(visitMinutesOf({ minDurationMinutes: 30, maxDurationMinutes: 120 } as any)).toBeNull();
  });
});

describe('a booking at the customer’s place', () => {
  it('sends a saved address by id and a picked one inline', () => {
    expect(toBookingLocation(null, null, { id: 5 } as any)).toMatchObject({ venueAddressId: 5 });
    expect(
      toBookingLocation(null, null, { id: 0, line1: 'Knez Mihailova 1' } as any)
    ).toMatchObject({ venueAddressId: null, venueAddress: { line1: 'Knez Mihailova 1' } });
    expect(toBookingLocation(null, null, null)).toBeUndefined();
  });
});

describe('the customer says the provider never came', () => {
  it('from the start of a confirmed booking until a day after it ends', () => {
    const confirmed = {
      currentStatus: BookingStatusType.ServiceConfirmedByProvider,
      bookingFrom: at(-HOUR),
      bookingTo: at(HOUR),
    };
    expect(canReportProviderNoShow(confirmed)).toBe(true);
    expect(
      canReportProviderNoShow({ ...confirmed, bookingFrom: at(HOUR), bookingTo: at(2 * HOUR) })
    ).toBe(false);
    expect(
      canReportProviderNoShow({ ...confirmed, currentStatus: BookingStatusType.ServiceStarted })
    ).toBe(false);
  });
});

describe('moving a booking', () => {
  const booking = {
    currentStatus: BookingStatusType.ServiceConfirmedByProvider,
    bookingFrom: at(24 * HOUR),
    bookingTo: at(25 * HOUR),
  };
  it('is offered for a request or a confirmed booking still ahead', () => {
    expect(canChangeTime(booking)).toBe(true);
    expect(
      canChangeTime({ ...booking, currentStatus: BookingStatusType.ServiceRequestedByUser })
    ).toBe(true);
  });
  it('not once it started, expired or was called off', () => {
    expect(canChangeTime({ ...booking, currentStatus: BookingStatusType.ServiceStarted })).toBe(
      false
    );
    expect(canChangeTime({ ...booking, isExpired: true })).toBe(false);
    expect(canChangeTime({ ...booking, currentStatus: BookingStatusType.CancelledByUser })).toBe(
      false
    );
    expect(canChangeTime({ ...booking, bookingFrom: at(-HOUR) })).toBe(false);
  });
});
