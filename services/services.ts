import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';

// Per-day working-hours window for a service (NEW in the schedules API).
// day is .NET DayOfWeek: 0=Sunday … 6=Saturday. from/to are "HH:mm:ss" times.
export type ServiceScheduleDto = {
  id?: number | null;
  serviceId: number;
  day: number;
  from: string;
  to: string;
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
  // Read-only fields the API computes and returns on GET (not sent on create):
  imageUrl?: string | null;
  basicServiceName?: string | null;        // human label for the service type, e.g. "Walker"
  rating?: number | null;                  // service-level average rating
  totalRatingNumber?: number | null;       // service-level review count
  distanceFromMyLocationKm?: number | null;
  price?: number | null;                   // effective price after any applied discount
  appliedDiscountType?: number | null;
  appliedDiscountAmount?: number | null;
  about?: string | null;                   // read-only mirror of description
  photos?: {
    id?: number | null;
    alt?: string | null;
    name?: string | null;
    src?: string | null;
    fileUploadId?: number | null;
    isSelected: boolean;
  }[];
};

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
  if (params?.serviceProviderId !== undefined) query.set('ServiceProviderId', String(params.serviceProviderId));
  if (params?.name) query.set('Name', params.name);
  if (params?.type !== undefined) query.set('Type', String(params.type));
  if (params?.isActive !== undefined) query.set('IsActive', String(params.isActive));
  if (params?.supportsPickup !== undefined) query.set('IsProvidingPickup', String(params.supportsPickup));
  if (params?.supportsLeaveOver !== undefined) query.set('IsProvidingReturn', String(params.supportsLeaveOver));
  if (params?.supportsSpecialNeeds !== undefined) query.set('IsProvidingSpecialNeeds', String(params.supportsSpecialNeeds));
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
