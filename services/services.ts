import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
import { declaredWriteCurrency } from './currency';
import type { AddressDto, PhotoDto } from './service-providers';
import type { ReviewDto } from './reviews';
import { DiscountType } from './service-discounts';

// Slim owning-provider embed on the service GET (ServiceProviderInfoReadDto) —
// name/avatar/address/rating/verified, enough for ServiceDetail's provider card
// without a separate getServiceProvider call. Same shape as the provider embed
// on bookings/reviews.
export type ServiceProviderInfoDto = {
  id?: number | null;
  name?: string | null;
  isApproved?: boolean;
  ratingAvg?: number | null;
  address?: AddressDto | null;
  photos?: PhotoDto[];
  /** See `ServiceDto.currency` — the full provider GET has this, the slim embed does not (yet). */
  currency?: string | null;
};

// One already-booked slot embedded on the service read DTO (ServiceReadDto.
// upcomingBookings) — the provider's upcoming bookings for this service, enough
// to compute slot availability without a separate getBookings call.
export type ServiceBookedSlotReadDto = {
  bookingFrom: string; // ISO date-time
  bookingTo: string; // ISO date-time
  state: number; // BookingState
};

// Per-day working-hours window for a service (NEW in the schedules API).
// day is .NET DayOfWeek: 0=Sunday … 6=Saturday. from/to are "HH:mm:ss" times.
export type ServiceScheduleDto = {
  id?: number | null;
  serviceId: number;
  day: number;
  from: string;
  to: string;
};

// Duration/price variant of a service ("30 minutes / $20", "1 hour / $35").
// Managed via /api/service-pricing-options (see services/service-pricing-options.ts);
// embedded read-only on the service GET as `pricingOptions[]`. A service with a
// non-empty list REQUIRES every booking to pick one (booking sends
// pricingOptionId + bookingFrom; the server derives bookingTo and basePrice from
// the option). An empty list keeps the classic free-range from/to booking.
export type ServicePricingOptionDto = {
  id?: number | null;
  serviceId: number;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  /**
   * Currency `price` is in — read: what the server converted it to; write (standalone
   * CRUD only): what it's declared as. Stamped by service-pricing-options.ts. Nested on
   * a service write the root's currency governs and this is ignored.
   */
  currency?: string | null;
};

// Per-weight-bracket food pricing (PetWeightBracket: 0=Small, 1=Medium, 2=Large)
export type ServiceFoodPricingDto = {
  weightBracket: number;
  pricePerDay: number;
};

// Distance-based price carried by a PerDistance additional service. The charge is
// `baseFee` plus `perKmFee` per km beyond `freeDistanceKm`, capped at `maxDistanceKm`.
// The server applies this formula authoritatively — do NOT reimplement it client-side;
// ask POST /api/bookings/quote (services/booking-quote.ts) for a price.
export type LocationBasedPriceDto = {
  baseFee: number;
  perKmFee: number;
  freeDistanceKm?: number | null;
  maxDistanceKm?: number | null;
};

/** How an additional service bills. 0 = Flat (uses `price`), 1 = PerDistance (uses `distancePrice`). */
export const AdditionalServiceChargeType = { Flat: 0, PerDistance: 1 } as const;

/**
 * Which journey a PerDistance additional service performs, and therefore which of the
 * booking's two measured legs it bills. A booking can name a pickup address and a
 * different drop-off address, so collecting the pet and returning it are separate
 * routes with separate distances.
 */
export const DistanceLeg = { Pickup: 0, DropOff: 1, RoundTrip: 2 } as const;

/**
 * One optional extra a service offers — an open-ended catalog, not the three fixed
 * flags this replaced. Writable nested on the service POST/PUT as
 * `additionalServices` (upsert by id: known ids update in place, id-less items are
 * created, omitted rows are removed) or standalone via /api/service-additional-services.
 *
 * `chargeType` decides which price field applies, and the two must agree — a
 * PerDistance entry needs `distancePrice` and a `distanceLeg`, a Flat one needs
 * neither (the API 422s the mismatch).
 */
export type AdditionalServiceDto = {
  id?: number | null;
  serviceId?: number;
  name: string;
  description?: string | null;
  chargeType: number;
  /** Flat surcharge. Only meaningful when chargeType is Flat. */
  price?: number;
  /** Per-km price. Required when chargeType is PerDistance. */
  distancePrice?: LocationBasedPriceDto | null;
  /** Required when chargeType is PerDistance — see DistanceLeg. */
  distanceLeg?: number | null;
  /** Deactivate to stop offering it on new bookings without deleting it. */
  isActive?: boolean;
  /** Read-only: currency the amounts are expressed in. */
  currency?: string | null;
};

