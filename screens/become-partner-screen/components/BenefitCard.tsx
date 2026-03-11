import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BenefitCardProps {
  icon: string;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}

export default function BenefitCard({
  icon,
  title,
  description,
  color,
  bgColor,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
}: BenefitCardProps) {
  return (
    <View className={`${cardBg} rounded-2xl p-4 mb-3 border ${borderColor} flex-row items-center`}>
      <View className="w-12 h-12 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: isDarkMode ? '#243447' : bgColor }}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-semibold ${textColor}`}>{title}</Text>
        <Text className={`text-sm ${subtextColor} mt-1`}>{description}</Text>
      </View>
    </View>
  );
}
