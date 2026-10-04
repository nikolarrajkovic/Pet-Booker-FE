import { formatMoney } from '../../../services/currency';
import { serviceCurrency } from '../../../services/services';
import type { ServiceSearchItem } from './ListView';

/** Services that share one spot on the map. */
export type PinGroup = {
  key: string;
  latitude: number;
  longitude: number;
  items: ServiceSearchItem[];
};

/**
 * Groups the pinnable services by where they are, so services at the same spot become one pin.
 *
 * Without it they were drawn on top of each other and only the top one could be seen or clicked —
 * and that is the ordinary case, not an edge one: a service with no address of its own is pinned at
 * its provider's (`mapLocation`), so every service of such a provider lands on the same point.
 * Coordinates are compared to 5 decimals (about a metre): the same place, however it was geocoded.
 * Order follows the input, so the list's order is kept within a group.
 */
export function groupByLocation(items: ServiceSearchItem[]): PinGroup[] {
  const groups = new Map<string, PinGroup>();
  for (const item of items) {
    if (item.latitude == null || item.longitude == null) continue;
    const key = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else
      groups.set(key, { key, latitude: item.latitude, longitude: item.longitude, items: [item] });
  }
  return [...groups.values()];
}

/**
 * The pin's text and whether it is drawn filled.
 *
 * One service: its price, ticked ("✓ 900 RSD") when picked. Several: how many and the lowest
 * price ("3 · 900 RSD+"), or in selection mode how many of them are picked ("✓ 2/3").
 * Outside selection mode every pin is filled; in it, a pin is filled when anything in it is picked.
 */
export function pinLabel(
  group: PinGroup,
  selectMode: boolean,
  isPicked: (id: number) => boolean
): { text: string; filled: boolean } {
  const picked = selectMode ? group.items.filter((i) => isPicked(i.id)).length : 0;
  const first = group.items[0];
  if (group.items.length === 1) {
    const price = formatMoney(first.price, serviceCurrency(first.dto));
    return { text: `${picked ? '✓ ' : ''}${price}`, filled: !selectMode || picked > 0 };
  }
  if (picked > 0) return { text: `✓ ${picked}/${group.items.length}`, filled: true };
  const lowest = group.items.reduce((min, i) => (i.price < min.price ? i : min), first);
  return {
    text: `${group.items.length} · ${formatMoney(lowest.price, serviceCurrency(lowest.dto))}+`,
    filled: !selectMode,
  };
}
