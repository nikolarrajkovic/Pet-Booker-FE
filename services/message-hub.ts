import { HubConnection } from '@microsoft/signalr';
import { createHubConnection } from './hub-connection';
import type { MessageDto } from './messages';

/**
 * SignalR connection to the backend's message hub (/hubs/messages).
 *
 * Mirrors the notification hub exactly: no subscribe call is needed, because on connect the
 * server reads the JWT and auto-joins the caller's identity group — so a user receives every
 * message addressed to them across all their threads, and a partner receives theirs, without the
 * client enumerating conversations first.
 *
 * NOT YET IMPLEMENTED SERVER-SIDE. The hub needs to emit `MessageReceived` with the same
 * `MessageDto` shape the REST feed returns, to both participants of the conversation (echoing to
 * the sender too keeps a user's own devices in sync). `ConversationRead` lets the sender's ticks
 * flip to "read" live when the recipient opens the thread.
 */

/** Server → client: a message was posted to a thread the caller is part of. */
export const MESSAGE_RECEIVED = 'MessageReceived';

/**
 * Server → client: the other party read a thread, so outgoing messages up to `readAt` are read.
 * Payload: `{ conversationId: number; readerUserId: number; readAt: string }`.
 */
export const CONVERSATION_READ = 'ConversationRead';

export type ConversationReadEvent = {
  conversationId: number;
  readerUserId: number;
  readAt: string;
};

export type MessageReceivedEvent = MessageDto;

export function createMessageHubConnection(): HubConnection {
  return createHubConnection('/hubs/messages');
}
