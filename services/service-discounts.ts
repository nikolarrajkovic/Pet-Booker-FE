import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';

// DiscountType enum (verified /enums): 0=Percent, 1=Fixed
export const DiscountType = { Percent: 0, Fixed: 1 } as const;

export type ServiceDiscountDto = {
  id?: number | null;
  serviceId: number;
  type: number;            // DiscountType
  amount: number;          // fixed amount (or generic amount)
  applyFrom: string;       // ISO date-time
  applyTo?: string | null; // ISO date-time, optional (open-ended)
  isEnabled: boolean;
  percentAmount?: number | null; // percent value when type === Percent
};

export type GetServiceDiscountsParams = {
  serviceId?: number;
  type?: number;
  page?: number;
  perPage?: number;
};

export async function getServiceDiscounts(params?: GetServiceDiscountsParams): Promise<ServiceDiscountDto[]> {
  const query = new URLSearchParams();
  if (params?.serviceId !== undefined) query.set('ServiceId', String(params.serviceId));
  if (params?.type !== undefined) query.set('Type', String(params.type));
  query.set('Page', String(params?.page ?? 1));
  query.set('PerPage', String(params?.perPage ?? 50));

  const url = `${getApiBaseUrl()}/api/service-discounts?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load discounts.', 'getServiceDiscounts'));
  }

  const raw = await response.json();
  return extractPageItems<ServiceDiscountDto>(raw);
}

export async function createServiceDiscount(discount: ServiceDiscountDto): Promise<ServiceDiscountDto> {
  const url = `${getApiBaseUrl()}/api/service-discounts`;
  const response = await apiAuthFetch(url, { method: 'POST', body: JSON.stringify({ id: 0, ...discount }) });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to create discount.', 'createServiceDiscount'));
  }

  return response.json();
}

export async function updateServiceDiscount(id: number, discount: ServiceDiscountDto): Promise<ServiceDiscountDto> {
  const url = `${getApiBaseUrl()}/api/service-discounts/${id}`;
  const response = await apiAuthFetch(url, { method: 'PUT', body: JSON.stringify({ ...discount, id }) });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to update discount.', 'updateServiceDiscount'));
  }

  return response.json();
}

export async function deleteServiceDiscount(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/service-discounts/${id}`;
  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to delete discount.', 'deleteServiceDiscount'));
  }
}
