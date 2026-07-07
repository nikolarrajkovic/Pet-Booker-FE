import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
import { ServicePricingOptionDto } from './services';

// Duration/price variants of a service ("30 minutes / $20", "1 hour / $35").
// The same shape is embedded on the service GET as `service.pricingOptions[]`,
// so reads usually come from there — this module owns the writes used to
// persist the AddEditService "Pricing & Duration" tiers. Ownership is enforced
// server-side (a provider can only manage options on their own services).
export type { ServicePricingOptionDto };

export async function getServicePricingOptions(
  serviceId: number
): Promise<ServicePricingOptionDto[]> {
  const query = new URLSearchParams();
  query.set('ServiceId', String(serviceId));
  query.set('PerPage', '50');
  const url = `${getApiBaseUrl()}/api/service-pricing-options?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to load pricing options.', 'getServicePricingOptions')
    );
  }

  const raw = await response.json();
  return extractPageItems<ServicePricingOptionDto>(raw);
}

export async function createServicePricingOption(
  option: ServicePricingOptionDto
): Promise<ServicePricingOptionDto> {
  const url = `${getApiBaseUrl()}/api/service-pricing-options`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(option),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
        'Failed to save pricing option.',
        'createServicePricingOption'
      )
    );
  }

  return response.json();
}

export async function updateServicePricingOption(
  id: number,
  option: ServicePricingOptionDto
): Promise<ServicePricingOptionDto> {
  const url = `${getApiBaseUrl()}/api/service-pricing-options/${id}`;
  const response = await apiAuthFetch(url, {
    method: 'PUT',
    body: JSON.stringify({ ...option, id }),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
        'Failed to update pricing option.',
        'updateServicePricingOption'
      )
    );
  }

  return response.json();
}

export async function deleteServicePricingOption(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/service-pricing-options/${id}`;
  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
        'Failed to remove pricing option.',
        'deleteServicePricingOption'
      )
    );
  }
}

/**
 * Reconciles a service's pricing options to match `desired`. Unlike
 * saveServiceSchedules (keyed by day), options have no natural key, so the diff
 * is BY ID against `existing` (usually `service.pricingOptions` from the GET):
 *   - desired without an id                        → POST
 *   - desired with an id, any field changed        → PUT
 *   - existing id absent from desired              → DELETE
 * Unchanged options make no request. Runs the resulting calls in parallel.
 * Deleting every tier reverts the service to classic free-range booking.
 */
export async function saveServicePricingOptions(
  serviceId: number,
  desired: ServicePricingOptionDto[],
  existing: ServicePricingOptionDto[] = []
): Promise<void> {
  const existingById = new Map<number, ServicePricingOptionDto>();
  for (const o of existing) if (o.id != null) existingById.set(o.id, o);

  const ops: Promise<unknown>[] = [];
  const keptIds = new Set<number>();

  for (const want of desired) {
    const have = want.id != null ? existingById.get(want.id) : undefined;
    if (want.id != null && have) {
      keptIds.add(want.id);
      const changed =
        have.name !== want.name ||
        have.durationMinutes !== want.durationMinutes ||
        have.price !== want.price ||
        (have.description ?? null) !== (want.description ?? null);
      if (changed) ops.push(updateServicePricingOption(want.id, { ...want, serviceId }));
    } else {
      ops.push(createServicePricingOption({ ...want, id: undefined, serviceId }));
    }
  }

  for (const [id] of existingById) {
    if (!keptIds.has(id)) ops.push(deleteServicePricingOption(id));
  }

  await Promise.all(ops);
}
