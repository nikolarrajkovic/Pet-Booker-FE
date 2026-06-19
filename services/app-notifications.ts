import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';

// NotificationType (swagger enum, NOT exposed via /enums — names verified from
// live seed data 2026-06-18). Drives the per-row icon in the inbox.
export const NotificationType = {
  NewBookingRequest: 0,
  BookingConfirmed: 1,
  ServiceCompleted: 2,
  ProviderProfileApproved: 3,
  ProviderProfileDeclined: 4,
  CertificateApproved: 5,
  CertificateDeclined: 6,
  BookingDeclined: 8,
  UpcomingBookingReminder: 10,
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

function buildQuery(params?: GetAppNotificationsParams): URLSearchParams {
  const query = new URLSearchParams();
  if (params?.userId !== undefined) query.set('UserId', String(params.userId));
  if (params?.isRead !== undefined) query.set('IsRead', String(params.isRead));
  if (params?.type !== undefined) query.set('Type', String(params.type));
  query.set('Page', String(params?.page ?? 1));
  query.set('PerPage', String(params?.perPage ?? 50));
  return query;
}

/** Returns the user's in-app notifications (newest first as served by the API). */
export async function getAppNotifications(
  params?: GetAppNotificationsParams
): Promise<AppNotificationDto[]> {
  const url = `${getApiBaseUrl()}/api/app-notifications?${buildQuery(params).toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to load notifications.', 'getAppNotifications')
    );
  }

  const raw = await response.json();
  return extractPageItems<AppNotificationDto>(raw);
}

/** Cheap unread-count probe — reads the pagination wrapper's totalItems. */
export async function getUnreadNotificationCount(userId: number): Promise<number> {
  const query = buildQuery({ userId, isRead: false, page: 1, perPage: 1 });
  const url = `${getApiBaseUrl()}/api/app-notifications?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to load unread count.', 'getUnreadNotificationCount')
    );
  }

  const raw = await response.json();
  return typeof raw?.totalItems === 'number'
    ? raw.totalItems
    : extractPageItems<AppNotificationDto>(raw).length;
}

// The write DTO only accepts { id, isRead } — the server stamps readAt itself
// (verified live). Everything else is read-only.
export async function markNotificationRead(id: number, isRead = true): Promise<void> {
  const url = `${getApiBaseUrl()}/api/app-notifications/${id}`;
  const response = await apiAuthFetch(url, {
    method: 'PUT',
    body: JSON.stringify({ id, isRead }),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to update notification.', 'markNotificationRead')
    );
  }
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
