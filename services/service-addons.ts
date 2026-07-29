// Single source of truth for service add-ons ("Additional Services").
//
// All three add-ons (Pickup, Drop-off, Special Needs Care) are persisted by the
// backend. The on/off flag lives on `service.details` (is*Provided); the
// SURCHARGE money lives on `service.pricing` — pickup/pet-return as a structured
// LocationBasedPriceDto (baseFee + per-km), special-needs as a flat fee. (The
// 2026-06 API update moved the money out of details and renamed the flags.)
//
// To make a new add-on real end-to-end, implement its `read`/`write` HERE — and
// it lights up automatically in the create/edit form AND in BookService. No
// other files need to change.
import { ServiceDto, LocationBasedPriceDto } from './services';

type ServiceDetails = NonNullable<ServiceDto['details']>;
type ServicePricing = NonNullable<ServiceDto['pricing']>;
/** The in-progress write DTO an add-on's `write` mutates (flag→details, money→pricing). */
export type ServiceWriteDraft = { details: ServiceDetails; pricing: ServicePricing };

// The distance-pricing fields a location-based add-on (Pickup / Drop-off)
// captures alongside its flat base fee. The form now gathers all of these, so
// they're passed straight through on write.
export type LocationPriceExtras = {
  perKmFee?: number;
  freeDistanceKm?: number | null;
  maxDistanceKm?: number | null;
};

// Build a LocationBasedPriceDto from the form's base fee + distance-pricing
// fields. The form is the source of truth (it prefills these from the DTO on
// edit and writes them back), so unspecified fields default to 0/null.
const buildLocationPrice = (
  baseFee: number,
  extras?: LocationPriceExtras
): LocationBasedPriceDto => ({
  baseFee,
  perKmFee: extras?.perKmFee ?? 0,
  freeDistanceKm: extras?.freeDistanceKm ?? null,
  maxDistanceKm: extras?.maxDistanceKm ?? null,
});

export type ServiceAddonId = 'pickup' | 'dropoff' | 'specialNeeds';

export type ServiceAddonDef = {
  id: ServiceAddonId;
  name: string;
  description: string;
  /** false = UI-only until the backend persists it. */
  persisted: boolean;
  /** true = distance-priced (base fee + per-km/free/max distance); false = flat fee. */
  locationBased: boolean;
  /** Read the surcharge off a service. Returns null when not persisted yet. The
   *  distance fields are populated only for location-based add-ons. */
  read: (dto: ServiceDto) => {
    enabled: boolean;
    price: number;
    perKmFee?: number;
    freeDistanceKm?: number | null;
    maxDistanceKm?: number | null;
  } | null;
  /** Write the surcharge into the in-progress draft. `extras` carries the
   *  distance-pricing fields for location-based add-ons (ignored by flat ones).
   *  No-op when not persisted. */
  write: (
    draft: ServiceWriteDraft,
    enabled: boolean,
    price: number,
    extras?: LocationPriceExtras
  ) => void;
};

export const SERVICE_ADDON_DEFS: ServiceAddonDef[] = [
  {
    id: 'pickup',
    name: 'Pickup',
    description: "We'll pick up your pet from your location",
    persisted: true,
    locationBased: true,
    read: (dto) => ({
      enabled: !!dto.details?.isPickupProvided,
      price: dto.pricing?.pickupPrice?.baseFee ?? 0,
      perKmFee: dto.pricing?.pickupPrice?.perKmFee ?? 0,
      freeDistanceKm: dto.pricing?.pickupPrice?.freeDistanceKm ?? null,
      maxDistanceKm: dto.pricing?.pickupPrice?.maxDistanceKm ?? null,
    }),
    write: ({ details, pricing }, enabled, price, extras) => {
      details.isPickupProvided = enabled;
      pricing.pickupPrice = enabled ? buildLocationPrice(price, extras) : null;
    },
  },
  {
    id: 'dropoff',
    name: 'Drop-off',
    description: "We'll drop off your pet after the service",
    persisted: true,
    locationBased: true,
    read: (dto) => ({
      enabled: !!dto.details?.isPetReturnProvided,
      price: dto.pricing?.petReturnPrice?.baseFee ?? 0,
      perKmFee: dto.pricing?.petReturnPrice?.perKmFee ?? 0,
      freeDistanceKm: dto.pricing?.petReturnPrice?.freeDistanceKm ?? null,
      maxDistanceKm: dto.pricing?.petReturnPrice?.maxDistanceKm ?? null,
    }),
    write: ({ details, pricing }, enabled, price, extras) => {
      details.isPetReturnProvided = enabled;
      pricing.petReturnPrice = enabled ? buildLocationPrice(price, extras) : null;
    },
  },
  {
    id: 'specialNeeds',
    name: 'Special Needs Care',
    description: 'Extra care and attention for pets with special needs',
    persisted: true,
    locationBased: false,
    read: (dto) => ({
      enabled: !!dto.details?.isSpecialNeedsProvided,
      price: dto.pricing?.specialNeedsPrice ?? 0,
    }),
    write: ({ details, pricing }, enabled, price) => {
      details.isSpecialNeedsProvided = enabled;
      // Flat fee (not location-based, unlike pickup/pet-return).
      pricing.specialNeedsPrice = enabled ? price : null;
    },
  },
];

/** Names for the create form's "Additional Services" list (catalog order). */
export const ALL_ADDITIONAL_SERVICE_NAMES = SERVICE_ADDON_DEFS.map((d) => d.name);

/** Look up an add-on definition by its display name. */
export function findServiceAddon(name: string): ServiceAddonDef | undefined {
  return SERVICE_ADDON_DEFS.find((d) => d.name === name);
}

export type EnabledServiceAddon = {
  id: ServiceAddonId;
  name: string;
  description: string;
  price: number;
  /** Per-km surcharge for distance-priced add-ons (pickup/drop-off); 0 = flat fee only. */
  perKmFee: number;
  /** Km included before per-km billing starts (null = none / not distance-priced). */
  freeDistanceKm: number | null;
  /** Max serviceable distance in km (null = uncapped / not distance-priced). */
  maxDistanceKm: number | null;
};

/** Add-ons a booker can actually select for a service — only the enabled+persisted ones. */
export function getEnabledServiceAddons(dto: ServiceDto): EnabledServiceAddon[] {
  return SERVICE_ADDON_DEFS.flatMap((def) => {
    const r = def.read(dto);
    return r?.enabled
      ? [
          {
            id: def.id,
            name: def.name,
            description: def.description,
            price: r.price,
            perKmFee: r.perKmFee ?? 0,
            freeDistanceKm: r.freeDistanceKm ?? null,
            maxDistanceKm: r.maxDistanceKm ?? null,
          },
        ]
      : [];
  });
}

/**
 * Surcharge label for an add-on row — "$5 + $2/km" when distance-priced,
 * "$5" when flat, null when free (caller shows its own "Included" text).
 * The final distance-based total is computed server-side at booking time.
 */
export function addonPriceLabel(
  t: (key: any, params?: Record<string, string | number>) => string,
  addon: { price: number; perKmFee: number }
): string | null {
  const parts: string[] = [];
  if (addon.price > 0) parts.push(`$${addon.price}`);
  if (addon.perKmFee > 0) parts.push(t('addons.perKm', { amount: `$${addon.perKmFee}` }));
  return parts.length ? parts.join(' + ') : null;
}
