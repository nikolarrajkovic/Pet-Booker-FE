/**
 * Which chat thread is on screen right now, if any.
 *
 * Module state rather than context, because two providers need it and neither can see the
 * other's: `NotificationsProvider` wraps `MessagesProvider` (App.tsx), so the notification hub —
 * which also announces chat messages — cannot read a claim held inside the messages context. It
 * used to live there, and the notification hub toasted every message into the very thread the
 * user was reading: the backend files a `NewChatMessage` notification whenever a thread goes from
 * nothing unread to something unread, and a thread being read is marked read on every arrival,
 * so every message into it qualified.
 *
 * One value, not a set: the app shows at most one thread at a time on either design.
 */
let activeConversationId: number | null = null;

/**
 * Claims a thread as the one on screen. Returns the release.
 *
 * The release clears the claim only if this caller still holds it. Two chat screens overlap more
 * often than it looks — a params change remounts the screen, and React re-runs effects in
 * development — and a plain reset let the OUTGOING screen's cleanup, which runs after the
 * incoming one's setup, wipe the claim that had just been made.
 */
export function claimActiveConversation(conversationId: number): () => void {
  activeConversationId = conversationId;
  return () => {
    if (activeConversationId === conversationId) activeConversationId = null;
  };
}

/** Whether this thread is the one the user is looking at. */
export function isActiveConversation(conversationId: number | null | undefined): boolean {
  return conversationId != null && activeConversationId === conversationId;
}
