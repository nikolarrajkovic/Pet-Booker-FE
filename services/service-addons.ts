// Helpers for a service's "Additional Services" — the optional extras a provider offers.
//
// Each extra is one KIND from a preset list (`AdditionalServiceKind`, feedback 2026-10-26): the
// partner picks what it is and how it is priced, the server names it after its kind, and every
// screen shows the kind's translation (`addonLabel`). Only an extra saved before the list has a
// name of its partner's own (kind None).
//
// Pricing is NOT mirrored here on purpose. A per-distance extra's real charge depends on a road
// distance only the server can measure, so the booking flow asks POST /api/bookings/quote
// (services/booking-quote.ts) instead of computing an estimate.
import { formatMoney } from './currency';
import {
  AdditionalServiceChargeType,
  AdditionalServiceKind,
  ADDITIONAL_SERVICE_KINDS,
  DistanceLeg,
  type AdditionalServiceDto,
  type ServiceDto,
} from './services';

export {
  AdditionalServiceChargeType,
  AdditionalServiceKind,
  ADDITIONAL_SERVICE_KINDS,
  DistanceLeg,
};
export type { AdditionalServiceDto };

type TEnum = (
  enumName: 'additionalServiceKind',
  value: number | null | undefined,
  fallback?: string
) => string;

/**
 * What to call an extra — or a booking's bill line for one — in the reader's language: its
 * kind's translation, else (an extra saved before the preset list) the name it was saved with.
 */
export function addonLabel(
  tEnum: TEnum,
  addon: { kind?: number | null; name?: string | null }
): string {
  return addon.kind
    ? tEnum('additionalServiceKind', addon.kind, addon.name ?? '')
    : (addon.name ?? '');
}

/** The trip a transport kind performs (it is the leg such an extra bills), else null. */
export function legOfKind(kind: number | null | undefined): number | null {
  switch (kind) {
    case AdditionalServiceKind.Pickup:
      return DistanceLeg.Pickup;
    case AdditionalServiceKind.DropOff:
      return DistanceLeg.DropOff;
    case AdditionalServiceKind.PetTaxi:
      return DistanceLeg.RoundTrip;
    default:
      return null;
  }
}

/** A pickup, drop-off or pet taxi — the only kinds that may be priced by distance. */
export function isTransportKind(kind: number | null | undefined): boolean {
  return legOfKind(kind) !== null;
}

/** Extras a booker can actually select: the ones the provider currently offers. */
export function getEnabledServiceAddons(dto: ServiceDto): AdditionalServiceDto[] {
  return (dto.additionalServices ?? []).filter((a) => a.isActive !== false);
}

/** True when this extra's price depends on the trip distance. */
export function isPerDistance(addon: AdditionalServiceDto): boolean {
  return addon.chargeType === AdditionalServiceChargeType.PerDistance;
}

/**
 * Which of the booking's addresses an extra needs the booker to supply. A pickup needs a
 * collection address, a drop-off a return address, and a pet taxi both — however it is priced,
 * since the partner has to know where to go either way. An extra from before the preset list
 * goes by the trip it bills (none when flat). Drives which address pickers the booking flow shows.
 */
export function requiredAddresses(addon: AdditionalServiceDto): {
  pickup: boolean;
  dropoff: boolean;
} {
  const leg = addon.kind ? legOfKind(addon.kind) : isPerDistance(addon) ? addon.distanceLeg : null;
  switch (leg) {
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
 * Price label for an extra in a selection list, BEFORE any distance is known — "5 € + 2 €/km"
 * for a per-distance extra, "5 €" for a flat one, null when free (the caller shows its own
 * "Included" text). The actual amount comes from the quote once addresses are chosen.
 *
 * `currency` is the owning service's code; omit it and the amounts render in the user's
 * display preference.
 */
export function addonPriceLabel(
  t: (key: any, params?: Record<string, string | number>) => string,
  addon: AdditionalServiceDto,
  /** Currency the addon amounts are in — from the parent ServiceDto.currency. */
  currency?: string | null
): string | null {
  const parts: string[] = [];
  const money = (amount: number) => formatMoney(amount, currency);
  if (isPerDistance(addon)) {
    const baseFee = addon.distancePrice?.baseFee ?? 0;
    const perKmFee = addon.distancePrice?.perKmFee ?? 0;
    if (baseFee > 0) parts.push(money(baseFee));
    if (perKmFee > 0) parts.push(t('addons.perKm', { amount: money(perKmFee) }));
  } else if ((addon.price ?? 0) > 0) {
    parts.push(money(addon.price ?? 0));
  }
  return parts.length ? parts.join(' + ') : null;
}

/** A stable key for an extra in lists / selection state. */
export function addonKey(addon: AdditionalServiceDto): string {
  return String(addon.id ?? addon.kind ?? addon.name);
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
