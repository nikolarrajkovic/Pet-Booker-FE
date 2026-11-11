import { sortPricingOptions } from '../services/service-pricing-options';

// Feedback 2026-11-08: the booking form listed a service's durations in the order the partner
// entered them ("2 hours, 1 hour, 3 hours, 4 hours"). They are offered shortest first.
describe('sortPricingOptions', () => {
  const option = (id: number | null, durationMinutes: number, price: number) => ({
    id,
    serviceId: 1,
    name: `${durationMinutes} min`,
    durationMinutes,
    price,
  });

  it('lists the shortest first, however they were entered', () => {
    const entered = [option(1, 120, 200), option(2, 60, 100), option(3, 180, 300), option(4, 240, 400)];
    expect(sortPricingOptions(entered).map((o) => o.durationMinutes)).toEqual([60, 120, 180, 240]);
  });

  it('puts the cheaper of two the same length first, then the older', () => {
    const entered = [option(5, 60, 100), option(3, 60, 90), option(2, 60, 100)];
    expect(sortPricingOptions(entered).map((o) => o.id)).toEqual([3, 2, 5]);
  });

  it('leaves the array it was given alone', () => {
    const entered = [option(1, 120, 200), option(2, 60, 100)];
    sortPricingOptions(entered);
    expect(entered.map((o) => o.id)).toEqual([1, 2]);
  });
});
