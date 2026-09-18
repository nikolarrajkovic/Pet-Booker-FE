import React from 'react';
import { useLocale } from '../../../context/LocaleContext';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ListState from '../../../components/shared/ListState';
import { resolveImageUrl } from '../../../services/service-providers';
import type { ConversationDto } from '../../../services/messages';
import ConversationRow from './ConversationRow';

/** Compact relative time for an inbox row ("now", "4m", "3h", "2d", then a date). */
export function relativeTime(iso?: string | null): string {
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

export interface ConversationListProps {
  conversations: ConversationDto[];
  isLoading: boolean;
  error?: string | null;
  /** The thread open beside the list on the web design; omitted on the phone design. */
  selectedId?: number | null;
  onSelect: (conversation: ConversationDto) => void;
}

/**
 * The inbox rows, with their loading / error / empty ladder.
 *
 * Shared by both designs: the phone's inbox screen renders it as the whole page and pushes a
 * thread on tap, the web workspace renders it in its left column and swaps the pane beside it.
 * Keeping one component is what stops "which row is unread" and "what does an empty inbox say"
 * being answered twice.
 */
export default function ConversationList({
  conversations,
  isLoading,
  error,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const { isDarkMode } = useThemeColors();
  const { t } = useLocale();

  return (
    <ListState
      isLoading={isLoading}
      error={error ?? undefined}
      isEmpty={conversations.length === 0}
      emptyIcon="chatbubbles-outline"
      emptyMessage={t('messages.emptyInbox')}>
      {conversations.map((c) => (
        <ConversationRow
          key={c.id}
          name={c.counterpartName || t('messages.conversation')}
          subtitle={c.serviceName ?? undefined}
          avatarUrl={resolveImageUrl(c.counterpartAvatarUrl) || null}
          lastMessage={c.lastMessagePreview}
          timeLabel={relativeTime(c.lastMessageAt)}
          unreadCount={c.unreadCount ?? 0}
          isSelected={selectedId != null && selectedId === c.id}
          isDarkMode={isDarkMode}
          onPress={() => onSelect(c)}
        />
      ))}
    </ListState>
  );
}
