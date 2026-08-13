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

// There is deliberately no reconciler here. A service's pricing options are written nested on
// the service itself (`ServiceDto.pricingOptions`, built by `uiToServiceDto`): the array is the
// desired full set, upserted by id in one request, and `[]` clears every tier. The per-option
// calls above remain for editing a single tier outside a service save. Diffing client-side
// meant up to one request per tier, each able to fail on its own, and — because an option write
// declares no currency of its own — each storing a provider's EUR prices as RSD.
