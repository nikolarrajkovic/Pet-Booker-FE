import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

interface EnableNotificationsCardProps {
  isDarkMode: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

export default function EnableNotificationsCard({
  isDarkMode,
  onEnable,
  onDismiss,
}: EnableNotificationsCardProps) {
  const { t } = useLocale();
  const enableModalBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-green-50';

  return (
    <View
      className={`${enableModalBg} mx-4 mt-4 rounded-2xl border p-6 ${isDarkMode ? 'border-[#243447]' : 'border-green-100'}`}>
      <View className="mb-4 items-center">
        <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-brand-500">
          <Ionicons name="notifications" size={28} color="white" />
        </View>
        <Text
          className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-[#1a365d]'} mb-2`}>
          {t('notificationSettings.enableTitle')}
        </Text>
        <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center`}>
          {t('notificationSettings.enableText')}
        </Text>
      </View>
      <TouchableOpacity className="mb-2 rounded-xl bg-brand-500 py-3" onPress={onEnable}>
        <Text className="text-center text-base font-semibold text-white">
          {t('notificationSettings.enableCta')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} className="py-2">
        <Text
          className={`text-center font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('notificationSettings.maybeLater')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
