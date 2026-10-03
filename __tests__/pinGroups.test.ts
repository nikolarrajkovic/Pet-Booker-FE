import { groupByLocation, pinLabel } from '../screens/search-screen/components/pinGroups';
import type { ServiceSearchItem } from '../screens/search-screen/components/ListView';

const item = (id: number, lat: number | null, lng: number | null, price = 900): ServiceSearchItem =>
  ({
    id,
    name: `Service ${id}`,
    price,
    latitude: lat,
    longitude: lng,
    dto: { id, currency: 'RSD' },
  }) as unknown as ServiceSearchItem;

describe('groupByLocation', () => {
  it('puts services at the same spot under one pin, keeping their order', () => {
    const groups = groupByLocation([
      item(1, 44.8125, 20.4612),
      item(2, 44.8, 20.4),
      item(3, 44.8125, 20.4612),
      item(4, 44.81250000001, 20.46120000002), // the same place, geocoded twice
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 3, 4]);
    expect(groups[1].items.map((i) => i.id)).toEqual([2]);
  });

  it('leaves services without a location off the map', () => {
    expect(groupByLocation([item(1, null, null), item(2, 44.8, null)])).toEqual([]);
  });
});

describe('pinLabel', () => {
  const none = () => false;

  it('a lone service shows its price, ticked when picked', () => {
    const [g] = groupByLocation([item(1, 44.8, 20.4, 900)]);
    expect(pinLabel(g, false, none)).toEqual({ text: '900 RSD', filled: true });
    expect(pinLabel(g, true, none).filled).toBe(false);
    expect(pinLabel(g, true, () => true)).toEqual({ text: '✓ 900 RSD', filled: true });
  });

  it('a shared spot shows how many and the lowest price', () => {
    const [g] = groupByLocation([
      item(1, 44.8, 20.4, 1200),
      item(2, 44.8, 20.4, 700),
      item(3, 44.8, 20.4, 900),
    ]);
    expect(pinLabel(g, false, none)).toEqual({ text: '3 · 700 RSD+', filled: true });
    expect(pinLabel(g, true, none)).toEqual({ text: '3 · 700 RSD+', filled: false });
  });

  it('in selection mode a shared spot says how many of it are picked', () => {
    const [g] = groupByLocation([item(1, 44.8, 20.4), item(2, 44.8, 20.4), item(3, 44.8, 20.4)]);
    expect(pinLabel(g, true, (id) => id !== 2)).toEqual({ text: '✓ 2/3', filled: true });
  });
});
