import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
import type { AddressDto } from './service-providers';
import type { ReviewDto } from './reviews';
import { DiscountType } from './service-discounts';

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
};

// Per-weight-bracket food pricing (PetWeightBracket: 0=Small, 1=Medium, 2=Large)
export type ServiceFoodPricingDto = {
  weightBracket: number;
  pricePerDay: number;
};

// Location-based surcharge (Pickup / Pet-return). The fee is `baseFee` plus
// `perKmFee` per km beyond `freeDistanceKm`, capped at `maxDistanceKm`. The
// AddEditService form only captures a single flat fee today → mapped to
// `baseFee` (perKmFee/distance fields default to 0/null and round-trip on edit).
export type LocationBasedPriceDto = {
  baseFee: number;
  perKmFee: number;
  freeDistanceKm?: number | null;
  maxDistanceKm?: number | null;
};

export type ServiceDto = {
  id?: number | null;
  serviceProviderId: number;
  name?: string | null;
  // Long description — the write field (GET also mirrors it as `about`).
  description?: string | null;
  // ServiceProviderType enum (0=Sitter,1=Walker,2=Boarder,3=PetHotel,4=Groomer)
  type?: number | null;
  isActive?: boolean | null;
  // Pricing/escrow live ONLY under `pricing` on the wire (the old top-level
  // basePrice/escrow* fields were removed from the API). The add-on SURCHARGE
  // money also lives here now (moved out of `details` in the 2026-06 update):
  // pickup/pet-return are structured LocationBasedPriceDto, special-needs is a flat fee.
  pricing?: {
    basePrice: number;
    // PricingUnit enum (0–3); keep the server's value when round-tripping
    unit?: number;
    isEscrowPercentEnabled: boolean;
    escrowPercent?: number | null;
    escrowAmount: number;
    // Surcharges — null when the add-on isn't offered. See details.is*Provided
    // for the matching on/off flags.
    pickupPrice?: LocationBasedPriceDto | null;
    petReturnPrice?: LocationBasedPriceDto | null;
    specialNeedsPrice?: number | null;
  };
  details?: {
    // On/off flags for the add-ons (the SURCHARGE amounts live under `pricing`).
    isPickupProvided: boolean;
    isPetReturnProvided: boolean;
    isSpecialNeedsProvided: boolean;
    canSpecialNeedsChange: boolean;
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
  // The service's address — now carries geo coords under `address.location`
  // (used for map placement). Read-only on the service read DTO.
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

export async function createService(service: Omit<ServiceDto, 'id'>): Promise<ServiceDto> {
  const url = `${getApiBaseUrl()}/api/services`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(service),
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
    body: JSON.stringify(service),
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
