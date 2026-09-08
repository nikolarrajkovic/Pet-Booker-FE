import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

type PushPermissionNoticeProps = {
  /** 'blocked' — the OS refuses; 'unavailable' — push can't work here at all (web, simulator). */
  variant: 'blocked' | 'unavailable';
  isDarkMode: boolean;
  onOpenSettings?: () => void;
};

/**
 * Why the push switch isn't doing what the user expects, and the one action that fixes it.
 *
 * Sits directly under the push row rather than at the bottom of the screen: the answer has to be
 * next to the control that raised the question. The settings button only appears for 'blocked',
 * because on web or a simulator there is no permission to grant — sending someone to the OS
 * settings there would be a dead end.
 */
export default function PushPermissionNotice({
  variant,
  isDarkMode,
  onOpenSettings,
}: PushPermissionNoticeProps) {
  const { t } = useLocale();
  const blocked = variant === 'blocked';

  // Amber reads as "needs your attention"; the unavailable case is just a fact, so it stays grey.
  const accent = blocked ? '#D97706' : isDarkMode ? '#9ca3af' : '#6b7280';
  const bg = blocked
    ? isDarkMode
      ? 'bg-[#2a2213]'
      : 'bg-yellow-50'
    : isDarkMode
      ? 'bg-[#1b2431]'
      : 'bg-gray-50';

  return (
    <View className={`${bg} px-4 py-3`}>
      <View className="flex-row">
        <Ionicons
          name={blocked ? 'warning-outline' : 'information-circle-outline'}
          size={16}
          color={accent}
          style={{ marginTop: 2 }}
        />
        <View className="ml-2 flex-1">
          <Text className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {t(
              blocked
                ? 'notificationSettings.pushBlockedTitle'
                : 'notificationSettings.pushUnavailableTitle'
            )}
          </Text>
          <Text className={`mt-0.5 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {t(
              blocked
                ? 'notificationSettings.pushBlockedText'
                : 'notificationSettings.pushUnavailableText'
            )}
          </Text>
        </View>
      </View>
      {blocked && onOpenSettings && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onOpenSettings}
          className="mt-2 self-start rounded-lg bg-brand-500 px-3 py-2">
          <Text className="text-xs font-semibold text-white">
            {t('notificationSettings.openSettings')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
