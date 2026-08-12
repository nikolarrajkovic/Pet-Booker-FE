import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../../hooks/useThemeColors';

export interface ComposerLockedNoticeProps {
  /** Already-localized explanation of why the thread is read-only. */
  message: string;
  isDarkMode: boolean;
}

/**
 * Replaces the composer when the backend says the caller may not write.
 *
 * Shown rather than hiding the thread, because a closed conversation is read-only, never gone:
 * both sides keep their history, and a new booking (or the provider's reply) reopens it. Saying
 * *why* here is the whole point — the alternative is a send that fails with a 401 after the user
 * has typed a paragraph.
 */
export default function ComposerLockedNotice({ message, isDarkMode }: ComposerLockedNoticeProps) {
  const { borderColor, cardBg, subtextColor } = themeColors(isDarkMode);

  return (
    <View className={`flex-row items-start border-t px-4 py-3 ${borderColor} ${cardBg}`}>
      <Ionicons
        name="lock-closed-outline"
        size={16}
        color={isDarkMode ? '#8FA3B8' : '#6B7280'}
        style={{ marginTop: 1 }}
      />
      <Text className={`ml-2 flex-1 text-[13px] leading-5 ${subtextColor}`}>{message}</Text>
    </View>
  );
}
