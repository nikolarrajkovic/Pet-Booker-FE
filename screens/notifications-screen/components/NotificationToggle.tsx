import React from 'react';
import { View, Text, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
interface NotificationToggleProps {
  icon?: string;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Greys the row out and blocks the switch — for a setting the device itself rules out. */
  disabled?: boolean;
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
  disabled = false,
  isDarkMode,
  textColor,
  subtextColor,
}: NotificationToggleProps) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-4 ${disabled ? 'opacity-50' : ''}`}>
      <View className="flex-1 flex-row items-center">
        {icon && (
          <Ionicons name={icon as any} size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
        )}
        <View className={`${icon ? 'ml-3' : ''} flex-1`}>
          <Text className={`text-base font-semibold ${textColor}`}>{title}</Text>
          <Text className={`text-sm ${subtextColor} mt-0.5`}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        // Named after the row it belongs to. A Switch's only accessible name is its value, so a
        // screen full of these announced as "switch, on" repeated down the page.
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: BRAND_GREEN }}
        thumbColor="white"
        ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
      />
    </View>
  );
}
