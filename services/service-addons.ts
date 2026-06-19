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

// Build a LocationBasedPriceDto from the form's single flat fee, preserving any
// existing per-km/distance config from the original surcharge on edit.
const flatToLocationPrice = (
  fee: number,
  existing?: LocationBasedPriceDto | null,
): LocationBasedPriceDto => ({
  perKmFee: 0,
  freeDistanceKm: null,
  maxDistanceKm: null,
  ...(existing ?? {}),
  baseFee: fee,
});

export type ServiceAddonId = 'pickup' | 'dropoff' | 'specialNeeds';

export type ServiceAddonDef = {
  id: ServiceAddonId;
  name: string;
  description: string;
  /** false = UI-only until the backend persists it. */
  persisted: boolean;
  /** Read {enabled, price} off a service. Returns null when not persisted yet. */
  read: (dto: ServiceDto) => { enabled: boolean; price: number } | null;
  /** Write {enabled, price} into the in-progress draft. No-op when not persisted. */
  write: (draft: ServiceWriteDraft, enabled: boolean, price: number) => void;
};

export const SERVICE_ADDON_DEFS: ServiceAddonDef[] = [
  {
    id: 'pickup',
    name: 'Pickup',
    description: "We'll pick up your pet from your location",
    persisted: true,
    read: (dto) => ({
      enabled: !!dto.details?.isPickupProvided,
      price: dto.pricing?.pickupPrice?.baseFee ?? 0,
    }),
    write: ({ details, pricing }, enabled, price) => {
      details.isPickupProvided = enabled;
      pricing.pickupPrice = enabled ? flatToLocationPrice(price, pricing.pickupPrice) : null;
    },
  },
  {
    id: 'dropoff',
    name: 'Drop-off',
    description: "We'll drop off your pet after the service",
    persisted: true,
    read: (dto) => ({
      enabled: !!dto.details?.isPetReturnProvided,
      price: dto.pricing?.petReturnPrice?.baseFee ?? 0,
    }),
    write: ({ details, pricing }, enabled, price) => {
      details.isPetReturnProvided = enabled;
      pricing.petReturnPrice = enabled ? flatToLocationPrice(price, pricing.petReturnPrice) : null;
    },
  },
  {
    id: 'specialNeeds',
    name: 'Special Needs Care',
    description: 'Extra care and attention for pets with special needs',
    persisted: true,
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
};

/** Add-ons a booker can actually select for a service — only the enabled+persisted ones. */
export function getEnabledServiceAddons(dto: ServiceDto): EnabledServiceAddon[] {
  return SERVICE_ADDON_DEFS.flatMap((def) => {
    const r = def.read(dto);
    return r?.enabled
      ? [{ id: def.id, name: def.name, description: def.description, price: r.price }]
      : [];
  });
}
