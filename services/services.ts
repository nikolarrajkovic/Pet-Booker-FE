import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';

export type ServiceDto = {
  id?: number | null;
  serviceProviderId: number;
  name?: string | null;
  notes?: string | null;
  basePrice: number;
  escrowAmount: number;
  isEscrowPercentEnabled: boolean;
  escrowPercent?: number | null;
  // Read-only fields the API computes and returns on GET (not sent on create):
  imageUrl?: string | null;
  basicServiceName?: string | null;        // human label for the service type, e.g. "Walker"
  rating?: number | null;                  // service-level average rating
  totalRatingNumber?: number | null;       // service-level review count
  distanceFromMyLocationKm?: number | null;
  price?: number | null;                   // effective price after any applied discount
  appliedDiscountType?: number | null;
  appliedDiscountAmount?: number | null;
  about?: string | null;                   // long description
  pricing?: {
    basePrice: number;
    isEscrowPercentEnabled: boolean;
    escrowPercent?: number | null;
    escrowAmount: number;
  };
  details?: {
    supportsPickup: boolean;
    pickupPriceSurcharge?: number | null;
    supportsLeaveOver: boolean;
    leaveOverPriceSurcharge?: number | null;
  };
  photos?: Array<{
    id?: number | null;
    alt?: string | null;
    name?: string | null;
    src?: string | null;
    fileUploadId?: number | null;
    isSelected: boolean;
  }>;
};

export type GetServicesParams = {
  serviceProviderId?: number;
  name?: string;
  supportsPickup?: boolean;
  supportsLeaveOver?: boolean;
  page?: number;
  perPage?: number;
};

export async function getServices(params?: GetServicesParams): Promise<ServiceDto[]> {
  const query = new URLSearchParams();
  if (params?.serviceProviderId !== undefined) query.set('ServiceProviderId', String(params.serviceProviderId));
  if (params?.name) query.set('Name', params.name);
  if (params?.supportsPickup !== undefined) query.set('SupportsPickup', String(params.supportsPickup));
  if (params?.supportsLeaveOver !== undefined) query.set('SupportsLeaveOver', String(params.supportsLeaveOver));
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
