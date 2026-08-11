import { apiList, apiPage, apiVoid, type ApiRequestOptions, type PagedResult } from './http';

// NotificationType (swagger enum, NOT exposed via /enums — synced with the
// backend's Domain.NotificationType 2026-07). Drives the per-row icon in the inbox.
export const NotificationType = {
  NewBookingRequest: 0,
  BookingConfirmed: 1,
  ServiceCompleted: 2,
  ProviderProfileApproved: 3,
  ProviderProfileDeclined: 4,
  CertificateApproved: 5,
  CertificateDeclined: 6,
  ReviewDeclined: 7,
  BookingDeclined: 8,
  // The provider started a live-tracked (Walker/Transporter) service — dataJson
  // carries { bookingId, sessionId }; deep-link to LiveSession (user mode).
  LiveTrackingStarted: 9,
  UpcomingBookingReminder: 10,
  BookingCancelled: 11,
  // Non-tracked services get this instead of LiveTrackingStarted.
  ServiceStarted: 12,
  BookingPriceAdjusted: 13,
  PaymentReceived: 14,
} as const;

/** A single in-app notification (read shape from GET /api/app-notifications). */
export type AppNotificationDto = {
  id: number;
  userId: number;
  providerProfileId?: number | null;
  type: number; // NotificationType 0..10
  title: string;
  message: string;
  dataJson?: string | null; // e.g. '{"bookingId":4030}'
  paramsJson?: string | null; // dynamic text tokens, e.g. '{"ProviderName":"…"}'
  isRead: boolean;
  readAt?: string | null;
  createdAt: string; // ISO date-time
};

export type GetAppNotificationsParams = {
  userId?: number;
  isRead?: boolean;
  type?: number;
  page?: number;
  perPage?: number;
};

/** Shared request options for the list shapes below — one place for the filter names. */
function notificationsRequest(params?: GetAppNotificationsParams): ApiRequestOptions {
  return {
    query: {
      UserId: params?.userId,
      IsRead: params?.isRead,
      Type: params?.type,
      Page: params?.page ?? 1,
      PerPage: params?.perPage ?? 50,
    },
    fallback: 'Failed to load notifications.',
    context: 'getAppNotifications',
  };
}

/** Returns the user's in-app notifications (newest first as served by the API). */
export function getAppNotifications(
  params?: GetAppNotificationsParams
): Promise<AppNotificationDto[]> {
  return apiList<AppNotificationDto>('/api/app-notifications', notificationsRequest(params));
}

/**
 * One page of notifications, with the counts needed to fetch the next — for `usePagedList`.
 * A notification feed grows without limit, so the un-paged variant above only ever shows the
 * newest page.
 */
export function getAppNotificationsPage(
  params?: GetAppNotificationsParams
): Promise<PagedResult<AppNotificationDto>> {
  return apiPage<AppNotificationDto>('/api/app-notifications', notificationsRequest(params));
}

/**
 * Cheap unread-count probe — asks for a single row and reads the wrapper's `totalItems`
 * rather than the page itself. `extractPage` falls back to the item count for a response
 * with no counts, so this stays correct against a bare-array endpoint.
 */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const page = await apiPage<AppNotificationDto>('/api/app-notifications', {
    ...notificationsRequest({ userId, isRead: false, page: 1, perPage: 1 }),
    fallback: 'Failed to load unread count.',
    context: 'getUnreadNotificationCount',
  });
  return page.totalItems;
}

// The write DTO only accepts { id, isRead } — the server stamps readAt itself
// (verified live). Everything else is read-only.
export function markNotificationRead(id: number, isRead = true): Promise<void> {
  return apiVoid(`/api/app-notifications/${id}`, {
    method: 'PUT',
    body: { id, isRead },
    fallback: 'Failed to update notification.',
    context: 'markNotificationRead',
  });
}

/** Marks every supplied notification read in parallel (best-effort). */
export async function markAllNotificationsRead(ids: number[]): Promise<void> {
  await Promise.all(ids.map((id) => markNotificationRead(id, true)));
}

/** Safely pulls the bookingId out of a notification's dataJson payload, if any. */
export function notificationBookingId(n: AppNotificationDto): number | null {
  if (!n.dataJson) return null;
  try {
    const parsed = JSON.parse(n.dataJson);
    const id = parsed?.bookingId;
    return typeof id === 'number' ? id : null;
  } catch {
    return null;
  }
}
