import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useResponsive, byMode } from '../../../hooks/useResponsive';
import { useConversationInbox } from '../../../hooks/useConversationInbox';
import { TOPBAR_HEIGHT } from '../../../components/layout/chrome';
import { ConversationList } from '../components';
import ChatThread, { type ChatThreadParams } from './ChatThread';
import type { ConversationDto, MessageDto } from '../../../services/messages';

/**
 * Below this the two panes stop fitting side by side.
 *
 * The workspace is laid out in what is left of the window *after* the sidebar, so at the tablet
 * breakpoint a 320px list would leave the thread narrower than a phone's — bubbles wrapping every
 * few words beside an inbox nobody asked to keep on screen. Under it the phone flow is the right
 * one even in a browser: the inbox is a page, and a thread is a page.
 */
export const WORKSPACE_MIN_WIDTH = 1024;

export type MessagesWorkspaceProps = {
  /**
   * A thread to open on arrival — a deep link (`/messages/12`), "Message provider" from a service,
   * or the chat action on a booking. Omitted by the inbox itself, which opens with no thread
   * selected and the placeholder beside the list.
   */
  initialThread?: ChatThreadParams;
  /**
   * Told which thread is now open, for a route that carries one in its URL.
   *
   * Switching threads here is deliberately not a navigation, but the address bar should still say
   * what is on screen: without this it keeps naming whatever thread you arrived with, so a
   * refresh — or a copied link — takes you back to a conversation you left three clicks ago.
   */
  onThreadOpened?: (conversationId: number) => void;
};

/**
 * Messages on the web design: the inbox permanently on the left, the open thread on the right.
 *
 * On a phone the two are separate screens, and they should be — there is only room for one at a
 * time, so tapping a row is a navigation. On a desktop that same flow blanks the whole left half
 * of the window the moment you read anything, and switching threads means going back first. Here
 * the list stays put and the pane beside it swaps, so threads read as tabs: one click each way,
 * and the conversation you were just in is still one row away.
 *
 * Selection is local state rather than a `navigate`, which is what keeps switching instant — the
 * inbox is not refetched, the list's hub subscription survives, and nothing animates. The address
 * bar still keeps up: `/messages/:conversationId` opens a thread on the way *in*, and a route that
 * carries one is told which thread is open (`onThreadOpened`) so a refresh or a copied link lands
 * on the conversation being read rather than the one it was entered with.
 */
