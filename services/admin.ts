import { apiAuthFetch, getApiBaseUrl, parseApiError } from './http';

/**
 * Admin-only endpoints. All require the caller to have the Admin role
 * (enforced server-side via the Bearer token).
 */

/** Approves a partner application / service provider. */
export async function approveServiceProvider(serviceProviderId: number): Promise<void> {
  const url = `${getApiBaseUrl()}/admin/service-providers/${serviceProviderId}/approve`;
  const response = await apiAuthFetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to approve provider.', 'approveServiceProvider'));
  }
}

/** Approves a single certificate attached to a provider application. */
export async function approveCertificate(certificateId: number): Promise<void> {
  const url = `${getApiBaseUrl()}/admin/certificates/${certificateId}/approve`;
  const response = await apiAuthFetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to approve certificate.', 'approveCertificate'));
  }
}
