import {
  uiToServiceDto,
  schedulesToWorkingHours,
  type WorkingHours,
} from '../screens/my-services-screen/serviceModel';
import { applyBookingTransition, BookingState, BookingStatusType } from '../services/bookings';

/**
 * The payload shape behind the "one request per service save" change, and the merge behind
 * "patch, don't refetch".
 *
 * Both are pure, and both encode a contract the API enforces on the other side — the empty-array
 * asymmetry especially: `pricingOptions: []` clears the tiers, `schedules: []` means "leave them
 * alone". `clearServiceSchedules` exists solely because of that second rule, so if these
 * expectations ever change, that call is either dead code or a missing one.
 */

const allOff = (): WorkingHours => {
  const h: WorkingHours = {};
  for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    h[d] = { enabled: false, startTime: '09:00', endTime: '17:00' };
  }
  return h;
};
const hours = (on: WorkingHours): WorkingHours => ({ ...allOff(), ...on });

const baseForm = {
  serviceProviderId: 42,
  serviceType: 'Walker',
  serviceName: 'Morning walks',
  description: 'd',
  maxPetCapacity: 2,
  additionalServices: [],
  photos: [],
  address: null,
};

describe('uiToServiceDto — the whole aggregate in one payload', () => {
  it('nests the enabled working hours, in the API time format', () => {
    const dto = uiToServiceDto({
      ...baseForm,
      pricingTiers: [{ duration: '30 min', price: '10' }],
      workingHours: hours({
        Monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
        Wednesday: { enabled: true, startTime: '11:00', endTime: '15:30' },
      }),
    });

    expect(dto.schedules).toHaveLength(2);
    expect(dto.schedules?.map((s) => s.day).sort()).toEqual([1, 3]);
    expect(dto.schedules?.find((s) => s.day === 1)).toMatchObject({
      from: '09:00:00',
      to: '17:00:00',
    });
    expect(dto.schedules?.find((s) => s.day === 3)?.to).toBe('15:30:00');
  });

  it('maps an end-of-day 24:00 onto the storable 23:59:59 sentinel, and back', () => {
    const dto = uiToServiceDto({
      ...baseForm,
      pricingTiers: [{ duration: '30 min', price: '10' }],
      workingHours: hours({ Saturday: { enabled: true, startTime: '10:00', endTime: '24:00' } }),
    });
    expect(dto.schedules?.[0].to).toBe('23:59:59');
    // The round trip matters as much as the encoding — otherwise an edit silently retimes the day.
    expect(schedulesToWorkingHours(dto.schedules).Saturday.endTime).toBe('24:00');
  });

  it('nests the duration tiers as pricing options', () => {
    const dto = uiToServiceDto({
      ...baseForm,
      pricingTiers: [
        { duration: '30 min', price: '10' },
        { duration: '1 hour', price: '18' },
      ],
      workingHours: allOff(),
    });

    expect(dto.pricingOptions).toEqual([
      expect.objectContaining({ name: '30 min', durationMinutes: 30, price: 10 }),
      expect.objectContaining({ name: '1 hour', durationMinutes: 60, price: 18 }),
    ]);
    // Ids are the server's to assign on create.
    expect(dto.pricingOptions?.every((o) => o.id === undefined)).toBe(true);
    // The cheapest tier backs the "from" price on a card that only reads `price`.
    expect(dto.pricing?.basePrice).toBe(10);
  });

  it('round-trips an existing tier id so bookings keep pointing at their tier', () => {
    const dto = uiToServiceDto(
      {
        ...baseForm,
        id: 500,
        pricingTiers: [
          { id: 77, duration: '30 min', price: '14' }, // edited in place
          { duration: '2 hours', price: '30' }, // newly added
        ],
        workingHours: hours({ Monday: { enabled: true, startTime: '08:30', endTime: '16:00' } }),
      },
      { id: 500, currency: 'EUR' } as any
    );

    expect(dto.pricingOptions?.find((o) => o.id === 77)?.price).toBe(14);
    expect(dto.pricingOptions?.find((o) => o.name === '2 hours')?.id).toBeUndefined();
    // A tier the provider removed is simply absent — the array is the desired full set.
    expect(dto.pricingOptions?.some((o) => o.name === '1 hour')).toBe(false);
    // The declared currency governs every nested amount; nested rows must not declare their own.
    expect(dto.currency).toBe('EUR');
    expect(
      dto.pricingOptions?.every((o) => (o as { currency?: string }).currency === undefined)
    ).toBe(true);
  });

  it('emits the two empty-array cases the API treats differently', () => {
    const dto = uiToServiceDto(
      {
        ...baseForm,
        id: 7,
        // A tier with no resolvable duration is not an option — the service stays free-range.
        pricingTiers: [{ duration: 'Standard', price: '25' }],
        workingHours: allOff(),
      },
      { id: 7 } as any
    );

    // `[]` clears every tier server-side...
    expect(dto.pricingOptions).toEqual([]);
    // ...but `[]` for schedules means "leave untouched", which is why the screen still has to
    // call clearServiceSchedules when the provider switches every day off.
    expect(dto.schedules).toEqual([]);
  });

  it('never sends discounts (they are written through their own endpoint)', () => {
    const dto = uiToServiceDto({
      ...baseForm,
      pricingTiers: [{ duration: '30 min', price: '10' }],
      workingHours: allOff(),
    });
    expect(dto.discounts).toBeUndefined();
  });
});

