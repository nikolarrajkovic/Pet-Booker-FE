import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { themeColors } from '../../../hooks/useThemeColors';

type Props = {
  text: string;
  icon: React.ReactNode;
  onPress: () => void;
  isDarkMode: boolean;
};

export default function SocialButton({ text, icon, onPress, isDarkMode }: Props) {
  const { textColor, cardBg: bgColor, borderColor } = themeColors(isDarkMode);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center justify-center rounded-xl border py-4 ${borderColor} ${bgColor}`}>
      <View className="mr-3">{icon}</View>
      <Text className={`font-semibold ${textColor}`}>{text}</Text>
    </TouchableOpacity>
  );
}
