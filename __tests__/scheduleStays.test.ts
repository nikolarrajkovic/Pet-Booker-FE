import { buildScheduleFromBookings } from '../screens/my-schedule-screen/utils/scheduleData';
import { BookingState, BookingStatusType, type BookingDto } from '../services/bookings';

// The partner's calendar (review 2026-11-13, finding 4): a stay showed on its first day only, as
// "10:00 - 10:00", and its kind was guessed from the English service name.
const base = {
  userId: 1,
  serviceProviderId: 2,
  serviceId: 3,
  petId: 4,
  state: BookingState.Accepted,
  currentStatus: BookingStatusType.ServiceConfirmedByProvider,
  user: { id: 1, userName: 'mila', displayName: 'Mila J.' },
  pet: { id: 4, name: 'Bubi' },
} as const;

describe('a stay on the partner calendar', () => {
  const stay = {
    ...base,
    id: 9,
    bookingFrom: '2026-11-16T10:00:00',
    bookingTo: '2026-11-18T10:00:00',
    service: { id: 3, name: 'Deposit walk', type: 0 },
  } as BookingDto;
  const map = buildScheduleFromBookings([stay], 'partner');

  it('is listed on every day it covers', () => {
    expect(Object.keys(map).sort()).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
  });

  it("counts only that day's hours towards the day", () => {
    expect(map['2026-11-16'][0].duration).toBe(14);
    expect(map['2026-11-17'][0].duration).toBe(24);
    expect(map['2026-11-18'][0].duration).toBe(10);
  });

  it('opens the booking, and keys each day separately', () => {
    expect(map['2026-11-17'][0].bookingId).toBe(9);
    expect(map['2026-11-16'][0].id).not.toBe(map['2026-11-17'][0].id);
  });

  it('takes its kind from the service type, not the name', () => {
    expect(map['2026-11-16'][0].type).toBe('sitting');
    expect(map['2026-11-16'][0].serviceType).toBe(0);
  });

  it('shows its dates, not "10:00 - 10:00"', () => {
    expect(map['2026-11-16'][0].time).not.toMatch(/^10:00 - 10:00$/);
    expect(map['2026-11-16'][0].time).toContain('–');
  });
});

describe('an appointment within one day', () => {
  it('is one entry with its hours', () => {
    const walk = {
      ...base,
      id: 10,
      bookingFrom: '2026-11-16T10:00:00',
      bookingTo: '2026-11-16T11:00:00',
      service: { id: 5, name: 'Šetnja po Kalemegdanu', type: 1 },
    } as BookingDto;
    const map = buildScheduleFromBookings([walk], 'partner');
    expect(Object.keys(map)).toEqual(['2026-11-16']);
    expect(map['2026-11-16'][0]).toMatchObject({ duration: 1, type: 'walking' });
  });

  it('a booking ending at midnight does not spill into the next day', () => {
    const late = {
      ...base,
      id: 11,
      bookingFrom: '2026-11-16T22:00:00',
      bookingTo: '2026-11-17T00:00:00',
      service: { id: 6, name: 'Evening sit', type: 0 },
    } as BookingDto;
    expect(Object.keys(buildScheduleFromBookings([late], 'partner'))).toEqual(['2026-11-16']);
  });
});
