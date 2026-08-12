import { apiJson, apiVoid, type PagedResult } from './http';

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
 * ## When the composer is open
 *
 * The backend decides, and says why (`ChatAccessDto`). Summarised:
 *
 * - any live booking (requested / accepted / in progress) → open, no limit;
 * - for 14 days after a service, extended by leaving a review; 3 days after a cancellation;
 * - otherwise a **bounded enquiry** against an approved provider — 3 messages until they reply.
 *
 * A closed thread is read-only, never hidden. Always render from `access`, never re-derive the
 * rule here: the server enforces it on send, so a client guess would just disagree with a 401.
 *
 * ## Sender identity: `sender`, NOT `senderUserId`
 *
 * Bubble side comes from `sender` (0 = customer, 1 = provider) compared against the
 * conversation's `viewer`. A managed ProviderProfile account has no `Domain.User` behind it, so
 * `senderUserId` is null for those — comparing it to the signed-in user's id would put every
 * message from a company-managed provider on the wrong side. `senderUserId` is audit data only.
 */

/** Which side of a conversation someone is on. Matches Domain.ChatParticipant. */
export enum ChatParticipant {
  User = 0,
  Provider = 1,
}

/** Why the backend opened or closed the composer. Matches Domain.ChatAccessReason. */
export enum ChatAccessReason {
  NoBooking = 0,
  ActiveBooking = 1,
  PostServiceWindow = 2,
  PostReviewWindow = 3,
  CancellationWindow = 4,
  WindowExpired = 5,
  PreBookingEnquiry = 6,
  FollowUpEnquiry = 7,
  EnquiryLimitReached = 8,
  ProviderNotContactable = 9,
}

/** The contact verdict for a thread, or for a provider not yet messaged. */
export type ChatAccessDto = {
  serviceProviderId: number;
  canSendMessage: boolean;
  reason: ChatAccessReason;
  /** When the window closes; null when open-ended or shut. */
  openUntil?: string | null;
  /** The booking the verdict came from, for deep-linking. */
  bookingId?: number | null;
  conversationId?: number | null;
  /** Messages left before the provider must reply. Null when not count-bounded. */
  remainingEnquiryMessages?: number | null;
};

/** One customer↔provider thread, already resolved for the caller's side. */
export type ConversationDto = {
  id: number;
  userId: number;
  serviceProviderId: number;
  /** Which side the caller is on. Null for an admin observing. */
  viewer?: ChatParticipant | null;
  /** The other party, resolved server-side — a customer sees the provider and vice versa. */
  counterpartName?: string | null;
  counterpartAvatarUrl?: string | null;
  /** The service the thread was opened from — context only; the thread outlives it. */
  serviceId?: number | null;
  serviceName?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessageSender?: ChatParticipant | null;
  /** Unread for the CALLER's side. */
  unreadCount: number;
  access: ChatAccessDto;
  createdAt: string;
};

/** A single message inside a conversation. */
export type MessageDto = {
  id: number;
  conversationId: number;
  /** Which side wrote it. Compare with the conversation's `viewer` for bubble side. */
  sender: ChatParticipant;
  /** Audit only — null for company-managed provider accounts. Never use for bubble side. */
  senderUserId?: number | null;
  senderName?: string | null;
  bookingId?: number | null;
  body: string;
  /**
   * True UTC instant — NOT the naive wall-clock convention booking times use.
   * Read with `new Date()`, never `parseBookingDate`.
   */
  sentAt: string;
  /** Set once the other party has read it; drives the delivered/read ticks. */
  readAt?: string | null;
  isRead?: boolean;
};

/**
 * A page of history, oldest → newest, walked backwards by keyset.
 *
 * Keyset rather than page numbers because a live thread grows underneath the reader: with
 * offsets, a message arriving between "page 1" and "page 2" shifts everything down one and the
 * next page repeats a line (or skips one).
 */
export type MessagePageDto = {
  conversationId: number;
  items: MessageDto[];
  /** Pass as `before` to fetch the next older page. Null at the beginning of the thread. */
  nextBefore?: number | null;
  hasMore: boolean;
};

export type ConversationSearchParams = {
  /** Only threads with something unread for the caller. */
  unreadOnly?: boolean;
  /** Narrow to one provider. */
  serviceProviderId?: number;
  /** Free-text match on the counterpart's name. */
  keyword?: string;
  page?: number;
  perPage?: number;
};

