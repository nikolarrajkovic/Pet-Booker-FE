import { apiVoid } from './http';

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

/** POSTs a bodiless moderation action (the `/approve` endpoints). */
function approveAction(path: string, fallback: string, context: string): Promise<void> {
  return apiVoid(path, { method: 'POST', fallback, context });
}

/** POSTs a moderation action carrying the shared `{ reason }` body (the `/decline` endpoints). */
function declineAction(
  path: string,
  reason: string | undefined,
  reasonFallback: string,
  fallback: string,
  context: string
): Promise<void> {
  return apiVoid(path, {
    method: 'POST',
    body: { reason: ensureReason(reason, reasonFallback) },
    fallback,
    context,
  });
}

/** Approves a partner application / service provider. */
export function approveServiceProvider(serviceProviderId: number): Promise<void> {
  return approveAction(
    `/admin/service-providers/${serviceProviderId}/approve`,
    'Failed to approve provider.',
    'approveServiceProvider'
  );
}

/**
 * Declines a partner application / service provider (sets approvalStatus =
 * Declined with an optional reason). The record is kept — this replaces the
 * old "reject = delete the provider" workaround.
 */
export function declineServiceProvider(serviceProviderId: number, reason?: string): Promise<void> {
  return declineAction(
    `/admin/service-providers/${serviceProviderId}/decline`,
    reason,
    'Application declined by admin.',
    'Failed to decline provider.',
    'declineServiceProvider'
  );
}

/** Approves a single certificate attached to a provider application. */
export function approveCertificate(certificateId: number): Promise<void> {
  return approveAction(
    `/admin/certificates/${certificateId}/approve`,
    'Failed to approve certificate.',
    'approveCertificate'
  );
}

/** Declines a single certificate attached to a provider application. */
export function declineCertificate(certificateId: number, reason?: string): Promise<void> {
  return declineAction(
    `/admin/certificates/${certificateId}/decline`,
    reason,
    'Certificate declined by admin.',
    'Failed to decline certificate.',
    'declineCertificate'
  );
}

/**
 * Approves a single user-submitted review (sets approvalStatus = Approved so it
 * becomes publicly visible). Verified live: POST returns 200.
 */
export function approveReview(reviewId: number): Promise<void> {
  return approveAction(
    `/admin/reviews/${reviewId}/approve`,
    'Failed to approve review.',
    'approveReview'
  );
}

/**
 * Declines a single review (sets approvalStatus = Declined and stores an optional
 * reason). The record is kept; declined reviews never surface to users.
 */
export function declineReview(reviewId: number, reason?: string): Promise<void> {
  return declineAction(
    `/admin/reviews/${reviewId}/decline`,
    reason,
    'Review declined by moderator.',
    'Failed to decline review.',
    'declineReview'
  );
}

/** Bulk-approves multiple reviews in one call (POST /admin/reviews/approve, `{ ids }`). */
export function approveReviews(reviewIds: number[]): Promise<void> {
  return apiVoid('/admin/reviews/approve', {
    method: 'POST',
    body: { ids: reviewIds },
    fallback: 'Failed to approve reviews.',
    context: 'approveReviews',
  });
}
