import React from 'react';
import { View, Text } from 'react-native';

interface TestimonialCardProps {
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}

export default function TestimonialCard({ isDarkMode, cardBg, textColor, subtextColor, borderColor }: TestimonialCardProps) {
  return (
    <View className={`${cardBg} rounded-2xl p-6 border ${borderColor} mb-6`}>
      <View className="flex-row items-center mb-4">
        <View className="w-12 h-12 bg-brand-500 rounded-full items-center justify-center mr-3">
          <Text className="text-white text-lg font-bold">SJ</Text>
        </View>
        <View>
          <Text className={`text-base font-semibold ${textColor}`}>Sarah Johnson</Text>
          <Text className={`text-sm ${subtextColor}`}>Dog Walker, San Francisco</Text>
        </View>
      </View>
      <Text className={`text-sm ${isDarkMode ? 'text-green-200' : 'text-green-900'} italic leading-6`}>
        "PawCare helped me turn my passion for animals into a thriving business. I now have a steady stream of clients and earn more than my previous job."
      </Text>
    </View>
  );
}
