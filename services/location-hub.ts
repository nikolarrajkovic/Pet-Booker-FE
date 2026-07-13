import { HubConnection } from '@microsoft/signalr';
import { createHubConnection } from './hub-connection';

/**
 * SignalR connection to the backend's live-location hub (/hubs/location).
 * Token/reconnect handling lives in the shared factory (services/hub-connection.ts).
 *
 * Hub methods (client → server):
 *   - SubscribeToBookingLocation(bookingId)   — owner/provider/admin watch a booking
 *   - UnsubscribeFromBookingLocation(bookingId)
 *   - PushLocation(LocationPingInput)          — provider-only GPS stream
 *
 * Server → client events (register with connection.on):
 *   - LocationUpdated(LocationPingDto)         — a stored ping fanned out to watchers
 *   - TrackingStarted / TrackingEnded({ bookingId, sessionId })
 *   - SubscribedToBookingLocation / UnsubscribedFromBookingLocation(bookingId)
 */

export const LOCATION_HUB_EVENTS = {
  locationUpdated: 'LocationUpdated',
  trackingStarted: 'TrackingStarted',
  trackingEnded: 'TrackingEnded',
  subscribed: 'SubscribedToBookingLocation',
  unsubscribed: 'UnsubscribedFromBookingLocation',
} as const;

export const LOCATION_HUB_METHODS = {
  subscribe: 'SubscribeToBookingLocation',
  unsubscribe: 'UnsubscribeFromBookingLocation',
  pushLocation: 'PushLocation',
} as const;

export function createLocationHubConnection(): HubConnection {
  return createHubConnection('/hubs/location');
}
