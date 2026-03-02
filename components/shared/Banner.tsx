import React from 'react';
import { Text, View } from 'react-native';

type BannerSize = 'small' | 'medium' | 'large';
type BannerColor = 'emerald' | 'pink' | 'red' | 'yellow' | string;

type Props = {
  title: string;
  description: string;
  image: string | React.ReactNode;
  color?: BannerColor;
  size?: BannerSize;
  isDarkMode?: boolean;
};

const colorMap: Record<BannerColor, string> = {
  emerald: 'bg-emerald-50',
  pink: 'bg-pink-50',
  red: 'bg-red-50',
  yellow: 'bg-yellow-50',
};

const sizeMap: Record<BannerSize, { container: string; imageSize: string; titleSize: string }> = {
  small: {
    container: 'min-w-[40%]',
    imageSize: 'text-2xl',
    titleSize: 'text-xs',
  },
  medium: {
    container: 'min-w-[45%]',
    imageSize: 'text-3xl',
    titleSize: 'text-sm',
  },
  large: {
    container: 'min-w-[90%]',
    imageSize: 'text-4xl',
    titleSize: 'text-base',
  },
};

export default function Banner({
  title,
  description,
  image,
  color = 'emerald',
  size = 'medium',
  isDarkMode = false,
}: Props) {
  const sizeConfig = sizeMap[size];
  const bgColor = isDarkMode ? 'bg-[#1a2332]' : (typeof color === 'string' && colorMap[color] ? colorMap[color] : color);
  const textColor = isDarkMode ? 'text-white' : 'text-gray-800';
  const descriptionColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <View className={`flex-1 ${sizeConfig.container} ${bgColor} rounded-2xl p-4 items-center`}>
      {typeof image === 'string' ? (
        <Text className={`${sizeConfig.imageSize} mb-2`}>{image}</Text>
      ) : (
        <View className="mb-2">{image}</View>
      )}
      <Text className={`${sizeConfig.titleSize} font-semibold ${textColor}`}>{title}</Text>
      <Text className={`text-xs ${descriptionColor} text-center mt-1`}>{description}</Text>
    </View>
  );
}
