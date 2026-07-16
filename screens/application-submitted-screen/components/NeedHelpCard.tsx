import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NeedHelpCardProps {
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  borderColor: string;
}

export default function NeedHelpCard({
  isDarkMode,
  cardBg,
  textColor,
  borderColor,
}: NeedHelpCardProps) {
  return (
    <View className={`${cardBg} rounded-2xl border p-5 ${borderColor} mb-6`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>Need Help?</Text>
      <TouchableOpacity className="mb-3 flex-row items-center">
        <View
          className={`h-10 w-10 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} mr-3 items-center justify-center rounded-full`}>
          <Ionicons name="mail-outline" size={20} color="#00C870" />
        </View>
        <Text className="text-sm text-brand-600">partners@pawcare.com</Text>
      </TouchableOpacity>
      <TouchableOpacity className="flex-row items-center">
        <View
          className={`h-10 w-10 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} mr-3 items-center justify-center rounded-full`}>
          <Ionicons name="call-outline" size={20} color="#00C870" />
        </View>
        <Text className="text-sm text-brand-600">(555) 123-4567</Text>
      </TouchableOpacity>
    </View>
  );
}
