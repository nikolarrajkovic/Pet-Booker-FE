import { apiJson, apiList, apiVoid } from './http';
import { ServicePricingOptionDto } from './services';
import { declaredWriteCurrency } from './currency';

// Duration/price variants of a service ("30 minutes / $20", "1 hour / $35").
// The same shape is embedded on the service GET as `service.pricingOptions[]`,
// so reads usually come from there — this module owns the writes used to
// persist the AddEditService "Pricing & Duration" tiers. Ownership is enforced
// server-side (a provider can only manage options on their own services).
export type { ServicePricingOptionDto };

/**
 * Declares the currency `price` is entered in. Unlike the options nested on a service
 * write (where the aggregate root's currency governs), this standalone CRUD carries its
 * own — and omitting it means RSD, which would rescale a tier the partner typed in EUR.
 */
function withDeclaredCurrency(option: ServicePricingOptionDto): ServicePricingOptionDto {
  return { ...option, currency: declaredWriteCurrency(option.currency) };
}

export function getServicePricingOptions(serviceId: number): Promise<ServicePricingOptionDto[]> {
  return apiList<ServicePricingOptionDto>('/api/service-pricing-options', {
    query: { ServiceId: serviceId, PerPage: 50 },
    fallback: 'Failed to load pricing options.',
    context: 'getServicePricingOptions',
  });
}

export function createServicePricingOption(
  option: ServicePricingOptionDto
): Promise<ServicePricingOptionDto> {
  return apiJson<ServicePricingOptionDto>('/api/service-pricing-options', {
    method: 'POST',
    body: withDeclaredCurrency(option),
    fallback: 'Failed to save pricing option.',
    context: 'createServicePricingOption',
  });
}

export function updateServicePricingOption(
  id: number,
  option: ServicePricingOptionDto
): Promise<ServicePricingOptionDto> {
  return apiJson<ServicePricingOptionDto>(`/api/service-pricing-options/${id}`, {
    method: 'PUT',
    body: { ...withDeclaredCurrency(option), id },
    fallback: 'Failed to update pricing option.',
    context: 'updateServicePricingOption',
  });
}

export function deleteServicePricingOption(id: number): Promise<void> {
  return apiVoid(`/api/service-pricing-options/${id}`, {
    method: 'DELETE',
    fallback: 'Failed to remove pricing option.',
    context: 'deleteServicePricingOption',
  });
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
