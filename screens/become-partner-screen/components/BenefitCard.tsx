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
    <View className={`${cardBg} mb-3 rounded-2xl border p-4 ${borderColor} flex-row items-center`}>
      <View
        className="mr-4 h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: isDarkMode ? '#243447' : bgColor }}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-semibold ${textColor}`}>{title}</Text>
        <Text className={`text-sm ${subtextColor} mt-1`}>{description}</Text>
      </View>
    </View>
  );
}
