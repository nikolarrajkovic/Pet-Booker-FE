import {
  NotificationType,
  notificationPayload,
  type AppNotificationDto,
  type NotificationPayload,
} from '../services/app-notifications';
import { navigateFromOutside } from './navigationRef';

/**
 * Where a notification leads when it is tapped.
 *
 * One definition serves both taps that can happen: the in-app toast and the OS push. They used to
 * be able to disagree — the push path routed on the ids alone, so a "service completed" push
 * opened the booking while the same notification tapped in the app offered the review modal — and
 * that is the sort of difference nobody notices until a user reports that the same notification
 * goes to two different places depending on whether the app was open. Both now normalize into a
 * `NotificationPayload` and come through `routeForPayload` below.
 *
 * A route is a LIST of screens, not one, so a screen opened from a notification can have its
 * natural parent behind it rather than dropping the user somewhere with nowhere to go but out:
 * a thread gets its inbox, a provider's screen gets the Partner tab. Note that on web the pushes
 * land in a single history entry, so browser Back returns to wherever the user was rather than
 * stepping through the parent; the destination is the same either way, which is what the tap
 * promised.
 */
export type NotificationRoute = { name: string; params?: object }[];

export type NotificationRouteOptions = {
  /**
   * Set by the inbox, which has already offered the review modal itself. Without it a "service
   * completed" notification routes to the inbox so the modal can be offered there — which from
   * the inbox is a no-op, leaving a tap that appears to do nothing.
   */
  reviewHandled?: boolean;
};

/** The Partner tab, as the parent of every provider-facing destination. */
const PARTNER_TAB = { name: 'MainTabs', params: { screen: 'PartnerHub' } };

/** A thread, with the inbox behind it — or the inbox alone when no thread was named. */
function chatRoute(conversationId: number | null): NotificationRoute {
  return conversationId
    ? [{ name: 'Messages' }, { name: 'Chat', params: { conversationId } }]
    : [{ name: 'Messages' }];
}

/** The booking recap, or the feed when the payload named no booking. */
function bookingRoute(bookingId: number | null): NotificationRoute {
  return bookingId
    ? [{ name: 'BookingDetails', params: { bookingId } }]
    : [{ name: 'Notifications' }];
}

/**
 * The one routing table, keyed by notification type.
 *
 * Types not listed fall through to routing by whichever id the payload carries — which is also
 * what happens for a type this build has never heard of, so a notification added to the backend
 * after release still opens its booking or its thread instead of being swallowed.
 */
export function routeForPayload(
  p: NotificationPayload,
  options: NotificationRouteOptions = {}
): NotificationRoute {
  switch (p.type) {
    // ── Customer-facing ───────────────────────────────────────────────────────────────────
    // A live-tracked service is watched on the map, not read about in a booking summary.
    case NotificationType.LiveTrackingStarted:
      return [{ name: 'LiveSession', params: { mode: 'user' } }];

    // "Service completed" is an invitation to review, and the inbox is the only place that can
    // offer the modal — it auto-opens for exactly this notification. Once the inbox has tried
    // (and the booking turns out to be reviewed already) the booking itself is the destination.
    case NotificationType.ServiceCompleted:
      return options.reviewHandled ? bookingRoute(p.bookingId) : [{ name: 'Notifications' }];

    // Moderation ruled on the review this user wrote. Approved, it is live on the service page;
    // declined, there is nothing to show — the message carries the reason, so the feed is the
    // honest destination.
    case NotificationType.ReviewApproved:
      return p.serviceId
        ? [{ name: 'ServiceDetail', params: { serviceId: p.serviceId } }]
        : [{ name: 'Notifications' }];
    case NotificationType.ReviewDeclined:
      return [{ name: 'Notifications' }];

    // ── Provider-facing ───────────────────────────────────────────────────────────────────
    // A request is a decision, not a record: send the provider to the screen with the Accept and
    // Decline buttons rather than to the read-only recap.
    case NotificationType.BookingRequested:
      return [PARTNER_TAB, { name: 'NewRequests' }];

    // The terms changed under a provider who had already agreed to them, or the slot came back.
    // Both are things they act on from the hub, so it sits behind the booking.
    case NotificationType.BookingUpdated:
    case NotificationType.BookingCancelled:
      return [PARTNER_TAB, ...bookingRoute(p.bookingId)];

    // A review landed on their profile — the service page is where it is now visible.
    case NotificationType.ReviewReceived:
      return p.serviceId
        ? [PARTNER_TAB, { name: 'ServiceDetail', params: { serviceId: p.serviceId } }]
        : [PARTNER_TAB];

    // Application and certificate decisions have no screen of their own; the hub is the partner's
    // home and reflects the new state (an approved partner can list services, a declined one
    // cannot). The notification's own message carries the decline reason.
    case NotificationType.ServiceProviderApproved:
    case NotificationType.ServiceProviderDeclined:
    case NotificationType.CertificateApproved:
    case NotificationType.CertificateDeclined:
      return [PARTNER_TAB];

    // ── Either side ───────────────────────────────────────────────────────────────────────
    case NotificationType.NewChatMessage:
      return chatRoute(p.conversationId);

    // Confirmed / declined / started / reminded / re-priced / paid / due: the booking recap
    // answers all of them, and it is the same screen for whichever side received it.
    default:
      return p.conversationId ? chatRoute(p.conversationId) : bookingRoute(p.bookingId);
  }
}

/** Resolves a route from a full notification — the in-app toast and inbox path. */
export function routeForNotification(
  n: AppNotificationDto,
  options?: NotificationRouteOptions
): NotificationRoute {
  return routeForPayload(notificationPayload(n), options);
}

/** Walks a resolved route, from outside the navigator. */
export function followNotificationRoute(route: NotificationRoute): void {
  route.forEach((step) => navigateFromOutside(step.name, step.params));
}