export type ServiceDto = {
  id?: number | null;
  serviceProviderId: number;
  // Read-only slim provider embed on the service GET (see ServiceProviderInfoDto).
  serviceProvider?: ServiceProviderInfoDto | null;
  /**
   * The currency this aggregate's amounts are in — and it means different things by
   * direction (BACKEND_GAPS S8 resolved; verified live 2026-08-05 on GET /api/services/1).
   *
   * READ: what the server converted the amounts INTO, which is the caller's display
   * preference, not some property of the service (storage is always RSD). A EUR viewer
   * and an RSD viewer get different numbers off the same row.
   *
   * WRITE: what the amounts in this payload are DECLARED to be, which the server converts
   * from before storing. Omitting it means RSD — so a form filled from a EUR read must
   * say `currency: "EUR"` or its prices get rescaled. `createService`/`updateService`
   * stamp it for you (see `declaredWriteCurrency`); don't rely on callers remembering.
   *
   * The root governs the whole aggregate: nested `additionalServices`, `pricingOptions`
   * and `discounts` are converted with it and must NOT declare their own.
   */
  currency?: string | null;
  name?: string | null;
  // Long description — the write field (GET also mirrors it as `about`).
  description?: string | null;
  // ServiceProviderType enum (0=Sitter,1=Walker,2=Boarder,3=PetHotel,4=Groomer)
  type?: number | null;
  isActive?: boolean | null;
  // Pricing/escrow live ONLY under `pricing` on the wire (the old top-level
  // basePrice/escrow* fields were removed from the API). Add-on money is NOT here —
  // each optional extra is its own `additionalServices` entry with its own price.
  pricing?: {
    basePrice: number;
    // PricingUnit enum (0–3); keep the server's value when round-tripping
    unit?: number;
    isEscrowPercentEnabled: boolean;
    escrowPercent?: number | null;
    escrowAmount: number;
  };
  // The optional extras this service offers. Nullable on write: omit to leave the
  // catalog untouched; send an array to make it the desired full set (upsert by id).
  // Read-only on GET as the full list.
  additionalServices?: AdditionalServiceDto[] | null;
  details?: {
    supportsLiveTracking: boolean;
    // Accepted pet species — PetSpeciesType FLAGS (63 = All). Defaults to 0
    // (None) if omitted on write, so always send a value.
    acceptedSpecies?: number;
    minWeightKg?: number | null;
    maxWeightKg?: number | null;
    minDurationMinutes?: number | null;
    maxDurationMinutes?: number | null;
    leadTimeHours?: number | null;
    // Capacity: how many bookings may overlap the same time window
    maxConcurrentBookings?: number | null;
    foodPricings?: ServiceFoodPricingDto[] | null;
  };
  // Per-day working hours (managed via /api/service-schedules; embedded on GET)
  schedules?: ServiceScheduleDto[] | null;
  // Duration/price variants (managed via /api/service-pricing-options; embedded
  // on GET). Non-empty → bookings must pick one; empty → classic booking.
  pricingOptions?: ServicePricingOptionDto[] | null;
  // The service's location — carries geo coords under `address.location` (used
  // for map placement). WRITABLE, with a quirky PUT contract (verified live
  // 2026-07-19): POST accepts it inline (id 0 → row created + linked); PUT only
  // accepts the service's EXISTING address id (updates it in place) and 500s on
  // a new inline address — create the row via createAddress() (services/
  // addresses.ts) first and send the returned real-id row instead (see
  // resolveServiceAddressForSave in my-services-screen/serviceModel.ts).
  // Omitting the field on PUT keeps the stored address.
  address?: AddressDto | null;
  // Read-only fields the API computes and returns on GET (not sent on create):
  imageUrl?: string | null;
  basicServiceName?: string | null; // human label for the service type, e.g. "Walker"
  rating?: number | null; // service-level average rating
  totalRatingNumber?: number | null; // service-level review count
  distanceFromMyLocationKm?: number | null;
  price?: number | null; // effective price after any applied discount
  appliedDiscountType?: number | null;
  appliedDiscountAmount?: number | null;
  about?: string | null; // read-only mirror of description
  photos?: {
    id?: number | null;
    alt?: string | null;
    name?: string | null;
    src?: string | null;
    fileUploadId?: number | null;
    isSelected: boolean;
  }[];
  // Read-only includes the service GET now embeds:
  reviewCount?: number; // number of reviews backing `rating`
  reviews?: ReviewDto[]; // embedded reviews (may include all statuses — public screens still filter by approvalStatus)
  upcomingBookings?: ServiceBookedSlotReadDto[]; // booked slots for availability
};

/**
 * Display-side mirror of the server's discount math for a pricing option
 * (Domain/ServicePricing.ApplyDiscount): the service GET exposes the active
 * discount as appliedDiscountType/appliedDiscountAmount, and the server applies
 * it to the chosen option's price when the booking is created. Percent →
 * price * (1 - amount/100); Fixed → max(0, price - amount). No active discount
 * (amount null) → the option price unchanged.
 */
