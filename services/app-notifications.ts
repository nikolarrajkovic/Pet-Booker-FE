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
  // A direct message arrived — dataJson carries { conversationId, messageId }. Deliberately
  // kept OUT of the inbox and its badge: chat has its own inbox and its own unread count, and
  // filing every message in the notification feed buries the booking events it exists for.
  // It still arrives as a live toast, which is what carries the user into the thread.
  NewMessage: 15,
} as const;

/**
 * Types the notification inbox does not show. Not a general mute list — a type belongs here only
 * when the app surfaces it somewhere better, as chat does with its own inbox.
 */
const INBOX_HIDDEN_TYPES: number[] = [NotificationType.NewMessage];

/** Whether a notification belongs in the inbox feed (and therefore in its unread badge). */
export function isInboxNotification(n: AppNotificationDto): boolean {
  return !INBOX_HIDDEN_TYPES.includes(n.type);
}

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
async function countNotifications(params: GetAppNotificationsParams): Promise<number> {
  const page = await apiPage<AppNotificationDto>('/api/app-notifications', {
    ...notificationsRequest({ ...params, page: 1, perPage: 1 }),
    fallback: 'Failed to load unread count.',
    context: 'getUnreadNotificationCount',
  });
  return page.totalItems;
}

/** How many rows the inbox is hiding under the given query — one probe per hidden type. */
async function countHiddenNotifications(params: GetAppNotificationsParams): Promise<number> {
  const counts = await Promise.all(
    INBOX_HIDDEN_TYPES.map((type) => countNotifications({ ...params, type }))
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * Unread rows the BELL stands for — everything the inbox will actually show.
 *
 * Counted as "all unread minus unread messages" rather than by filtering fetched rows: both are
 * one-row probes that read `totalItems`, so the answer is exact however many notifications exist,
 * where filtering a fetched page would silently cap at whatever the page held. Hiding a type from
 * the list without also removing it from this count would leave a badge the user cannot clear —
 * the rows driving it are unreachable.
 */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const [all, hidden] = await Promise.all([
    countNotifications({ userId, isRead: false }),
    countHiddenNotifications({ userId, isRead: false }),
  ]);
  return Math.max(0, all - hidden);
}

/**
 * One page of the inbox feed, with hidden types removed.
 *
 * The API filters *to* a type, never away from one, so the exclusion happens here. The total is
 * corrected by the same subtraction the badge uses, keeping "showing X of Y" honest; `hasMore`
 * still comes from the server, which is paging the unfiltered feed — so a page can render fewer
 * rows than it fetched, and scrolling simply pulls the next one.
 */
export async function getInboxNotificationsPage(
  params?: GetAppNotificationsParams
): Promise<PagedResult<AppNotificationDto>> {
  const [page, hidden] = await Promise.all([
    getAppNotificationsPage(params),
    countHiddenNotifications({ ...params, page: undefined, perPage: undefined }),
  ]);
  return {
    ...page,
    items: page.items.filter(isInboxNotification),
    totalItems: Math.max(0, page.totalItems - hidden),
  };
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

/** Safely pulls a numeric id out of a notification's dataJson payload, if any. */
function notificationDataId(n: AppNotificationDto, key: string): number | null {
  if (!n.dataJson) return null;
  try {
    const id = JSON.parse(n.dataJson)?.[key];
    return typeof id === 'number' ? id : null;
  } catch {
    return null;
  }
}

/** Safely pulls the bookingId out of a notification's dataJson payload, if any. */
export function notificationBookingId(n: AppNotificationDto): number | null {
  return notificationDataId(n, 'bookingId');
}

/** The thread a message notification points at — `{ conversationId, messageId }` in dataJson. */
export function notificationConversationId(n: AppNotificationDto): number | null {
  return notificationDataId(n, 'conversationId');
}
