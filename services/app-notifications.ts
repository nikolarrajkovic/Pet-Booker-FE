import { apiList, apiPage, apiVoid, type ApiRequestOptions, type PagedResult } from './http';

// Every kind of in-app notification the backend can send (swagger enum, NOT exposed via
// /enums — mirrors Domain.NotificationType, complete as of 2026-09).
//
// The KEYS are the backend enum's own member names, and that is load-bearing: a device push
// carries `type.ToString()` in its payload (AppNotificationDispatcher.BuildPushData), so
// `notificationTypeFromName` resolves a pushed type by looking it up here. These are wire
// names, not labels — renaming one silently breaks push routing.
export const NotificationType = {
  /** A customer asked for a booking. Provider-facing: they accept or decline it. */
  BookingRequested: 0,
  /** The provider accepted. Customer-facing. */
  BookingConfirmed: 1,
  /** The service finished — the invitation to leave a review. Customer-facing. */
  ServiceCompleted: 2,
  /** An admin approved / declined the partner application. Provider-facing; { serviceProviderId }. */
  ServiceProviderApproved: 3,
  ServiceProviderDeclined: 4,
  /** An admin ruled on one uploaded certificate. Provider-facing; { certificateId }. */
  CertificateApproved: 5,
  CertificateDeclined: 6,
  /** Moderation rejected the review its author wrote. Author-facing; { reviewId }. */
  ReviewDeclined: 7,
  /** The provider turned the request down. Customer-facing. */
  BookingDeclined: 8,
  /** The provider started a live-tracked (Walker/Transporter) service — dataJson
   *  carries { bookingId, sessionId }; deep-link to LiveSession (user mode). */
  LiveTrackingStarted: 9,
  /** 24h / 1h before the appointment, to BOTH sides; { bookingId, offset }. */
  BookingReminder: 10,
  /** The customer called it off before it ran. Provider-facing — their slot is free again. */
  BookingCancelled: 11,
  /** Non-tracked services get this instead of LiveTrackingStarted. */
  ServiceStarted: 12,
  /** The provider re-priced the booking before confirming. Customer-facing. */
  BookingPriceAdjusted: 13,
  /** A receipt — money has been taken. Sent to both sides. */
  PaymentReceived: 14,
  // A direct message arrived — dataJson carries { conversationId, messageId }. Deliberately
  // kept OUT of the inbox and its badge: chat has its own inbox and its own unread count, and
  // filing every message in the notification feed buries the booking events it exists for.
  // It still arrives as a live toast, which is what carries the user into the thread.
  NewChatMessage: 15,
  /** The customer edited a booking the provider had already agreed to. Provider-facing: they
   *  signed up for the OLD terms, so they are told to re-check the new ones. */
  BookingUpdated: 16,
  /** A review of the provider passed moderation and is now on their profile. Provider-facing;
   *  { reviewId, serviceId }. */
  ReviewReceived: 17,
  /** The author's own review passed moderation and is now live. Author-facing;
   *  { reviewId, serviceId }. The mirror of ReviewDeclined. */
  ReviewApproved: 18,
  /** Money is now owed and payable — the deposit once the provider confirms, the balance once
   *  the service ends. Customer-facing, and the ask where PaymentReceived is the receipt. */
  PaymentDue: 19,
} as const;

/**
 * Resolves the numeric type behind a pushed notification's `type`, which arrives as the backend
 * enum's member name ("BookingConfirmed"), not a number. Unknown names — a type added to the
 * backend since this build shipped — resolve to null, and callers fall back to routing by the
 * ids in the payload rather than dropping the notification.
 */
export function notificationTypeFromName(name: unknown): number | null {
  if (typeof name !== 'string') return null;
  const value = (NotificationType as Record<string, number | undefined>)[name];
  return typeof value === 'number' ? value : null;
}

/**
 * Types the notification inbox does not show. Not a general mute list — a type belongs here only
 * when the app surfaces it somewhere better, as chat does with its own inbox.
 *
 * The SERVER applies the same exclusion (NotificationFeed / SearchAppNotificationsQuery: any
 * search that does not name a Type filters these out), so this is the client-side half for the
 * one path the server can't filter — a live SignalR push, which arrives whatever its type.
 */
const INBOX_HIDDEN_TYPES: number[] = [NotificationType.NewChatMessage];

