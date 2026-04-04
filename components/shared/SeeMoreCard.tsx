import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

type SeeMoreCardProps = {
  onPress: () => void;
};

export default function SeeMoreCard({ onPress }: SeeMoreCardProps) {
  const { isDarkMode } = useTheme();

  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

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