export default function MessagesWorkspace({
  initialThread,
  onThreadOpened,
}: MessagesWorkspaceProps) {
  const { hex, cardBg, borderColor, textColor, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const { mode } = useResponsive();
  const [thread, setThread] = useState<ChatThreadParams | null>(
    identifiesThread(initialThread) ? initialThread! : null
  );
  /**
   * The id of the thread on screen, which is not the same as what was asked for: a pane opened by
   * provider or booking id resolves its conversation server-side, and only then can its row be
   * highlighted.
   */
  const [openId, setOpenId] = useState<number | null>(initialThread?.conversationId ?? null);
  // The list needs to know which thread is being read: a message arriving in it must not light an
  // unread pill on the row the reader is looking at.
  const {
    conversations,
    isLoading,
    isRefreshing,
    loadError,
    refresh,
    markThreadRead,
    noteSentMessage,
    noteOpenedThread,
  } = useConversationInbox(openId);

  /**
   * Follow the route when it names a *different* thread than the one this pane was opened with.
   *
   * `useState` takes its initial value once, so without this the pane latches onto whatever it
   * mounted with. React Navigation's `navigate` to a route already in the stack **updates its
   * params instead of remounting**, which is exactly what a second chat notification does
   * (`followNotificationRoute` → `navigate('Chat', { conversationId })`), and what "Message
   * provider" does when the Chat route is already open — so the tap would land on a pane still
   * showing the previous conversation, and read as doing nothing at all.
   *
   * Keyed on the thread's identity, not the params object: a row clicked in the list here must
   * not be reverted by a re-render that hands the same route params over again.
   */
  const initialKey = identifiesThread(initialThread) ? threadKey(initialThread!) : null;
  const appliedInitialKey = useRef(initialKey);
  useEffect(() => {
    if (initialKey === appliedInitialKey.current) return;
    appliedInitialKey.current = initialKey;
    if (initialKey == null || !initialThread) return;
    setThread(initialThread);
    setOpenId(initialThread.conversationId ?? null);
  }, [initialKey, initialThread]);

  const select = useCallback(
    (conversation: ConversationDto) => {
      setThread({ conversationId: conversation.id });
      setOpenId(conversation.id);
      markThreadRead(conversation.id);
      onThreadOpened?.(conversation.id);
    },
    [markThreadRead, onThreadOpened]
  );

  const handleLoaded = useCallback(
    (conversation: ConversationDto) => {
      setOpenId(conversation.id);
      // A thread opened by provider or booking id only learns its conversation id here, which is
      // the id the URL should carry.
      onThreadOpened?.(conversation.id);
      // Upsert, not just mark-read: a thread reached from a service page or a booking may be
      // younger than the list beside it.
      noteOpenedThread(conversation);
    },
    [noteOpenedThread, onThreadOpened]
  );

  const handleSent = useCallback(
    (message: MessageDto) => noteSentMessage(message.conversationId, message),
    [noteSentMessage]
  );

  // Wide enough for a name, a preview line and a timestamp without ellipsising all three, and
  // fixed rather than proportional so every extra pixel goes to the thread.
  const listWidth = byMode(mode, { mobile: 320, tablet: 320, desktop: 360 });

  return (
    <View
      // The workspace is exactly the space under the top bar: both columns scroll inside
      // themselves and the page behind them does not scroll at all. Leaning on `flex: 1` through
      // the shell, the pattern layer and the navigator's card is what used to strand a chat
      // composer in the middle of the page — same calc, same reason, as in ChatThread.
      style={{ height: `calc(100vh - ${TOPBAR_HEIGHT}px)` as any, padding: 24 }}>
      <View
        className={`flex-1 flex-row overflow-hidden rounded-2xl border ${borderColor}`}
        style={{ backgroundColor: hex.bg }}>
        {/* ── Inbox column ───────────────────────────────────────────────────────────────── */}
        <View
          className={`border-r ${borderColor} ${cardBg}`}
          style={{ width: listWidth, minHeight: 0 }}>
          <View className={`flex-row items-center border-b px-4 py-3 ${borderColor}`}>
            <View className="flex-1">
              <Text className={`text-base font-bold ${textColor}`}>{t('messages.title')}</Text>
              <Text className={`mt-0.5 text-xs ${subtextColor}`}>{t('messages.subtitle')}</Text>
            </View>
            {/* The web design has no pull-to-refresh, so a list that refreshes needs a visible
                way to ask for it (WEB_LAYOUT.md B9). Live pushes keep this list current, but a
                dropped socket is exactly when someone reaches for it. */}
            <TouchableOpacity
              onPress={refresh}
              disabled={isRefreshing || isLoading}
              accessibilityRole="button"
              accessibilityLabel={t('common.refresh')}
              className="h-8 w-8 items-center justify-center rounded-full">
              {isRefreshing ? (
                <ActivityIndicator size="small" color={BRAND_GREEN} />
              ) : (
                <Ionicons name="refresh" size={17} color={hex.subtext} />
              )}
            </TouchableOpacity>
          </View>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={false}>
            <ConversationList
              conversations={conversations}
              isLoading={isLoading}
              error={loadError}
              selectedId={openId}
              onSelect={select}
            />
          </ScrollView>
        </View>

        {/* ── Thread pane ────────────────────────────────────────────────────────────────── */}
        <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {thread ? (
            // Keyed on the thread so switching rows remounts rather than reconciles: the pane
            // holds a thread's messages, its paging cursor and its hub subscription, and carrying
            // any of those into the next conversation shows one thread's history under another's
            // name until the fetch lands.
            <ChatThread
              key={threadKey(thread)}
              params={thread}
              embedded
              onConversationLoaded={handleLoaded}
              onMessageSent={handleSent}
            />
          ) : (
            <EmptyPane />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Whether these params name a thread at all.
 *
 * The Chat route hands over `route.params ?? {}`, and an empty object is truthy — without this a
 * param-less arrival would render a pane that resolves nothing and reports the conversation as
 * unavailable, where what it should show is the placeholder.
 */
function identifiesThread(params?: ChatThreadParams): boolean {
  return (
    params != null &&
    (params.conversationId != null || params.serviceProviderId != null || params.bookingId != null)
  );
}

/** Identity of a thread request, for the remount key. */
function threadKey(params: ChatThreadParams): string {
  if (params.conversationId != null) return `c${params.conversationId}`;
  if (params.serviceProviderId != null)
    return `p${params.serviceProviderId}:${params.serviceId ?? ''}`;
  return `b${params.bookingId ?? ''}`;
}

/**
 * What the pane says before a thread is picked.
 *
 * A blank half-window reads as a page that failed to load, so this names the surface and says what
 * to do with the column beside it — the one instruction a two-pane layout needs.
 */
function EmptyPane() {
  const { hex, textColor, subtextColor, isDarkMode } = useThemeColors();
  const { t } = useLocale();

  return (
    <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: hex.bg }}>
      <View
        className={`mb-4 h-20 w-20 items-center justify-center rounded-full ${
          isDarkMode ? 'bg-[#14372a]' : 'bg-brand-50'
        }`}>
        <Ionicons name="chatbubbles-outline" size={36} color={BRAND_GREEN} />
      </View>
      <Text className={`text-center text-base font-semibold ${textColor}`}>
        {t('messages.paneTitle')}
      </Text>
      <Text className={`mt-1 max-w-[380px] text-center text-sm ${subtextColor}`}>
        {t('messages.paneHint')}
      </Text>
    </View>
  );
}