/** Whether a notification belongs in the inbox feed (and therefore in its unread badge). */
export function isInboxNotification(n: AppNotificationDto): boolean {
  return !INBOX_HIDDEN_TYPES.includes(n.type);
}

/** A single in-app notification (read shape from GET /api/app-notifications). */
export type AppNotificationDto = {
  id: number;
  userId: number;
  providerProfileId?: number | null;
  type: number; // NotificationType
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

/**
 * Unread rows the BELL stands for — everything the inbox will actually show.
 *
 * A plain unread count, because the server's own feed exclusion has already removed the hidden
 * types from any search that doesn't name one (see INBOX_HIDDEN_TYPES). This used to subtract a
 * second, explicitly-typed count of the hidden rows, which excluded them TWICE and left the bell
 * reading low by however many unread chat messages the user had.
 */
export function getUnreadNotificationCount(userId: number): Promise<number> {
  return countNotifications({ userId, isRead: false });
}

/**
 * One page of the inbox feed.
 *
 * The server already leaves the hidden types out of an un-typed search, so `totalItems` and
 * `hasMore` are correct as they come. The client-side filter stays as the guard for the row the
 * server never sees: a live SignalR push is delivered whatever its type, and the inbox appends
 * those to the same list.
 */
export async function getInboxNotificationsPage(
  params?: GetAppNotificationsParams
): Promise<PagedResult<AppNotificationDto>> {
  const page = await getAppNotificationsPage(params);
  return { ...page, items: page.items.filter(isInboxNotification) };
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

/**
 * Everything a notification's payload can point at, from either transport.
 *
 * The two arrive differently — an in-app notification carries a numeric `type` plus a `dataJson`
 * string, a device push a flat data bag whose `type` is the enum's NAME — so both are normalized
 * into this one shape and routed by the single table in `navigation/notificationRoute`. When the
 * two were parsed separately they could disagree, and the same notification opened a different
 * screen depending on whether the app happened to be running.
 *
 * Which ids a type carries is decided by its backend handler; see the per-type notes on
 * `NotificationType`. Anything absent is null, never guessed.
 */
export type NotificationPayload = {
  type: number | null;
  /** The AppNotification row itself, so a tap can mark it read. */
  notificationId: number | null;
  bookingId: number | null;
  conversationId: number | null;
  serviceId: number | null;
  reviewId: number | null;
  certificateId: number | null;
  serviceProviderId: number | null;
};

/** Reads one id out of a payload bag, accepting the numeric strings a push may deliver. */
function payloadId(data: Record<string, unknown> | undefined, key: string): number | null {
  const raw = data?.[key];
  const id = typeof raw === 'string' ? Number(raw) : raw;
  return typeof id === 'number' && Number.isFinite(id) && id > 0 ? id : null;
}

function toPayload(
  type: number | null,
  notificationId: number | null,
  data: Record<string, unknown> | undefined
): NotificationPayload {
  return {
    type,
    notificationId,
    bookingId: payloadId(data, 'bookingId'),
    conversationId: payloadId(data, 'conversationId'),
    serviceId: payloadId(data, 'serviceId'),
    reviewId: payloadId(data, 'reviewId'),
    certificateId: payloadId(data, 'certificateId'),
    serviceProviderId: payloadId(data, 'serviceProviderId'),
  };
}

/** Parses a stored notification's `dataJson` (malformed JSON reads as an empty payload). */
export function notificationPayload(n: AppNotificationDto): NotificationPayload {
  let data: Record<string, unknown> | undefined;
  try {
    data = n.dataJson ? JSON.parse(n.dataJson) : undefined;
  } catch {
    data = undefined;
  }
  return toPayload(n.type, n.id, data);
}

/**
 * Parses a device push's `data` bag. `type` is the enum's member name there, not a number —
 * `notificationTypeFromName` resolves it, and an unrecognised one leaves `type` null so routing
 * falls back to whichever ids the payload does carry.
 */
export function pushNotificationPayload(
  data: Record<string, unknown> | undefined
): NotificationPayload {
  return toPayload(notificationTypeFromName(data?.type), payloadId(data, 'notificationId'), data);
}

/** Safely pulls the bookingId out of a notification's dataJson payload, if any. */
export function notificationBookingId(n: AppNotificationDto): number | null {
  return notificationPayload(n).bookingId;
}
