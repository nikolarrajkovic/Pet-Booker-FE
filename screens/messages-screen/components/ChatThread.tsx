import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { useMessages } from '../../../context/MessagesContext';
import ListState from '../../../components/shared/ListState';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import ComposerLockedNotice from './ComposerLockedNotice';
import { getErrorMessage } from '../../../services/http';
import { resolveImageUrl } from '../../../services/service-providers';
import { useResponsive } from '../../../hooks/useResponsive';
import { useTopInset, useBottomInset } from '../../../hooks/useSafeAreaSpacing';
import { CONTENT_WIDTHS } from '../../../components/shared/ContentContainer';
import { TOPBAR_HEIGHT } from '../../../components/layout/topBarMetrics';
import {
  ChatAccessReason,
  ChatParticipant,
  getConversation,
  getMessagesPage,
  markConversationRead,
  openBookingConversation,
  openConversation,
  sendMessage,
  type ChatAccessDto,
  type ConversationDto,
  type MessageDto,
} from '../../../services/messages';

/**
 * Which thread to open. Either identifies an existing one by `conversationId` (inbox, deep link),
 * or asks for the thread with a provider by `serviceProviderId` (the chat buttons on
 * ServiceDetail and the booking cards), or by `bookingId` (the provider's entry point — the
 * booking names the customer, so a provider never has to address an arbitrary user). All three
 * are get-or-create.
 */
export type ChatThreadTarget = {
  conversationId?: number;
  serviceProviderId?: number;
  serviceId?: number | null;
  bookingId?: number | null;
  /** Shown in the header until the conversation loads, so it never opens blank. */
  providerName?: string;
  providerAvatar?: string | null;
  subtitle?: string;
};

export type ChatThreadProps = ChatThreadTarget & {
  /**
   * Drawn inside a frame the parent owns — the web design's split view, where the inbox is the
   * column to the right. Drops the back arrow (there is nothing to go back to: the list is on
   * screen) and fills the pane instead of pinning itself to the viewport.
   */
  embedded?: boolean;
  /**
   * Fires with the thread this actually resolved to. `serviceProviderId`/`bookingId` are
   * get-or-create instructions rather than addresses, so the caller cannot know which row they
   * land on — the split view needs it to mark the right inbox entry as selected.
   */
  onConversationResolved?: (conversation: ConversationDto) => void;
};

const PAGE_SIZE = 30;

/**
 * The ground behind the bubbles: the brand green in the top-left corner, fading to white.
 *
 * The green is a tint, not the full `brand-500`, because your own bubbles are solid `brand-500`
 * and would vanish into it. It runs corner to corner rather than top to bottom so each side of
 * the conversation lands on the end that sets it off: the other side's white bubbles hug the
 * left edge, where the green is, and your green bubbles hug the right, where it has faded out.
 *
 * Dark mode keeps the hue and drops the white — a white corner in a dark thread would glare.
 * The stops are the brand green with alpha over the base colour, so a palette change follows.
 */
const THREAD_GROUND = {
  light: [`${BRAND_GREEN}59`, `${BRAND_GREEN}00`],
  dark: [`${BRAND_GREEN}2E`, `${BRAND_GREEN}00`],
} as const;

/** Locale-aware clock time for a bubble's timestamp chip. */
function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Whether a separator should sit above `current`.
 *
 * Stamping every bubble turns the thread into noise, so a chip appears only when the gap since
 * the previous message is worth noticing (5 minutes) — matching the design, where a burst of
 * replies shares one heading.
 */
function needsSeparator(current: MessageDto, previous?: MessageDto): boolean {
  if (!previous) return true;
  const a = new Date(previous.sentAt).getTime();
  const b = new Date(current.sentAt).getTime();
  if (isNaN(a) || isNaN(b)) return false;
  return b - a > 5 * 60 * 1000;
}

/**
 * One conversation: header, the messages, the composer.
 *
 * Lives in `components/` rather than being the chat *screen* because the web design draws it in
 * two frames — as the whole route on a phone-width window, and as the right-hand pane of the
 * inbox split view on a wide one. Everything about a thread is the same in both; only the frame
 * differs, which is what `embedded` selects.
 */
