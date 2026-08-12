import React, { useCallback, useState } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import { useMessages } from '../../../context/MessagesContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import { ConversationRow } from '../components';
import { getErrorMessage } from '../../../services/http';
import { resolveImageUrl } from '../../../services/service-providers';
import { getConversations, type ConversationDto } from '../../../services/messages';

/** Compact relative time for an inbox row ("now", "4m", "3h", "2d", then a date). */
function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * The message inbox — every thread the signed-in user is part of, newest first.
 *
 * A partner is both a customer and a provider, so their inbox is queried by
 * `serviceProviderId` (threads customers opened with them) and falls back to `userId` otherwise.
 */
export default function ConversationsScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, bgColor } = useThemeColors();
  const { currentUser } = useAuth();
  const { t } = useLocale();
  const { refreshUnreadCount } = useMessages();

  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const providerId = currentUser?.serviceProviderId || null;
  const userId = currentUser?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    setLoadError(null);
    try {
      const rows = await getConversations(
        providerId ? { serviceProviderId: providerId } : { userId }
      );
      // Newest activity first; a thread with no messages yet sorts to the bottom.
      setConversations(
        [...rows].sort(
          (a, b) =>
            new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()
        )
      );
      refreshUnreadCount();
    } catch (e) {
      setConversations([]);
      setLoadError(getErrorMessage(e, t('messages.inboxLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [userId, providerId, t, refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('messages.title')}
      contentBg={bgColor}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={BRAND_GREEN}
            colors={[BRAND_GREEN]}
          />
        }>
        <ListState
          isLoading={isLoading}
          error={loadError}
          isEmpty={conversations.length === 0}
          emptyIcon="chatbubbles-outline"
          emptyMessage={t('messages.emptyInbox')}>
          {conversations.map((c) => {
            // A customer sees the provider; a provider sees the customer.
            const showingProvider = !providerId;
            const photo = showingProvider
              ? (c.serviceProvider?.photos?.find((p) => p.isSelected)?.src ??
                c.serviceProvider?.photos?.[0]?.src)
              : (c.user?.photos?.find((p) => p.isSelected)?.src ?? c.user?.photos?.[0]?.src);
            const name = showingProvider
              ? (c.serviceProvider?.name ?? t('messages.conversation'))
              : (c.user?.userName ?? t('messages.conversation'));

            return (
              <ConversationRow
                key={c.id}
                name={name}
                subtitle={c.service?.name ?? undefined}
                avatarUrl={resolveImageUrl(photo) || null}
                lastMessage={c.lastMessage}
                timeLabel={relativeTime(c.lastMessageAt)}
                unreadCount={c.unreadCount ?? 0}
                isDarkMode={isDarkMode}
                onPress={() => navigation.navigate('Chat', { conversationId: c.id })}
              />
            );
          })}
        </ListState>
      </ScrollView>
    </ScreenLayout>
  );
}
