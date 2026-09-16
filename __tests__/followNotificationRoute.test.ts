/**
 * How a resolved notification route is actually walked.
 *
 * A route is a list — a destination with a synthetic parent in front of it — and the parent is
 * only ever wanted when the tap arrives with nothing behind it (a cold start from a device push).
 * Tapped from inside the app there IS history, and walking the parent destroys it: the parent
 * step is `MainTabs`, which already sits at the root of the stack, and navigating to a route
 * that is already in the stack pops back to it, taking the Notifications screen the user tapped
 * from with it. That is the bug this pins — open a request from the feed, press Back, and land
 * on a tab instead of the feed.
 */
jest.mock('../navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true), canGoBack: jest.fn(() => false) },
  navigateFromOutside: jest.fn(),
}));

import { followNotificationRoute, routeForPayload } from '../navigation/notificationRoute';
import { NotificationType } from '../services/app-notifications';
import { navigateFromOutside, navigationRef } from '../navigation/navigationRef';

const navigate = navigateFromOutside as jest.Mock;
const isReady = navigationRef.isReady as unknown as jest.Mock;
const canGoBack = navigationRef.canGoBack as unknown as jest.Mock;

/** The two-step shape the table produces for a provider-facing destination. */
const PARENTED_ROUTE = [
  { name: 'MainTabs', params: { screen: 'PartnerHub' } },
  { name: 'NewRequests' },
];

beforeEach(() => {
  navigate.mockClear();
  isReady.mockReturnValue(true);
  canGoBack.mockReturnValue(false);
});

describe('followNotificationRoute', () => {
  it('goes straight to the destination when there is history to go back to', () => {
    canGoBack.mockReturnValue(true);

    followNotificationRoute(PARENTED_ROUTE);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('NewRequests', undefined);
  });

  it('walks the whole route, parent first, when there is nothing to go back to', () => {
    canGoBack.mockReturnValue(false);

    followNotificationRoute(PARENTED_ROUTE);

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenNthCalledWith(1, 'MainTabs', { screen: 'PartnerHub' });
    expect(navigate).toHaveBeenNthCalledWith(2, 'NewRequests', undefined);
  });

  it('synthesizes the parent when the navigator is not mounted yet (cold push start)', () => {
    isReady.mockReturnValue(false);

    followNotificationRoute(PARENTED_ROUTE);

    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for an empty route', () => {
    followNotificationRoute([]);

    expect(navigate).not.toHaveBeenCalled();
  });

  it('still reaches the single-step destinations either way', () => {
    // AdminPendingQueue has no parent step, so history or not, it is one navigate to the
    // admin queue — the case the reporter hit from the notification feed.
    const route = routeForPayload({
      type: NotificationType.AdminPendingQueue,
      bookingId: null,
      conversationId: null,
      serviceId: null,
    } as Parameters<typeof routeForPayload>[0]);

    canGoBack.mockReturnValue(true);
    followNotificationRoute(route);
    expect(navigate).toHaveBeenCalledWith('AdminNewRequests', undefined);

    navigate.mockClear();
    canGoBack.mockReturnValue(false);
    followNotificationRoute(route);
    expect(navigate).toHaveBeenCalledWith('AdminNewRequests', undefined);
  });
});
