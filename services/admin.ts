import { apiJson, apiList, apiVoid } from './http';
import type { AddressDto, ServiceProviderDto } from './service-providers';

// ── Partner moderation ────────────────────────────────────────────────────────────────────────
// Timeout pauses a partner's new business until a date (their existing bookings stay); a ban cuts
// them off — no sign-in, services hidden, bookings not yet started called off. Each carries a
// reason the partner is told. Every call answers with the updated provider.

/** Backend `ProviderModerationActionType`. */
export const ModerationAction = { TimedOut: 0, TimeoutLifted: 1, Banned: 2, Unbanned: 3 } as const;
export type ModerationActionValue = (typeof ModerationAction)[keyof typeof ModerationAction];

export type ModerationHistoryEntry = {
  id: number;
  serviceProviderId: number;
  action: ModerationActionValue;
  reason?: string | null;
  /** The end the admin set, for a timeout. */
  timedOutUntil?: string | null;
  decidedByName?: string | null;
  createdAt: string;
};

/** Pauses the partner until `until` (at most 365 days away); `reason` is 10–1000 characters. */
export function timeoutPartner(
  id: number,
  until: Date,
  reason: string
): Promise<ServiceProviderDto> {
  return apiJson<ServiceProviderDto>(`/admin/service-providers/${id}/timeout`, {
    method: 'POST',
    body: { until: until.toISOString(), reason: reason.trim() },
    fallback: 'Failed to put the partner on timeout.',
    context: 'timeoutPartner',
  });
}

export function liftPartnerTimeout(id: number, reason?: string): Promise<ServiceProviderDto> {
  return apiJson<ServiceProviderDto>(`/admin/service-providers/${id}/lift-timeout`, {
    method: 'POST',
    body: { reason: reason?.trim() || null },
    fallback: 'Failed to lift the timeout.',
    context: 'liftPartnerTimeout',
  });
}

export function banPartner(id: number, reason: string): Promise<ServiceProviderDto> {
  return apiJson<ServiceProviderDto>(`/admin/service-providers/${id}/ban`, {
    method: 'POST',
    body: { reason: reason.trim() },
    fallback: 'Failed to ban the partner.',
    context: 'banPartner',
  });
}

export function unbanPartner(id: number, reason?: string): Promise<ServiceProviderDto> {
  return apiJson<ServiceProviderDto>(`/admin/service-providers/${id}/unban`, {
    method: 'POST',
    body: { reason: reason?.trim() || null },
    fallback: 'Failed to unban the partner.',
    context: 'unbanPartner',
  });
}

/** Every timeout, ban and lift on a partner, newest first. */
export function getModerationHistory(serviceProviderId: number): Promise<ModerationHistoryEntry[]> {
  return apiList<ModerationHistoryEntry>('/api/provider-moderation-actions', {
    query: { ServiceProviderId: serviceProviderId, Page: 1, PerPage: 100 },
    fallback: 'Failed to load the moderation history.',
    context: 'getModerationHistory',
  });
}

/** Admin → Add Partner: the partner and the language their invite email is written in. */
export type InvitePartnerPayload = {
  name: string;
  email: string;
  phone?: string | null;
  /** ServiceProviderType (from /enums). */
  type: number;
  yearsOfExperience?: number | null;
  about?: string | null;
  address?: AddressDto | null;
  language: string;
};

export type InvitePartnerResult = {
  providerProfileId: number;
  serviceProviderId: number;
  email: string;
  inviteSent: boolean;
};

/**
 * Adds a partner on their behalf and emails them an invite to set their password
 * (`POST /admin/partners/invite`). The partner is created approved, and is all or nothing: a taken
 * email (or any other refusal) leaves nothing behind.
 */
export function invitePartner(payload: InvitePartnerPayload): Promise<InvitePartnerResult> {
  return apiJson<InvitePartnerResult>('/admin/partners/invite', {
    method: 'POST',
    body: payload,
    fallback: 'Failed to add the partner.',
    context: 'invitePartner',
  });
}

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
