import { apiAuthFetch, getApiBaseUrl, parseApiError } from './http';

/**
 * Admin-only endpoints. All require the caller to have the Admin role
 * (enforced server-side via the Bearer token).
 */

// The decline endpoints share a DeclineReasonRequest body whose `reason` is
// REQUIRED and must be at least 10 characters (verified live: null → 400, a
// 1–9 char reason → 422). Normalise here so a blank/too-short reason from any
// caller falls back to a valid generic one instead of failing the request.
function ensureReason(reason: string | undefined, fallback: string): string {
  const trimmed = (reason ?? '').trim();
  return trimmed.length >= 10 ? trimmed : fallback;
}

/** Approves a partner application / service provider. */
export async function approveServiceProvider(serviceProviderId: number): Promise<void> {
  const url = `${getApiBaseUrl()}/admin/service-providers/${serviceProviderId}/approve`;
  const response = await apiAuthFetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to approve provider.', 'approveServiceProvider'));
  }
}

/**
 * Declines a partner application / service provider (sets approvalStatus =
 * Declined with an optional reason). The record is kept — this replaces the
 * old "reject = delete the provider" workaround.
 */
export async function declineServiceProvider(serviceProviderId: number, reason?: string): Promise<void> {
  const url = `${getApiBaseUrl()}/admin/service-providers/${serviceProviderId}/decline`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify({ reason: ensureReason(reason, 'Application declined by admin.') }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to decline provider.', 'declineServiceProvider'));
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

/** Declines a single certificate attached to a provider application. */
export async function declineCertificate(certificateId: number, reason?: string): Promise<void> {
  const url = `${getApiBaseUrl()}/admin/certificates/${certificateId}/decline`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify({ reason: ensureReason(reason, 'Certificate declined by admin.') }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to decline certificate.', 'declineCertificate'));
  }
}

/**
 * Approves a single user-submitted review (sets approvalStatus = Approved so it
 * becomes publicly visible). Verified live: POST returns 200.
 */
export async function approveReview(reviewId: number): Promise<void> {
  const url = `${getApiBaseUrl()}/admin/reviews/${reviewId}/approve`;
  const response = await apiAuthFetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to approve review.', 'approveReview'));
  }
}

/**
 * Declines a single review (sets approvalStatus = Declined and stores an optional
 * reason). The record is kept; declined reviews never surface to users.
 */
export async function declineReview(reviewId: number, reason?: string): Promise<void> {
  const url = `${getApiBaseUrl()}/admin/reviews/${reviewId}/decline`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify({ reason: ensureReason(reason, 'Review declined by moderator.') }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to decline review.', 'declineReview'));
  }
}

/** Bulk-approves multiple reviews in one call (POST /admin/reviews/approve, `{ ids }`). */
export async function approveReviews(reviewIds: number[]): Promise<void> {
  const url = `${getApiBaseUrl()}/admin/reviews/approve`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify({ ids: reviewIds }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to approve reviews.', 'approveReviews'));
  }
}
