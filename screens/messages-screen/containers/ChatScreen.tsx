import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { useMessages } from '../../../context/MessagesContext';
import ListState from '../../../components/shared/ListState';
import { MessageBubble, MessageComposer, ComposerLockedNotice } from '../components';
import { getErrorMessage } from '../../../services/http';
import { resolveImageUrl } from '../../../services/service-providers';
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
 * Route params. Either identifies an existing thread by `conversationId` (inbox, deep link), or
 * asks for the thread with a provider by `serviceProviderId` (the chat buttons on ServiceDetail
 * and the booking cards), or by `bookingId` (the provider's entry point — the booking names the
 * customer, so a provider never has to address an arbitrary user). All three are get-or-create.
 */
export type ChatRouteParams = {
  conversationId?: number;
  serviceProviderId?: number;
  serviceId?: number | null;
  bookingId?: number | null;
  /** Shown in the header until the conversation loads, so it never opens blank. */
  providerName?: string;
  providerAvatar?: string | null;
  subtitle?: string;
};

const PAGE_SIZE = 30;

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

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: ChatRouteParams }, 'params'>>();
  const params = route.params ?? {};
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor, hex } =
    useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  const {
    subscribe,
    subscribeToReads,
    subscribeToTyping,
    joinThread,
    notifyTyping,
    refreshUnreadCount,
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

  const sortMessages = (list: MessageDto[]) =>
    [...list].sort((a, b) => a.id - b.id);

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
      avatar:
        resolveImageUrl(conversation?.counterpartAvatarUrl) || params.providerAvatar || null,
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

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header — avatar + who, mirroring the design. No call button: voice calling is
          deliberately out of scope, and a dead icon is worse than none. */}
      <View className={`flex-row items-center border-b px-3 py-2.5 ${borderColor} ${cardBg}`}>
        <TouchableOpacity
          onPress={() =>
            navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')
          }
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="mr-2 h-9 w-9 items-center justify-center rounded-full">
          <Ionicons name="arrow-back" size={22} color={hex.text} />
        </TouchableOpacity>

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

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
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
                    <View
                      className={`rounded-full px-2.5 py-1 ${
                        isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
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
    </SafeAreaView>
  );
}
