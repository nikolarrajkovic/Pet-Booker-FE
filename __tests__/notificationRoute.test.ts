import {
  routeForNotification,
  routeForPayload,
  type NotificationRoute,
} from '../navigation/notificationRoute';
import {
  NotificationType,
  notificationPayload,
  pushNotificationPayload,
  type AppNotificationDto,
} from '../services/app-notifications';

/**
 * Where every notification type leads, and the promise that a tap lands in the same place
 * whichever transport delivered it.
 *
 * The two arrive differently — a stored notification has a numeric `type` and a `dataJson`
 * string, a device push a flat bag whose `type` is the backend enum's NAME — and when they were
 * parsed separately they could disagree, which is a bug nobody sees until a user reports that a
 * notification opens a different screen depending on whether the app happened to be running.
 * So the last test here walks the whole enum and asserts the two agree, type by type.
 */

const names = Object.keys(NotificationType) as (keyof typeof NotificationType)[];

/** A stored notification of the given type, carrying every id its handler might send. */
const stored = (
  name: keyof typeof NotificationType,
  data: Record<string, number> = {}
): AppNotificationDto => ({
  id: 7,
  userId: 1,
  type: NotificationType[name],
  title: name,
  message: name,
  dataJson: JSON.stringify(data),
  isRead: false,
  createdAt: '2026-09-01T10:00:00Z',
});

/** The push the backend builds for the same notification: enum NAME, plus the same ids. */
const pushed = (name: keyof typeof NotificationType, data: Record<string, number> = {}) => ({
  type: name,
  notificationId: 7,
  ...data,
});

const routeOf = (r: NotificationRoute) => r.map((s) => s.name);

describe('routeForNotification — one destination per type', () => {
  it('sends a booking request to the screen that can accept it, not the recap', () => {
    // The provider's decision needs the Accept/Decline buttons; BookingDetails is read-only.
    expect(routeOf(routeForNotification(stored('BookingRequested', { bookingId: 3 })))).toEqual([
      'MainTabs',
      'NewRequests',
    ]);
  });

  it('watches a live-tracked service on the map rather than reading about it', () => {
    expect(
      routeOf(routeForNotification(stored('LiveTrackingStarted', { bookingId: 3, sessionId: 9 })))
    ).toEqual(['LiveSession']);
  });

  it('sends "service completed" to the inbox, which is the only place that can ask for a review', () => {
    expect(routeOf(routeForNotification(stored('ServiceCompleted', { bookingId: 3 })))).toEqual([
      'Notifications',
    ]);
  });

  it('falls through to the booking once the inbox has already offered the review', () => {
    // What the inbox passes after finding the booking is reviewed already — without it the tap
    // would route to the screen the user is standing on and appear to do nothing.
    const route = routeForNotification(stored('ServiceCompleted', { bookingId: 3 }), {
      reviewHandled: true,
    });
    expect(route).toEqual([{ name: 'BookingDetails', params: { bookingId: 3 } }]);
  });

  it('opens the service page for a review that went live, either side of it', () => {
    const author = routeForNotification(stored('ReviewApproved', { reviewId: 5, serviceId: 8 }));
    expect(author).toEqual([{ name: 'ServiceDetail', params: { serviceId: 8 } }]);
    // The provider gets the same page, with their hub behind it.
    expect(
      routeOf(routeForNotification(stored('ReviewReceived', { reviewId: 5, serviceId: 8 })))
    ).toEqual(['MainTabs', 'ServiceDetail']);
  });

  it('keeps a declined review in the feed, which is where its reason is', () => {
    expect(routeOf(routeForNotification(stored('ReviewDeclined', { reviewId: 5 })))).toEqual([
      'Notifications',
    ]);
  });

  it('lands partner verification decisions on the hub, which has no screen of its own', () => {
    for (const name of [
      'ServiceProviderApproved',
      'ServiceProviderDeclined',
      'CertificateApproved',
      'CertificateDeclined',
    ] as const) {
      expect(routeOf(routeForNotification(stored(name, { certificateId: 2 })))).toEqual([
        'MainTabs',
      ]);
    }
  });

  it('opens a message in its thread, with the inbox behind it', () => {
    expect(routeOf(routeForNotification(stored('NewChatMessage', { conversationId: 4 })))).toEqual([
      'Messages',
      'Chat',
    ]);
  });

  it('answers every remaining booking event with the booking recap', () => {
    for (const name of [
      'BookingConfirmed',
      'BookingDeclined',
      'BookingCancelled',
      'BookingReminder',
      'ServiceStarted',
      'BookingPriceAdjusted',
      'BookingUpdated',
      'PaymentReceived',
      'PaymentDue',
    ] as const) {
      expect(routeOf(routeForNotification(stored(name, { bookingId: 3 })))).toContain(
        'BookingDetails'
      );
    }
  });

  it('never strands a notification, however little the payload says', () => {
    for (const name of names) {
      const route = routeForNotification(stored(name));
      expect(route.length).toBeGreaterThan(0);
    }
  });

  it('routes a type this build predates by whatever id it carries', () => {
    // A type added to the backend after release: unknown to the enum, still openable.
    expect(
      routeForPayload(pushNotificationPayload({ type: 'SomethingNew', bookingId: 3 }))
    ).toEqual([{ name: 'BookingDetails', params: { bookingId: 3 } }]);
  });
});

describe('the two transports agree', () => {
  it('routes a push exactly where the stored notification goes, for every type', () => {
    const ids = { bookingId: 3, conversationId: 4, serviceId: 8, reviewId: 5, certificateId: 2 };
    for (const name of names) {
      expect(routeForPayload(pushNotificationPayload(pushed(name, ids)))).toEqual(
        routeForPayload(notificationPayload(stored(name, ids)))
      );
    }
  });

  it('reads the push ids the OS may deliver as strings', () => {
    const payload = pushNotificationPayload({ type: 'BookingConfirmed', bookingId: '3' });
    expect(payload.bookingId).toBe(3);
  });

  it('resolves the notification row from either transport, so a tap can mark it read', () => {
    expect(notificationPayload(stored('BookingConfirmed')).notificationId).toBe(7);
    expect(pushNotificationPayload(pushed('BookingConfirmed')).notificationId).toBe(7);
  });
});
