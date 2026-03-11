import React from 'react';
import { View, Text, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationToggleProps {
  icon?: string;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
}

export default function NotificationToggle({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  isDarkMode,
  textColor,
  subtextColor,
}: NotificationToggleProps) {
  return (
    <View className="px-4 py-4 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        {icon && (
          <Ionicons name={icon as any} size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
        )}
        <View className={`${icon ? 'ml-3' : ''} flex-1`}>
          <Text className={`text-base font-semibold ${textColor}`}>{title}</Text>
          <Text className={`text-sm ${subtextColor} mt-0.5`}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
        thumbColor="white"
        ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
      />
    </View>
  );
}
