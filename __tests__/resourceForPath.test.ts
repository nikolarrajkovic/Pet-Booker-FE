import { resourceForPath } from '../services/cache';

// Which cached resource a write to a path makes stale. A wrong answer either leaves a screen
// showing old data or, as the quote did until 2026-11-13, refreshes half the app for nothing.
describe('resourceForPath', () => {
  it('maps the generated CRUD routes to their resource', () => {
    expect(resourceForPath('/api/bookings')).toBe('bookings');
    expect(resourceForPath('/api/bookings/12')).toBe('bookings');
    expect(resourceForPath('/api/service-discounts/3')).toBe('service-discounts');
  });

  it('maps the unprefixed booking transitions and admin actions', () => {
    expect(resourceForPath('/bookings/12/confirm')).toBe('bookings');
    expect(resourceForPath('/admin/reviews/approve')).toBe('reviews');
    expect(resourceForPath('/payments/bookings/12/pay')).toBe('payments');
    expect(resourceForPath('/auth/change-password')).toBe('users');
  });

  it('treats a price quote as a read: it changes nothing', () => {
    expect(resourceForPath('/api/bookings/quote')).toBeNull();
    expect(resourceForPath('/api/bookings/quote?x=1')).toBeNull();
  });
});