/**
 * The caller's inbox, most recent activity first.
 *
 * Deliberately takes no owner parameter: the backend scopes it to the session (and merges both
 * sides for a partner, who is a customer of other providers as well as a provider themselves).
 * A client-supplied `UserId` would be an IDOR waiting to happen.
 */
export function getConversations(
  params?: ConversationSearchParams
): Promise<PagedResult<ConversationDto>> {
  return apiJson<PagedResult<ConversationDto>>('/api/chat/conversations', {
    query: {
      UnreadOnly: params?.unreadOnly,
      ServiceProviderId: params?.serviceProviderId,
      Keyword: params?.keyword,
      Page: params?.page ?? 1,
      PerPage: params?.perPage ?? 50,
    },
    fallback: 'Failed to load conversations.',
    context: 'getConversations',
  });
}

export function getConversation(id: number): Promise<ConversationDto> {
  return apiJson<ConversationDto>(`/api/chat/conversations/${id}`, {
    fallback: 'Failed to load conversation.',
    context: 'getConversation',
  });
}

/**
 * Opens (or reuses) the thread with a provider — get-or-create, so the caller can fire this
 * every time the chat button is tapped. An existing thread is returned even when the composer
 * is closed, so the user reaches the screen and sees why rather than being refused it.
 */
export function openConversation(
  serviceProviderId: number,
  serviceId?: number | null,
  bookingId?: number | null
): Promise<ConversationDto> {
  return apiJson<ConversationDto>('/api/chat/conversations', {
    method: 'POST',
    body: { serviceProviderId, serviceId: serviceId ?? null, bookingId: bookingId ?? null },
    fallback: 'Could not open this conversation.',
    context: 'openConversation',
  });
}

/** The thread for a booking, from either side. The provider's entry point. */
export function openBookingConversation(bookingId: number): Promise<ConversationDto> {
  return apiJson<ConversationDto>(`/api/chat/bookings/${bookingId}/conversation`, {
    method: 'POST',
    fallback: 'Could not open this conversation.',
    context: 'openBookingConversation',
  });
}

/**
 * One page of a thread's history. Pass the previous page's `nextBefore` to load older messages.
 */
export function getMessagesPage(
  conversationId: number,
  before?: number | null,
  limit = 30
): Promise<MessagePageDto> {
  return apiJson<MessagePageDto>(`/api/chat/conversations/${conversationId}/messages`, {
    query: { before: before ?? undefined, limit },
    fallback: 'Failed to load messages.',
    context: 'getMessagesPage',
  });
}

/** Posts a message. The server stamps the sender from the JWT — never trust a client-sent one. */
export function sendMessage(
  conversationId: number,
  body: string,
  bookingId?: number | null
): Promise<MessageDto> {
  return apiJson<MessageDto>(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { body, bookingId: bookingId ?? null },
    fallback: 'Message not sent.',
    context: 'sendMessage',
  });
}

/** Marks everything the OTHER party sent in this thread as read (all of it when no id given). */
export function markConversationRead(
  conversationId: number,
  upToMessageId?: number | null
): Promise<void> {
  return apiVoid(`/api/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    body: { upToMessageId: upToMessageId ?? null },
    fallback: 'Failed to update the conversation.',
    context: 'markConversationRead',
  });
}

export type UnreadCountDto = { totalUnread: number; conversationsWithUnread: number };

/** Total unread across every thread — the badge number, in one call. */
export async function getUnreadMessageCount(): Promise<number> {
  const result = await apiJson<UnreadCountDto>('/api/chat/unread-count', {
    fallback: 'Failed to load the unread count.',
    context: 'getUnreadMessageCount',
  });
  return result.totalUnread ?? 0;
}

/**
 * Whether the signed-in customer may message this provider right now — what the "Message
 * provider" button asks before rendering itself, so it can be hidden or explained rather than
 * failing on tap.
 */
export function getChatAccess(serviceProviderId: number): Promise<ChatAccessDto> {
  return apiJson<ChatAccessDto>(`/api/chat/service-providers/${serviceProviderId}/access`, {
    fallback: 'Failed to check messaging availability.',
    context: 'getChatAccess',
  });
}
