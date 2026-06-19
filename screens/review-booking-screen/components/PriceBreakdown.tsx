import React from 'react';
import { View, Text } from 'react-native';

interface AddonLine {
  name: string;
  price: number;
}

interface PriceBreakdownProps {
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  serviceTotal: number;
  addons: AddonLine[];
  total: number;
}

export default function PriceBreakdown({
  isDarkMode,
  textColor,
  subtextColor,
  borderColor,
  serviceTotal,
  addons,
  total,
}: PriceBreakdownProps) {
  return (
    <View className={`px-6 py-5 border-t ${borderColor}`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>Price Breakdown</Text>
      <View className="flex-row justify-between mb-3">
        <Text className={`text-sm ${subtextColor}`}>Service</Text>
        <Text className={`text-sm ${textColor}`}>${serviceTotal}</Text>
      </View>
      {addons.map((addon) => (
        <View key={addon.name} className="flex-row justify-between mb-3">
          <Text className={`text-sm ${subtextColor}`}>{addon.name}</Text>
          <Text className={`text-sm ${textColor}`}>${addon.price}</Text>
        </View>
      ))}
      <View className={`border-t ${borderColor} mt-3 pt-3 flex-row justify-between`}>
        <Text className={`text-base font-bold ${textColor}`}>Total</Text>
        <Text className="text-2xl font-bold text-brand-600">${total}</Text>
      </View>
    </View>
  );
}
