import { NotificationType, notificationTypeFromName } from './app-notifications';

/**
 * Which cached resources a live notification has just made wrong.
 *
 * Refreshing on focus fixes a screen you come back to; it can do nothing for a screen you are
 * **sitting on** while the other side acts — the provider confirms the booking you are looking at,
 * the admin approves your application, the balance falls due. There is no navigation event there
 * to hang a refresh on, and that case is most of what "it was updated simultaneously" means.
 *
 * The push that already arrives for every one of those events is the signal. The backend sends it
 * to the party whose obligations changed, which is exactly the party whose screen is stale, so
 * mapping it to the resources it touched turns the existing notification channel into live
 * invalidation — no polling, and no second socket.
 *
 * The inbox itself is always included: a notification arriving IS a change to the feed.
 */
export function resourcesForNotification(notification: { type?: unknown }): string[] {
  const type = resolveNotificationType(notification.type);
  const resources = new Set<string>(['app-notifications']);

  switch (type) {
    case NotificationType.BookingRequested:
    case NotificationType.BookingConfirmed:
    case NotificationType.BookingDeclined:
    case NotificationType.BookingCancelled:
    case NotificationType.BookingUpdated:
    case NotificationType.BookingPriceAdjusted:
    case NotificationType.BookingReminder:
    case NotificationType.BookingRequestStale:
    case NotificationType.ServiceStarted:
    case NotificationType.ServiceCompleted:
    case NotificationType.LiveTrackingStarted:
      resources.add('bookings');
      break;

    // Money moved or is now owed: the booking's payment summary and both dashboards change.
    case NotificationType.PaymentReceived:
    case NotificationType.PaymentDue:
    case NotificationType.PaymentOverdue:
      resources.add('payments');
      resources.add('bookings');
      break;

    // Moderation published or withdrew a review — it moves the rating on the service row and the
    // provider profile, not just the review list.
    case NotificationType.ReviewApproved:
    case NotificationType.ReviewDeclined:
    case NotificationType.ReviewReceived:
    case NotificationType.ReviewReminder:
      resources.add('reviews');
      break;

    // The application or a certificate was ruled on: approval is what makes a provider publicly
    // bookable, so the catalogue changes too (the fan-out in cache.ts carries that).
    case NotificationType.ServiceProviderApproved:
    case NotificationType.ServiceProviderDeclined:
    case NotificationType.CertificateApproved:
    case NotificationType.CertificateDeclined:
    case NotificationType.CertificateExpiring:
      resources.add('service-providers');
      break;

    // The admin queue digest: whatever is waiting is waiting on these two screens.
    case NotificationType.AdminPendingQueue:
    case NotificationType.AdminQueueCleared:
      resources.add('service-providers');
      resources.add('reviews');
      break;

    case NotificationType.NewChatMessage:
      resources.add('chat');
      break;

    // A type this build has not heard of — the inbox alone. Guessing wider would refresh screens
    // for an event we cannot describe.
    default:
      break;
  }

  return [...resources];
}

/**
 * The two channels spell `type` differently and this has to read both.
 *
 * A SignalR `NotificationReceived` carries the REST shape, where `type` is the enum's NUMBER; a
 * device push carries a string data bag, where it is the member NAME. Resolving only the name —
 * which is what `notificationTypeFromName` alone does — silently returned null for every live
 * push, so the notification badge moved while the screen behind it kept its stale booking.
 * Verified against the running stack.
 */
function resolveNotificationType(value: unknown): number | null {
  if (typeof value === 'number') return value;
  return notificationTypeFromName(value);
}
