import { apiJson } from './http';
import type { AddressDto } from './service-providers';

/**
 * POST /api/addresses — standalone address create (auth). Returns the created
 * row with its real id. The API requires a non-empty `state`.
 *
 * Primary use: the service PUT workaround — updating a service 500s when the
 * body carries a NEW inline address (it only accepts the service's existing
 * address id, verified live 2026-07-19), so an edit that ADDS a location must
 * create the row here first and send the returned real-id address instead.
 */
export function createAddress(address: AddressDto): Promise<AddressDto> {
  return apiJson<AddressDto>('/api/addresses', {
    method: 'POST',
    body: { ...address, id: 0 },
    fallback: 'Failed to save the address.',
    context: 'createAddress',
  });
}
