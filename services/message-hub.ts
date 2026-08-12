import { HubConnection } from '@microsoft/signalr';
import { createHubConnection } from './hub-connection';
import type { ConversationDto, MessageDto, ChatParticipant } from './messages';

/**
 * SignalR connection to the backend's chat hub (/hubs/chat).
 *
 * Two delivery paths, and the difference matters:
 *
 * - **`ChatMessageReceived`** goes to the thread's group, which a client joins by calling
 *   `SubscribeToConversation` (the server authorizes it — a conversation id alone is not enough
 *   to eavesdrop). Only whoever has the thread *open* gets this.
 * - **`ChatInboxUpdated`** goes to the caller's identity group, which the server joins on
 *   connect from the JWT. No subscribe call needed, and it arrives whatever screen the user is
 *   on — this is what moves the badge.
 *
 * A client with the thread open receives both for the same message and de-dupes on id.
 */

/** Server → client: a new message in a thread the caller has subscribed to. */
export const MESSAGE_RECEIVED = 'ChatMessageReceived';

/** Server → client: something changed in one of your threads (badge/inbox row). */
export const INBOX_UPDATED = 'ChatInboxUpdated';

/** Server → client: the other party caught up, so outgoing ticks flip to read. */
export const CONVERSATION_READ = 'ChatMessagesRead';

/** Server → client: the other party started or stopped typing. */
export const TYPING_CHANGED = 'ChatTypingChanged';

export type ConversationReadEvent = {
  conversationId: number;
  /** Which side did the reading — compare against the conversation's `viewer`. */
  reader: ChatParticipant;
  upToMessageId: number;
  readAt: string;
};

export type TypingEvent = {
  conversationId: number;
  participant: ChatParticipant;
  isTyping: boolean;
};

export type MessageReceivedEvent = MessageDto;
export type InboxUpdatedEvent = ConversationDto;

export function createMessageHubConnection(): HubConnection {
  return createHubConnection('/hubs/chat');
}

/**
 * Joins a thread's live group. Server-authorized: a non-participant is rejected, so failures
 * here are expected for a stale conversation id and must not be fatal — REST still works.
 */
export async function subscribeToConversation(
  connection: HubConnection,
  conversationId: number
): Promise<void> {
  await connection.invoke('SubscribeToConversation', conversationId);
}

export async function unsubscribeFromConversation(
  connection: HubConnection,
  conversationId: number
): Promise<void> {
  await connection.invoke('UnsubscribeFromConversation', conversationId);
}

/** Typing indicator. Fire-and-forget: a dropped frame is worth nothing. */
export async function sendTyping(
  connection: HubConnection,
  conversationId: number,
  isTyping: boolean
): Promise<void> {
  await connection.invoke('Typing', conversationId, isTyping);
}
