import { formatMoney } from './money';
// Helpers for a service's "Additional Services" — the optional extras a provider offers.
//
// These used to be a fixed catalog of three (Pickup / Drop-off / Special Needs Care), each
// hardcoded here with its own read/write mapping onto `service.details.is*Provided` and
// `service.pricing.*Price`. The API replaced that with an open-ended `service.additionalServices`
// array, so there is no catalog to define any more — a provider names their own extras and this
// module only interprets what the server returns.
//
// Pricing is NOT mirrored here on purpose. A per-distance extra's real charge depends on a road
// distance only the server can measure, so the booking flow asks POST /api/bookings/quote
// (services/booking-quote.ts) instead of computing an estimate.
import {
  AdditionalServiceChargeType,
  DistanceLeg,
  type AdditionalServiceDto,
  type ServiceDto,
} from './services';

export { AdditionalServiceChargeType, DistanceLeg };
export type { AdditionalServiceDto };

/** Extras a booker can actually select: the ones the provider currently offers. */
export function getEnabledServiceAddons(dto: ServiceDto): AdditionalServiceDto[] {
  return (dto.additionalServices ?? []).filter((a) => a.isActive !== false);
}

/** True when this extra's price depends on the trip distance. */
export function isPerDistance(addon: AdditionalServiceDto): boolean {
  return addon.chargeType === AdditionalServiceChargeType.PerDistance;
}

/**
 * Which of the booking's addresses an extra needs the booker to supply. A pickup extra needs a
 * collection address, a drop-off extra a return address, and a round-trip extra both. A flat
 * extra needs none. Drives which address pickers the booking flow shows.
 */
export function requiredAddresses(addon: AdditionalServiceDto): {
  pickup: boolean;
  dropoff: boolean;
} {
  if (!isPerDistance(addon)) return { pickup: false, dropoff: false };
  switch (addon.distanceLeg) {
    case DistanceLeg.Pickup:
      return { pickup: true, dropoff: false };
    case DistanceLeg.DropOff:
      return { pickup: false, dropoff: true };
    case DistanceLeg.RoundTrip:
      return { pickup: true, dropoff: true };
    default:
      return { pickup: false, dropoff: false };
  }
}

/** Union of the addresses a whole selection needs. */
export function requiredAddressesFor(addons: AdditionalServiceDto[]): {
  pickup: boolean;
  dropoff: boolean;
} {
  return addons.reduce<{ pickup: boolean; dropoff: boolean }>(
    (acc, addon) => {
      const need = requiredAddresses(addon);
      return { pickup: acc.pickup || need.pickup, dropoff: acc.dropoff || need.dropoff };
    },
    { pickup: false, dropoff: false }
  );
}

/**
 * Price label for an extra in a selection list, BEFORE any distance is known — "$5 + $2/km" for
 * a per-distance extra, "$5" for a flat one, null when free (the caller shows its own
 * "Included" text). The actual amount comes from the quote once addresses are chosen.
 */
export function addonPriceLabel(
  t: (key: any, params?: Record<string, string | number>) => string,
  addon: AdditionalServiceDto,
  /** Currency the addon amounts are in — from the parent ServiceDto.currency. */
  currency?: string | null
): string | null {
  const parts: string[] = [];
  if (isPerDistance(addon)) {
    const baseFee = addon.distancePrice?.baseFee ?? 0;
    const perKmFee = addon.distancePrice?.perKmFee ?? 0;
    if (baseFee > 0) parts.push(formatMoney(baseFee, currency));
    if (perKmFee > 0) parts.push(t('addons.perKm', { amount: formatMoney(perKmFee, currency) }));
  } else if ((addon.price ?? 0) > 0) {
    parts.push(formatMoney(addon.price ?? 0, currency));
  }
  return parts.length ? parts.join(' + ') : null;
}

/** A stable key for an extra in lists / selection state. */
export function addonKey(addon: AdditionalServiceDto): string {
  return String(addon.id ?? addon.name);
}

/**
 * Builds the `additionalServices` a booking write sends: ids only. Extras without a persisted id
 * can't be selected (nothing to reference), so they're dropped.
 */
export function toBookingSelection(
  addons: AdditionalServiceDto[]
): { additionalServiceId: number }[] {
  return addons
    .filter((a) => typeof a.id === 'number' && a.id > 0)
    .map((a) => ({ additionalServiceId: a.id as number }));
}