export default function ChatThread({
  embedded = false,
  onConversationResolved,
  ...params
}: ChatThreadProps) {
  const { goUp } = useAppNavigation();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor, hex } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const {
    subscribe,
    subscribeToReads,
    subscribeToTyping,
    subscribeToReconnect,
    joinThread,
    notifyTyping,
    refreshUnreadCount,
    claimActiveConversation,
  } = useMessages();

  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [theyAreTyping, setTheyAreTyping] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const conversationId = conversation?.id ?? params.conversationId ?? null;

  /**
   * Which side of the thread we are on. Comes from the server, NOT from comparing ids: a
   * company-managed provider account has no Domain.User, so its messages carry a null
   * senderUserId and an id comparison would render every one of them as the customer's.
   */
  const viewer = conversation?.viewer ?? ChatParticipant.User;
  const access: ChatAccessDto | null = conversation?.access ?? null;

  const sortMessages = (list: MessageDto[]) => [...list].sort((a, b) => a.id - b.id);

  // Held in a ref so resolving a thread does not depend on the identity of a callback prop: the
  // split view rebuilds its handler on every render, and this effect refetches the whole thread.
  const resolvedRef = useRef(onConversationResolved);
  resolvedRef.current = onConversationResolved;

  // Resolve the thread, then its newest page of history.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const convo = params.conversationId
          ? await getConversation(params.conversationId)
          : params.serviceProviderId
            ? await openConversation(
                params.serviceProviderId,
                params.serviceId,
                params.bookingId ?? null
              )
            : params.bookingId
              ? await openBookingConversation(params.bookingId)
              : null;
        if (!convo) throw new Error(t('messages.threadUnavailable'));
        if (cancelled) return;
        setConversation(convo);
        resolvedRef.current?.(convo);

        const first = await getMessagesPage(convo.id, null, PAGE_SIZE);
        if (cancelled) return;
        setMessages(sortMessages(first.items));
        setHasMore(first.hasMore);
        setNextBefore(first.nextBefore ?? null);

        // Opening the thread is what marks it read; fail-soft so a read-receipt
        // hiccup never blocks the conversation itself.
        markConversationRead(convo.id)
          .then(refreshUnreadCount)
          .catch(() => {});
      } catch (e) {
        if (!cancelled) setLoadError(getErrorMessage(e, t('messages.loadFailed')));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    params.conversationId,
    params.serviceProviderId,
    params.serviceId,
    params.bookingId,
    t,
    refreshUnreadCount,
  ]);

  // Message bodies travel on the thread's own group, so the screen has to join it — the
  // identity channel the provider keeps open only carries the badge ping.
  useEffect(() => {
    if (conversationId == null) return;
    return joinThread(conversationId);
  }, [conversationId, joinThread]);

  // Claim this thread as the one on screen, so its own arriving messages don't toast over the
  // conversation the user is reading. Released on unmount — every other thread still announces.
  useEffect(() => {
    if (conversationId == null) return;
    return claimActiveConversation(conversationId);
  }, [conversationId, claimActiveConversation]);

  // Live inbound messages for THIS thread.
  useEffect(() => {
    if (conversationId == null) return;
    return subscribe((incoming) => {
      if (incoming.conversationId !== conversationId) return;
      setMessages((prev) => {
        // The group echoes our own sends back — de-dupe by id so an optimistic
        // bubble is replaced rather than doubled.
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return sortMessages([...prev, incoming]);
      });
      if (incoming.sender !== viewer) {
        setTheyAreTyping(false);
        markConversationRead(conversationId, incoming.id)
          .then(refreshUnreadCount)
          .catch(() => {});
        // Their message can CHANGE the verdict, not just add a line: a provider's reply is
        // exactly what lifts a spent enquiry allowance. Without this the composer stays locked
        // behind a notice promising "you can write again once they answer" while the answer is
        // sitting on screen — until the user backs out and re-enters the thread.
        getConversation(conversationId)
          .then(setConversation)
          .catch(() => {});
      }
    });
  }, [conversationId, viewer, subscribe, refreshUnreadCount]);

  /**
   * Catch up after the live channel was down.
   *
   * SignalR does not replay what it missed, so a reply sent while the socket was away — or in
   * the seconds between the API coming back and the client reconnecting — never reached this
   * thread and would stay missing until the user left and came back. Re-read the newest page and
   * merge it by id: the server's copy wins for messages already held, which also brings any read
   * ticks that flipped during the gap.
   */
  useEffect(() => {
    if (conversationId == null) return;
    return subscribeToReconnect(() => {
      getMessagesPage(conversationId, null, PAGE_SIZE)
        .then((latest) => {
          setMessages((prev) => {
            const byId = new Map(prev.map((m) => [m.id, m]));
            for (const m of latest.items) byId.set(m.id, m);
            return sortMessages([...byId.values()]);
          });
          // The thread is on screen, so whatever just landed in it has been seen. Unconditional:
          // marking read is idempotent, and a reconnect is rare enough not to count the call.
          markConversationRead(conversationId)
            .then(refreshUnreadCount)
            .catch(() => {});
          // The verdict may have moved too (their reply lifts a spent enquiry allowance).
          getConversation(conversationId)
            .then(setConversation)
            .catch(() => {});
        })
        .catch(() => {});
    });
  }, [conversationId, subscribeToReconnect, refreshUnreadCount]);

  // The other party opened the thread — flip our ticks to read.
  useEffect(() => {
    if (conversationId == null) return;
    return subscribeToReads((event) => {
      if (event.conversationId !== conversationId || event.reader === viewer) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.sender === viewer && !m.readAt && m.id <= event.upToMessageId
            ? { ...m, readAt: event.readAt, isRead: true }
            : m
        )
      );
    });
  }, [conversationId, viewer, subscribeToReads]);

  // Typing indicator from the other side. Self-clears so a dropped "stopped" frame cannot
  // leave the header stuck on "typing…".
  useEffect(() => {
    if (conversationId == null) return;
    return subscribeToTyping((event) => {
      if (event.conversationId !== conversationId || event.participant === viewer) return;
      setTheyAreTyping(event.isTyping);
    });
  }, [conversationId, viewer, subscribeToTyping]);

  useEffect(() => {
    if (!theyAreTyping) return;
    const timer = setTimeout(() => setTheyAreTyping(false), 6000);
    return () => clearTimeout(timer);
  }, [theyAreTyping]);

  /**
   * Older history, walked by keyset. `nextBefore` is the oldest id we hold, so the server
   * returns strictly older rows — a message arriving while the user scrolls can't shift a page
   * boundary the way an offset would.
   */
  const loadOlder = useCallback(async () => {
    if (!hasMore || conversationId == null || nextBefore == null) return;
    try {
      const older = await getMessagesPage(conversationId, nextBefore, PAGE_SIZE);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return sortMessages([...older.items.filter((m) => !seen.has(m.id)), ...prev]);
      });
      setHasMore(older.hasMore);
      setNextBefore(older.nextBefore ?? null);
    } catch {
      // Silent: the thread the user already has stays usable.
    }
  }, [hasMore, conversationId, nextBefore]);

  const handleSend = async (body: string) => {
    if (conversationId == null) return;
    // Optimistic bubble with a negative id — it can never collide with a server id, so the
    // echo from the hub replaces it cleanly.
    const optimistic: MessageDto = {
      id: -Date.now(),
      conversationId,
      sender: viewer,
      senderUserId: null,
      body,
      sentAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    notifyTyping(conversationId, false);
    try {
      const saved = await sendMessage(conversationId, body, params.bookingId ?? null);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id && m.id !== saved.id),
        saved,
      ]);
      // The allowance and the window are server state: a send can be the one that spends the
      // last enquiry, so re-read the verdict rather than assuming it still holds.
      getConversation(conversationId)
        .then(setConversation)
        .catch(() => {});
    } catch (e) {
      // Drop the optimistic bubble rather than leaving a message that looks delivered.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      showError(getErrorMessage(e, t('messages.sendFailed')));
      getConversation(conversationId)
        .then(setConversation)
        .catch(() => {});
    } finally {
      setSending(false);
    }
  };

  const counterparty = useMemo(
    () => ({
      name: conversation?.counterpartName || params.providerName || t('messages.conversation'),
      avatar: resolveImageUrl(conversation?.counterpartAvatarUrl) || params.providerAvatar || null,
      subtitle: conversation?.serviceName ?? params.subtitle ?? '',
    }),
    [conversation, params.providerName, params.providerAvatar, params.subtitle, t]
  );

  /** Why the composer is locked, in the user's language. */
  const lockedMessage = useMemo(() => {
    if (!access || access.canSendMessage) return null;
    switch (access.reason) {
      case ChatAccessReason.EnquiryLimitReached:
        return t('messages.lockedAwaitingReply');
      case ChatAccessReason.WindowExpired:
        return t('messages.lockedWindowExpired');
      case ChatAccessReason.ProviderNotContactable:
        return t('messages.lockedProviderUnavailable');
      default:
        return t('messages.lockedGeneric');
    }
  }, [access, t]);

  /** "2 messages left before they reply" — only while the allowance is actually counting. */
  const allowanceHint = useMemo(() => {
    const left = access?.remainingEnquiryMessages;
    if (!access?.canSendMessage || left == null) return null;
    return t('messages.enquiryAllowance', { count: left });
  }, [access, t]);

  // A chat thread is a reading column, not a dashboard: message bubbles stretched to 1400px are
  // unreadable, and the composer ends up a metre wide. Capped like a document, and centred so the
  // thread sits under the page rather than hugging the sidebar. Embedded it inherits the split
  // view's pane, which is already a column — capping twice would leave it stranded in the middle
  // of a panel that is itself only part of the page.
  const column =
    isWebLayout && !embedded
      ? { width: '100%' as const, maxWidth: CONTENT_WIDTHS.narrow, alignSelf: 'center' as const }
      : undefined;

  /**
   * Styled, not classed — the ground and the flex ride in the same style array as the safe-area
   * padding below, rather than half in a className and half here. Both matter: without the
   * background the bubbles sit straight on the shell's pet pattern, and without the flex the
   * composer floats in the middle of the page with wallpaper beneath it.
   */
  /**
   * A definite height on the web design, not just `flex: 1`.
   *
   * The composer belongs at the foot of the view with only the messages moving above it, and
   * that needs the column to be exactly as tall as the space under the top bar. Leaning on
   * `flex: 1` left it at the mercy of the whole chain above — the shell, the pattern layer, the
   * navigator's card — and any one of those sizing to its content dropped the composer directly
   * under the last message with empty page beneath. Pinning the height here depends on nothing
   * but the viewport.
   *
   * Embedded is the exception: the split view has already sized the pane, so the thread fills
   * it. Repeating the viewport sum inside a panel that starts below the page's own header would
   * overflow the card by exactly that header's height.
   */
  const root =
    isWebLayout && !embedded
      ? { height: `calc(100vh - ${TOPBAR_HEIGHT}px)` as any, backgroundColor: hex.bg }
      : { flex: 1, minHeight: 0, backgroundColor: hex.bg };

  return (
    <View
      style={[
        root,
        // The thread's own chrome, not a screen header, so it pads for the status bar and the
        // navigation bar itself. Zero in a browser and on the web design.
        isWebLayout ? undefined : { paddingTop: topInset, paddingBottom: bottomInset },
        column,
      ]}>
      {/* Header — avatar + who, mirroring the design. No call button: voice calling is
          deliberately out of scope, and a dead icon is worse than none. */}
      <View className={`flex-row items-center border-b px-3 py-2.5 ${borderColor} ${cardBg}`}>
        {!embedded && (
          <TouchableOpacity
            // `Home` is a tab inside MainTabs, not a root screen, so navigating to it by bare
            // name is unhandled — which is exactly what happens on the no-history path this
            // fallback exists for (a deep link straight into a thread, or a reload on one).
            // goUp() is the shared helper that addresses the nested route correctly.
            // Wrapped, not passed by reference: goUp's first parameter is the fallback tab, and
            // handing it the press event would send the navigator an event object as a route
            // name.
            onPress={() => goUp()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="mr-2 h-9 w-9 items-center justify-center rounded-full">
            <Ionicons name="arrow-back" size={22} color={hex.text} />
          </TouchableOpacity>
        )}

        {counterparty.avatar ? (
          <Image source={{ uri: counterparty.avatar }} className="h-9 w-9 rounded-full" />
        ) : (
          <View
            className={`h-9 w-9 items-center justify-center rounded-full ${
              isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
            }`}>
            <Ionicons name="person" size={18} color={hex.subtext} />
          </View>
        )}

        <View className="ml-2.5 flex-1">
          <Text numberOfLines={1} className={`text-[15px] font-bold ${textColor}`}>
            {counterparty.name}
          </Text>
          {/* Typing takes the subtitle slot while it lasts — one line, no layout jump. */}
          {theyAreTyping ? (
            <Text numberOfLines={1} className="text-xs text-brand-500">
              {t('messages.typing')}
            </Text>
          ) : (
            !!counterparty.subtitle && (
              <Text numberOfLines={1} className={`text-xs ${subtextColor}`}>
                {counterparty.subtitle}
              </Text>
            )
          )}
        </View>
      </View>

      {/* Styled, not classed: `KeyboardAvoidingView` comes from react-native-keyboard-controller,
          which NativeWind does not process, so a `className` on it is dropped in silence. It
          wraps both the message list and the composer, so losing the flex collapsed the pair to
          their content height and left the composer sitting under the last message with the rest
          of the thread empty beneath it. */}
      <KeyboardAvoidingView style={{ flex: 1, minHeight: 0 }} behavior="padding">
        {/*
          A brand-green gradient behind the bubbles (see `THREAD_GROUND`) — on the phone too,
          since a column of bubbles leaves most of the width empty on any screen. It replaced the
          pet texture, which filled the gap with line art at the cost of every bubble reading
          against it; a plain gradient gives the thread its colour without that competition.
        */}
        <LinearGradient
          colors={isDarkMode ? THREAD_GROUND.dark : THREAD_GROUND.light}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, minHeight: 0, backgroundColor: isDarkMode ? hex.bg : '#FFFFFF' }}>
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            onScroll={({ nativeEvent }) => {
              // Reaching the top pulls in older history — the natural direction for a thread.
              if (nativeEvent.contentOffset.y <= 0) loadOlder();
            }}
            scrollEventThrottle={200}>
            <ListState
              isLoading={isLoading}
              error={loadError}
              isEmpty={messages.length === 0}
              emptyIcon="chatbubble-ellipses-outline"
              emptyMessage={t('messages.emptyThread')}>
              {messages.map((message, i) => (
                <View key={message.id}>
                  {needsSeparator(message, messages[i - 1]) && (
                    <View className="my-2 items-center">
                      {/* Opaque, not the old `bg-gray-100`: the chip now sits on the pattern,
                          and a tinted grey let the line art show straight through the label. */}
                      <View
                        className={`rounded-full px-2.5 py-1 ${
                          isDarkMode ? 'bg-[#243447]' : 'bg-white'
                        }`}>
                        <Text className={`text-[11px] ${subtextColor}`}>
                          {timeLabel(message.sentAt)}
                        </Text>
                      </View>
                    </View>
                  )}
                  <MessageBubble
                    body={message.body}
                    isMine={message.sender === viewer}
                    avatarUrl={counterparty.avatar}
                    isRead={!!message.readAt}
                    isDarkMode={isDarkMode}
                  />
                </View>
              ))}
            </ListState>
          </ScrollView>
        </LinearGradient>

        {!!allowanceHint && (
          <Text className={`px-4 pb-1 text-center text-[11px] ${subtextColor}`}>
            {allowanceHint}
          </Text>
        )}

        {!loadError &&
          (lockedMessage ? (
            <ComposerLockedNotice message={lockedMessage} isDarkMode={isDarkMode} />
          ) : (
            <MessageComposer
              onSend={handleSend}
              sending={sending}
              isDarkMode={isDarkMode}
              onTypingChange={
                conversationId != null
                  ? (typing) => notifyTyping(conversationId, typing)
                  : undefined
              }
            />
          ))}
      </KeyboardAvoidingView>
    </View>
  );
}
