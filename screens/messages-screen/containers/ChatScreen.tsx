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
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { useMessages } from '../../../context/MessagesContext';
import ListState from '../../../components/shared/ListState';
import { MessageBubble, MessageComposer } from '../components';
import { getErrorMessage } from '../../../services/http';
import { resolveImageUrl } from '../../../services/service-providers';
import {
  getConversation,
  getMessagesPage,
  markConversationRead,
  openConversation,
  sendMessage,
  type ConversationDto,
  type MessageDto,
} from '../../../services/messages';

/**
 * Route params. Either identifies an existing thread by `conversationId` (inbox, deep link) or
 * asks for the thread with a provider by `serviceProviderId` (the chat buttons on ServiceDetail
 * and the booking cards) — the latter is get-or-create, so a caller never has to know whether a
 * thread already exists.
 */
export type ChatRouteParams = {
  conversationId?: number;
  serviceProviderId?: number;
  serviceId?: number | null;
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
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const { t } = useLocale();
  const { subscribe, subscribeToReads, refreshUnreadCount } = useMessages();

  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const scrollRef = useRef<ScrollView>(null);
  const meId = currentUser?.id ?? -1;
  const conversationId = conversation?.id ?? params.conversationId ?? null;

  /** Newest-first from the API; the thread renders oldest-first. */
  const sortMessages = (list: MessageDto[]) =>
    [...list].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  // Resolve the thread, then its first page of history.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const convo = params.conversationId
          ? await getConversation(params.conversationId)
          : params.serviceProviderId
            ? await openConversation(params.serviceProviderId, params.serviceId)
            : null;
        if (!convo) throw new Error(t('messages.threadUnavailable'));
        if (cancelled) return;
        setConversation(convo);

        const first = await getMessagesPage(convo.id, 1, PAGE_SIZE);
        if (cancelled) return;
        setMessages(sortMessages(first.items));
        setHasMore(first.hasMore);
        setPage(1);

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
  }, [params.conversationId, params.serviceProviderId, params.serviceId, t, refreshUnreadCount]);

  // Live inbound messages for THIS thread.
  useEffect(() => {
    if (conversationId == null) return;
    return subscribe((incoming) => {
      if (incoming.conversationId !== conversationId) return;
      setMessages((prev) => {
        // The hub echoes our own sends back — de-dupe by id so an optimistic
        // bubble is replaced rather than doubled.
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return sortMessages([...prev, incoming]);
      });
      if (incoming.senderUserId !== meId) {
        markConversationRead(conversationId)
          .then(refreshUnreadCount)
          .catch(() => {});
      }
    });
  }, [conversationId, meId, subscribe, refreshUnreadCount]);

  // The other party opened the thread — flip our ticks to read.
  useEffect(() => {
    if (conversationId == null) return;
    return subscribeToReads((event) => {
      if (event.conversationId !== conversationId || event.readerUserId === meId) return;
      setMessages((prev) =>
        prev.map((m) => (m.senderUserId === meId && !m.readAt ? { ...m, readAt: event.readAt } : m))
      );
    });
  }, [conversationId, meId, subscribeToReads]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || conversationId == null) return;
    try {
      const next = await getMessagesPage(conversationId, page + 1, PAGE_SIZE);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return sortMessages([...next.items.filter((m) => !seen.has(m.id)), ...prev]);
      });
      setHasMore(next.hasMore);
      setPage((p) => p + 1);
    } catch {
      // Silent: the thread the user already has stays usable.
    }
  }, [hasMore, conversationId, page]);

  const handleSend = async (body: string) => {
    if (conversationId == null) return;
    // Optimistic bubble with a negative id — it can never collide with a server id, so the
    // echo from the hub replaces it cleanly.
    const optimistic: MessageDto = {
      id: -Date.now(),
      conversationId,
      senderUserId: meId,
      body,
      sentAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      const saved = await sendMessage(conversationId, body);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id && m.id !== saved.id),
        saved,
      ]);
    } catch (e) {
      // Drop the optimistic bubble rather than leaving a message that looks delivered.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      showError(getErrorMessage(e, t('messages.sendFailed')));
    } finally {
      setSending(false);
    }
  };

  const counterparty = useMemo(() => {
    const providerName = conversation?.serviceProvider?.name ?? params.providerName ?? '';
    const providerPhoto =
      conversation?.serviceProvider?.photos?.find((p) => p.isSelected)?.src ??
      conversation?.serviceProvider?.photos?.[0]?.src;
    return {
      name: providerName || t('messages.conversation'),
      avatar: resolveImageUrl(providerPhoto) || params.providerAvatar || null,
      subtitle: conversation?.service?.name ?? params.subtitle ?? '',
    };
  }, [conversation, params.providerName, params.providerAvatar, params.subtitle, t]);

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
          {!!counterparty.subtitle && (
            <Text numberOfLines={1} className={`text-xs ${subtextColor}`}>
              {counterparty.subtitle}
            </Text>
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
                  isMine={message.senderUserId === meId}
                  avatarUrl={counterparty.avatar}
                  isRead={!!message.readAt}
                  isDarkMode={isDarkMode}
                />
              </View>
            ))}
          </ListState>
        </ScrollView>

        {!loadError && (
          <MessageComposer onSend={handleSend} sending={sending} isDarkMode={isDarkMode} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
