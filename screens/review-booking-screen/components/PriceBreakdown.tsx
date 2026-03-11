import React from 'react';
import { View, Text } from 'react-native';

interface PriceBreakdownProps {
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  serviceTotal: number;
  addonsTotal: number;
  total: number;
}

export default function PriceBreakdown({
  isDarkMode,
  textColor,
  subtextColor,
  borderColor,
  serviceTotal,
  addonsTotal,
  total,
}: PriceBreakdownProps) {
  return (
    <View className={`px-6 py-5 border-t ${borderColor}`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>Price Breakdown</Text>
      <View className="flex-row justify-between mb-3">
        <Text className={`text-sm ${subtextColor}`}>Service</Text>
        <Text className={`text-sm ${textColor}`}>${serviceTotal}</Text>
      </View>
      {addonsTotal > 0 && (
        <View className="flex-row justify-between mb-3">
          <Text className={`text-sm ${subtextColor}`}>Pickup Fee</Text>
          <Text className={`text-sm ${textColor}`}>${addonsTotal}</Text>
        </View>
      )}
      <View className={`border-t ${borderColor} mt-3 pt-3 flex-row justify-between`}>
        <Text className={`text-base font-bold ${textColor}`}>Total</Text>
        <Text className="text-2xl font-bold text-brand-600">${total}</Text>
      </View>
    </View>
  );
}
