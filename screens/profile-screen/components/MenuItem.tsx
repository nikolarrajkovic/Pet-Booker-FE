import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface MenuItemProps {
  icon: string;
  iconType: string;
  title: string;
  subtitle: string;
  color: string;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  badge?: number;
  onPress: () => void;
}

export default function MenuItem({
  icon,
  iconType,
  title,
  subtitle,
  color,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  badge,
  onPress,
}: MenuItemProps) {
  return (
    <TouchableOpacity
      className={`flex-row items-center ${cardBg} mb-3 rounded-2xl border p-4 ${borderColor}`}
      activeOpacity={0.7}
      onPress={onPress}>
      <View
        className={`h-12 w-12 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} mr-4 items-center justify-center rounded-xl`}>
        {iconType === 'ionicons' ? (
          <Ionicons name={icon as any} size={24} color={color} />
        ) : (
          <MaterialCommunityIcons name={icon as any} size={24} color={color} />
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-base font-semibold ${textColor}`}>{title}</Text>
        <Text className={`text-sm ${subtextColor} mt-0.5`}>{subtitle}</Text>
      </View>
      {badge !== undefined && badge > 0 && (
        <View className="mr-2 h-6 w-6 items-center justify-center rounded-full bg-red-500">
          <Text className="text-xs font-bold text-white">{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}
