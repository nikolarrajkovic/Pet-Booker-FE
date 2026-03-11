import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

type Props = {
  text: string;
  icon: React.ReactNode;
  onPress: () => void;
  isDarkMode: boolean;
};

export default function SocialButton({ text, icon, onPress, isDarkMode }: Props) {
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-700';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center justify-center py-4 rounded-xl border ${borderColor} ${bgColor}`}
    >
      <View className="mr-3">{icon}</View>
      <Text className={`font-semibold ${textColor}`}>{text}</Text>
    </TouchableOpacity>
  );
}
