import React from 'react';
import { View, Text } from 'react-native';

interface HowItWorksStepProps {
  step: string;
  title: string;
  description: string;
  isLast: boolean;
  textColor: string;
  subtextColor: string;
}

export default function HowItWorksStep({
  step,
  title,
  description,
  isLast,
  textColor,
  subtextColor,
}: HowItWorksStepProps) {
  return (
    <View className="flex-row mb-4">
      <View className="mr-4 items-center">
        <View className="w-10 h-10 bg-brand-500 rounded-full items-center justify-center">
          <Text className="text-white font-bold text-base">{step}</Text>
        </View>
        {!isLast && (
          <View className="flex-1 w-0.5 bg-brand-200 mt-2" style={{ height: 40 }} />
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-base font-semibold ${textColor} mb-1`}>{title}</Text>
        <Text className={`text-sm ${subtextColor}`}>{description}</Text>
      </View>
    </View>
  );
}
