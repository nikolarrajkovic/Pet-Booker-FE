import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../../hooks/useThemeColors';

export interface ConversationRowProps {
  name: string;
  /** Service type or the service the thread started from — the grey line under the name. */
  subtitle?: string;
  avatarUrl?: string | null;
  lastMessage?: string | null;
  /** Pre-formatted relative time ("2h ago"), so the row stays presentational. */
  timeLabel?: string;
  unreadCount?: number;
  /**
   * The thread currently open beside the list, on the web design's two-pane workspace.
   *
   * The phone design never passes it: there the list and the thread are different screens, so
   * nothing is open while the list is on screen and a highlighted row would point at nothing.
   */
  isSelected?: boolean;
  isDarkMode: boolean;
  onPress: () => void;
}

/** One inbox row: avatar, who, the last thing said, when, and an unread pill. */
export default function ConversationRow({
  name,
  subtitle,
  avatarUrl,
  lastMessage,
  timeLabel,
  unreadCount = 0,
  isSelected = false,
  isDarkMode,
  onPress,
}: ConversationRowProps) {
  const { cardBg, textColor, subtextColor, borderColor } = themeColors(isDarkMode);
  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={name}
      // The selected row is the workspace's "which tab am I on" — a brand border plus a tinted
      // ground, rather than a border colour alone, which is invisible against an unread row's
      // bolding at a glance.
      className={`mb-3 flex-row items-center rounded-2xl border p-3 ${
        isSelected
          ? `border-brand-500 ${isDarkMode ? 'bg-[#123326]' : 'bg-brand-50'}`
          : `${cardBg} ${borderColor}`
      }`}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} className="h-12 w-12 rounded-full" />
      ) : (
        <View
          className={`h-12 w-12 items-center justify-center rounded-full ${
            isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
          }`}>
          <Ionicons name="person" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
        </View>
      )}

      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          {/* An unread thread bolds the name, the way every inbox signals it. */}
          <Text
            numberOfLines={1}
            className={`flex-1 pr-2 text-[15px] ${hasUnread ? 'font-bold' : 'font-semibold'} ${textColor}`}>
            {name}
          </Text>
          {!!timeLabel && <Text className={`text-xs ${subtextColor}`}>{timeLabel}</Text>}
        </View>

        {!!subtitle && (
          <Text numberOfLines={1} className={`mt-0.5 text-xs ${subtextColor}`}>
            {subtitle}
          </Text>
        )}

        <View className="mt-1 flex-row items-center justify-between">
          <Text
            numberOfLines={1}
            className={`flex-1 pr-2 text-sm ${hasUnread ? textColor : subtextColor}`}>
            {lastMessage ?? ''}
          </Text>
          {hasUnread && (
            <View className="ml-2 h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1.5">
              <Text className="text-[11px] font-bold text-white">{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