export function effectiveOptionPrice(svc: ServiceDto, option: ServicePricingOptionDto): number {
  const amount = svc.appliedDiscountAmount;
  if (amount == null) return option.price;
  if (svc.appliedDiscountType === DiscountType.Percent) {
    return Math.max(0, option.price - (option.price * amount) / 100);
  }
  return Math.max(0, option.price - amount);
}

/**
 * The currency a service's amounts are in, or `undefined` when the record doesn't say.
 *
 * Use this instead of reading `svc.currency` directly: the currency belongs to the
 * provider, and the API may expose it on either the service or its provider embed.
 * `undefined` is a valid answer — `formatMoney` then falls back to the viewer's display
 * preference, which is all the app can honestly claim (see BACKEND_GAPS S8).
 */
export function serviceCurrency(svc?: ServiceDto | null): string | undefined {
  return svc?.currency ?? svc?.serviceProvider?.currency ?? undefined;
}

export type GetServicesParams = {
  serviceProviderId?: number;
  name?: string;
  // ServiceProviderType filter on the service's own `type`
  type?: number;
  isActive?: boolean;
  // Add-on availability filters (renamed server-side in the 2026-06 update).
  supportsPickup?: boolean;
  supportsLeaveOver?: boolean;
  supportsSpecialNeeds?: boolean;
  page?: number;
  perPage?: number;
};

export async function getServices(params?: GetServicesParams): Promise<ServiceDto[]> {
  const query = new URLSearchParams();
  if (params?.serviceProviderId !== undefined)
    query.set('ServiceProviderId', String(params.serviceProviderId));
  if (params?.name) query.set('Name', params.name);
  if (params?.type !== undefined) query.set('Type', String(params.type));
  if (params?.isActive !== undefined) query.set('IsActive', String(params.isActive));
  if (params?.supportsPickup !== undefined)
    query.set('IsProvidingPickup', String(params.supportsPickup));
  if (params?.supportsLeaveOver !== undefined)
    query.set('IsProvidingReturn', String(params.supportsLeaveOver));
  if (params?.supportsSpecialNeeds !== undefined)
    query.set('IsProvidingSpecialNeeds', String(params.supportsSpecialNeeds));
  query.set('Page', String(params?.page ?? 1));
  query.set('PerPage', String(params?.perPage ?? 50));

  const url = `${getApiBaseUrl()}/api/services?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load services.', 'getServices'));
  }

  const raw = await response.json();
  return extractPageItems<ServiceDto>(raw);
}

export async function getService(id: number): Promise<ServiceDto> {
  const url = `${getApiBaseUrl()}/api/services/${id}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load service.', 'getService'));
  }

  return response.json();
}

/**
 * Declares which currency the payload's amounts are in, so the server converts them to
 * storage instead of assuming RSD. Stamped here rather than at the call sites: every
 * money field on the aggregate is affected, and a forgotten declaration doesn't fail —
 * it silently rescales the provider's prices. See `declaredWriteCurrency`.
 */
function withDeclaredCurrency<T extends { currency?: string | null }>(service: T): T {
  return { ...service, currency: declaredWriteCurrency(service.currency) };
}

export async function createService(service: Omit<ServiceDto, 'id'>): Promise<ServiceDto> {
  const url = `${getApiBaseUrl()}/api/services`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(withDeclaredCurrency(service)),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to create service.', 'createService'));
  }

  return response.json();
}

export async function updateService(id: number, service: ServiceDto): Promise<ServiceDto> {
  const url = `${getApiBaseUrl()}/api/services/${id}`;
  const response = await apiAuthFetch(url, {
    method: 'PUT',
    body: JSON.stringify(withDeclaredCurrency(service)),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to update service.', 'updateService'));
  }

  return response.json();
}

export async function deleteService(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/services/${id}`;
  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to delete service.', 'deleteService'));
  }
}

// One bookable window for a given day — derived server-side from the service's
// schedules, with the capacity left after the provider's existing bookings.
// from/to are "HH:mm:ss" (same shape as ServiceScheduleDto).
export type AvailabilityWindowDto = {
  from: string;
  to: string;
  remainingCapacity: number;
};

export type ServiceAvailabilityDayDto = {
  date: string; // "YYYY-MM-DD"
  windows: AvailabilityWindowDto[];
};

export type ServiceAvailabilityDto = {
  serviceId: number;
  days: ServiceAvailabilityDayDto[];
};

// GET /api/services/{id}/availability?from=&to= — schedule-driven bookable
// windows for a date range, one entry per day. `from`/`to` MUST be date-only
// ("YYYY-MM-DD"); full ISO datetimes are rejected. Preferred over deriving slot
// windows from the embedded service.schedules — the server already factors in
// the provider's bookings (per-window remainingCapacity).
export async function getServiceAvailability(
  id: number,
  from: string,
  to: string
): Promise<ServiceAvailabilityDto> {
  const query = new URLSearchParams({ from, to });
  const url = `${getApiBaseUrl()}/api/services/${id}/availability?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to load availability.', 'getServiceAvailability')
    );
  }

  return response.json();
}