describe('applyBookingTransition — merge, do not replace', () => {
  const row = {
    id: 101,
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
    paymentType: 0,
    paymentMethodId: 1,
    user: { id: 9, userName: 'ana' },
    pet: { id: 3, name: 'Rex' },
    service: { id: 5, name: 'Morning walk' },
    additionalServices: [{ name: 'Pickup', price: 7 }],
  } as any;

  it('advances the lifecycle fields of the matching row only', () => {
    const other = { ...row, id: 102 };
    const [patched, untouched] = applyBookingTransition([row, other], {
      id: 101,
      state: BookingState.Accepted,
      currentStatus: BookingStatusType.ServiceConfirmedByProvider,
      updatedAt: 'later',
    } as any);

    expect(patched.state).toBe(BookingState.Accepted);
    expect(patched.currentStatus).toBe(BookingStatusType.ServiceConfirmedByProvider);
    expect(untouched.state).toBe(BookingState.Upcoming);
  });

  it('keeps the includes and frozen bill lines the card renders from', () => {
    const [patched] = applyBookingTransition([row], {
      id: 101,
      state: BookingState.Accepted,
      currentStatus: BookingStatusType.ServiceConfirmedByProvider,
    } as any);

    expect(patched.user?.userName).toBe('ana');
    expect(patched.pet?.name).toBe('Rex');
    expect(patched.service?.name).toBe('Morning walk');
    expect(patched.additionalServices?.[0]).toMatchObject({ name: 'Pickup', price: 7 });
    expect(patched.totalPrice).toBe(10);
  });

  it('stores a decline reason but never wipes one with a null', () => {
    const [declined] = applyBookingTransition([row], {
      id: 101,
      state: BookingState.Cancelled,
      currentStatus: BookingStatusType.DeclinedByProvider,
      cancelReason: 'Fully booked that afternoon.',
    } as any);
    expect(declined.cancelReason).toBe('Fully booked that afternoon.');

    const [again] = applyBookingTransition([declined], {
      id: 101,
      state: BookingState.Cancelled,
      currentStatus: BookingStatusType.DeclinedByProvider,
      cancelReason: null,
    } as any);
    expect(again.cancelReason).toBe('Fully booked that afternoon.');
  });

  it('leaves the list alone for an unknown id, and never matches a null id', () => {
    const untouched = applyBookingTransition([row], { id: 999, state: 3 } as any);
    expect(untouched[0].state).toBe(BookingState.Upcoming);

    const unsaved = [{ id: null, state: 0, currentStatus: 0 }] as any;
    expect(applyBookingTransition(unsaved, { id: null, state: 3 } as any)[0].state).toBe(0);
  });

  it('does not mutate the row it was given', () => {
    applyBookingTransition([row], { id: 101, state: 3, currentStatus: 1 } as any);
    expect(row.state).toBe(BookingState.Upcoming);
  });
});
