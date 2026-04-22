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
      className={`flex-row items-center ${cardBg} rounded-2xl p-4 mb-3 border ${borderColor}`}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View className={`w-12 h-12 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} rounded-xl items-center justify-center mr-4`}>
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
        <View className="w-6 h-6 rounded-full bg-red-500 items-center justify-center mr-2">
          <Text className="text-white text-xs font-bold">{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}
