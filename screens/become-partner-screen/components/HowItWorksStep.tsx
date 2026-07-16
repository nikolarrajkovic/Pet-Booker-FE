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
    <View className="mb-4 flex-row">
      <View className="mr-4 items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500">
          <Text className="text-base font-bold text-white">{step}</Text>
        </View>
        {!isLast && <View className="mt-2 w-0.5 flex-1 bg-brand-200" style={{ height: 40 }} />}
      </View>
      <View className="flex-1">
        <Text className={`text-base font-semibold ${textColor} mb-1`}>{title}</Text>
        <Text className={`text-sm ${subtextColor}`}>{description}</Text>
      </View>
    </View>
  );
}
