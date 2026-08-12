import { apiJson, apiList, apiPage, apiVoid, type PagedResult } from './http';

/**
 * Direct messaging between a customer and a service provider.
 *
 * ## Why conversations are scoped to a PROVIDER, not a booking
 *
 * The entry point is the "message" button beside Book Now on ServiceDetail, so the first question
 * ("do you take reactive dogs?") is asked *before* any booking exists — a booking-scoped thread
 * could not carry it. A conversation is therefore the customer↔provider pair, with `serviceId`
 * recording which service the customer was looking at when they opened it, so the provider has
 * context without the thread being locked to it.
 *
 * Authorization is still simple: a conversation has exactly one `userId` and one
 * `serviceProviderId`, and only those two parties (or an admin) may read or post.
 *
 * ## Backend contract
 *
 * These endpoints DO NOT EXIST YET — this module is the specification for them. It follows the
 * conventions every other service here uses, so it should drop into the existing CQRS setup:
 *
 * | Method | Path                                | Body / query                          | Returns             |
 * |--------|-------------------------------------|---------------------------------------|---------------------|
 * | GET    | `/api/conversations`                | `UserId`/`ServiceProviderId`, paging   | paged Conversation  |
 * | GET    | `/api/conversations/{id}`           | —                                     | Conversation        |
 * | POST   | `/api/conversations`                | `{ serviceProviderId, serviceId? }`    | Conversation        |
 * | GET    | `/api/messages`                     | `ConversationId`, paging               | paged Message       |
 * | POST   | `/api/messages`                     | `{ conversationId, body }`             | Message             |
 * | POST   | `/api/conversations/{id}/read`      | —                                     | 204                 |
 *
 * `POST /api/conversations` must be **get-or-create**: opening the chat twice for the same
 * provider returns the same thread rather than forking it.
 *
 * Live delivery rides `/hubs/messages` (see `message-hub.ts`). The server should also persist an
 * AppNotification per message so the existing inbox — and later, push — pick it up for free.
 */

/** One customer↔provider thread. */
export type ConversationDto = {
  id: number;
  /** The customer. */
  userId: number;
  serviceProviderId: number;
  /** The service the customer opened the thread from — context only; the thread outlives it. */
  serviceId?: number | null;
  /** Preview text for the inbox row. */
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  /** Unread messages for the CALLER (the server knows which side is asking). */
  unreadCount?: number;
  // Read-only includes, mirroring how bookings/reviews embed their participants so a
  // conversation row renders from the list call alone.
  serviceProvider?: {
    id?: number;
    name?: string | null;
    photos?: { src?: string | null; isSelected?: boolean }[];
  } | null;
  user?: {
    id?: number;
    userName?: string | null;
    photos?: { src?: string | null; isSelected?: boolean }[];
  } | null;
  service?: { id?: number; name?: string | null; type?: number } | null;
};

/** A single message inside a conversation. */
export type MessageDto = {
  id: number;
  conversationId: number;
  /** Author. Compare against the signed-in user's id to decide bubble side. */
  senderUserId: number;
  body: string;
  /**
   * True UTC instant — NOT the naive wall-clock convention booking times use.
   * Read with `new Date()`, never `parseBookingDate`.
   */
  sentAt: string;
  /** Set once the other party has read it; drives the delivered/read ticks. */
  readAt?: string | null;
};

export type GetConversationsParams = {
  userId?: number;
  serviceProviderId?: number;
  page?: number;
  perPage?: number;
};

export function getConversations(params?: GetConversationsParams): Promise<ConversationDto[]> {
  return apiList<ConversationDto>('/api/conversations', {
    query: {
      UserId: params?.userId,
      ServiceProviderId: params?.serviceProviderId,
      Page: params?.page ?? 1,
      PerPage: params?.perPage ?? 50,
    },
    fallback: 'Failed to load conversations.',
    context: 'getConversations',
  });
}

export function getConversation(id: number): Promise<ConversationDto> {
  return apiJson<ConversationDto>(`/api/conversations/${id}`, {
    fallback: 'Failed to load conversation.',
    context: 'getConversation',
  });
}

/**
 * Opens (or reuses) the thread with a provider. Get-or-create server-side, so the caller can
 * fire this every time the chat button is tapped without checking for an existing thread first.
 */
export function openConversation(
  serviceProviderId: number,
  serviceId?: number | null
): Promise<ConversationDto> {
  return apiJson<ConversationDto>('/api/conversations', {
    method: 'POST',
    body: { serviceProviderId, serviceId: serviceId ?? null },
    fallback: 'Could not open this conversation.',
    context: 'openConversation',
  });
}

/**
 * One page of a thread's history, newest first — paged because a long-running thread outgrows
 * any single response, and the chat view loads older messages as the user scrolls back.
 */
export function getMessagesPage(
  conversationId: number,
  page = 1,
  perPage = 30
): Promise<PagedResult<MessageDto>> {
  return apiPage<MessageDto>('/api/messages', {
    query: { ConversationId: conversationId, Page: page, PerPage: perPage },
    fallback: 'Failed to load messages.',
    context: 'getMessagesPage',
  });
}

/** Posts a message. The server stamps `senderUserId` from the JWT — never trust a client-sent one. */
export function sendMessage(conversationId: number, body: string): Promise<MessageDto> {
  return apiJson<MessageDto>('/api/messages', {
    method: 'POST',
    body: { conversationId, body },
    fallback: 'Message not sent.',
    context: 'sendMessage',
  });
}

/** Marks everything the OTHER party sent in this thread as read. */
export function markConversationRead(conversationId: number): Promise<void> {
  return apiVoid(`/api/conversations/${conversationId}/read`, {
    method: 'POST',
    fallback: 'Failed to update the conversation.',
    context: 'markConversationRead',
  });
}

/** Total unread across every thread — the badge number. */
export async function getUnreadMessageCount(params?: GetConversationsParams): Promise<number> {
  const conversations = await getConversations({ ...params, perPage: 200 });
  return conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}
