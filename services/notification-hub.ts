import { HubConnection } from '@microsoft/signalr';
import { createHubConnection } from './hub-connection';

/**
 * SignalR connection to the backend's notification hub (/hubs/notifications).
 *
 * No subscribe call is needed: on connect the server reads the JWT claims and
 * auto-joins the caller's identity group (`user:{id}`, or `provider-profile:{id}`
 * for managed-profile sessions). Every in-app notification the backend persists
 * is then also pushed live as `NotificationReceived` with the same payload shape
 * the REST feed returns (AppNotificationDto — title/message rendered in the
 * recipient's preferred language).
 */

/** Server → client: a freshly dispatched in-app notification. */
export const NOTIFICATION_RECEIVED = 'NotificationReceived';

export function createNotificationHubConnection(): HubConnection {
  return createHubConnection('/hubs/notifications');
}
