import {
  NotificationType,
  notificationBookingId,
  notificationConversationId,
  type AppNotificationDto,
} from '../services/app-notifications';
import { navigateFromOutside } from './navigationRef';

/**
 * Where a notification leads when it is tapped.
 *
 * One definition serves both taps that can happen: the in-app toast and the OS push. They used to
 * be able to disagree, which is the sort of difference nobody notices until a user reports that
 * the same notification goes to two different places depending on whether the app was open.
 *
 * A route is a LIST of screens, not one, so a thread opened from a notification can have its
 * inbox behind it rather than dropping the user into a chat with nowhere to go but out. Note
 * that on web the two pushes land in a single history entry, so browser Back returns to
 * wherever the user was rather than stepping through the inbox; the destination is the same
 * either way, which is what the tap promised.
 */
export type NotificationRoute = { name: string; params?: object }[];

/**
 * Resolves a route from a push payload's `data` (the OS push path, where all that survives is
 * dataJson's contents). Never returns empty: anything unrecognised still has a home in the feed
 * it was filed in.
 */
export function routeForNotificationData(
  data: Record<string, unknown> | undefined
): NotificationRoute {
  const conversationId = Number(data?.conversationId);
  const bookingId = Number(data?.bookingId);

  if (Number.isFinite(conversationId) && conversationId > 0) {
    return [{ name: 'Messages' }, { name: 'Chat', params: { conversationId } }];
  }
  if (Number.isFinite(bookingId) && bookingId > 0) {
    return [{ name: 'BookingDetails', params: { bookingId } }];
  }
  return [{ name: 'Notifications' }];
}

/**
 * Resolves a route from a full notification, which carries its `type` as well as its payload —
 * so the cases the id alone cannot distinguish are decided here.
 */
export function routeForNotification(n: AppNotificationDto): NotificationRoute {
  const conversationId = notificationConversationId(n);
  if (n.type === NotificationType.NewMessage && conversationId) {
    return [{ name: 'Messages' }, { name: 'Chat', params: { conversationId } }];
  }
  // A live-tracked service is watched on the map, not read about in a booking summary.
  if (n.type === NotificationType.LiveTrackingStarted) {
    return [{ name: 'LiveSession', params: { mode: 'user' } }];
  }
  // "Service completed" is an invitation to review. The inbox is the only place that can offer
  // the modal, and it auto-opens for exactly this notification — so send it there rather than to
  // the booking, which would show the trip and never ask for the rating.
  if (n.type === NotificationType.ServiceCompleted) {
    return [{ name: 'Notifications' }];
  }
  return routeForNotificationData({
    conversationId: conversationId ?? undefined,
    bookingId: notificationBookingId(n) ?? undefined,
  });
}

/** Walks a resolved route, from outside the navigator. */
export function followNotificationRoute(route: NotificationRoute): void {
  route.forEach((step) => navigateFromOutside(step.name, step.params));
}
