import { buildScheduleFromBookings } from '../screens/my-schedule-screen/utils/scheduleData';
import { BookingState, BookingStatusType, type BookingDto } from '../services/bookings';

// A partner's schedule printed the partner's own business name on every appointment, where the
// partner needs to know which customer it is for. A user's schedule names the provider.
const booking: BookingDto = {
  id: 7,
  userId: 1,
  serviceProviderId: 2,
  serviceId: 3,
  petId: 4,
  bookingFrom: '2026-10-14T11:00:00',
  bookingTo: '2026-10-14T12:00:00',
  state: BookingState.Accepted,
  currentStatus: BookingStatusType.ServiceConfirmedByProvider,
  user: { id: 1, userName: 'ana.owner', displayName: 'Ana O.' },
  serviceProvider: { id: 2, name: 'Belgrade Pet Walkers' },
  service: { id: 3, name: 'City Walk' },
  pet: { id: 4, name: 'Bela' },
} as BookingDto;

describe('schedule cards name the other side', () => {
  it('shows the customer on a partner schedule, by first name and last initial', () => {
    const [item] = buildScheduleFromBookings([booking], 'partner')['2026-10-14'];
    expect(item.counterpart).toBe('Ana O.');
    expect(item.petName).toBe('Bela');
  });

  it('falls back to the username when the API sends no display name', () => {
    const older = { ...booking, user: { id: 1, userName: 'ana.owner' } } as BookingDto;
    const [item] = buildScheduleFromBookings([older], 'partner')['2026-10-14'];
    expect(item.counterpart).toBe('ana.owner');
  });

  it('shows the provider on a user schedule', () => {
    const [item] = buildScheduleFromBookings([booking], 'user')['2026-10-14'];
    expect(item.counterpart).toBe('Belgrade Pet Walkers');
  });
});
