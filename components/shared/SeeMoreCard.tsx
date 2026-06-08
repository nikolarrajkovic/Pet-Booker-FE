import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';

type SeeMoreCardProps = {
  onPress: () => void;
};

export default function SeeMoreCard({ onPress }: SeeMoreCardProps) {
  const { cardBg, textColor, borderColor } = useThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`${cardBg} rounded-2xl border ${borderColor} items-center justify-center`}
      style={{ width: 200, height: 195 }}
    >
      <Ionicons name="arrow-forward-circle" size={48} color="#00A85A" />
      <Text className={`${textColor} font-semibold mt-3 text-base`}>See More</Text>
    </TouchableOpacity>
  );
}
