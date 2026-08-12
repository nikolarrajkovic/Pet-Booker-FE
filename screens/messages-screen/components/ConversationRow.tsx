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
      className={`mb-3 flex-row items-center rounded-2xl border p-3 ${cardBg} ${borderColor}`}>
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
