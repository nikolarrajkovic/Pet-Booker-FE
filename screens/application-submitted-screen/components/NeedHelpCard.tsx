import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NeedHelpCardProps {
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  borderColor: string;
}

export default function NeedHelpCard({ isDarkMode, cardBg, textColor, borderColor }: NeedHelpCardProps) {
  return (
    <View className={`${cardBg} rounded-2xl p-5 border ${borderColor} mb-6`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>Need Help?</Text>
      <TouchableOpacity className="flex-row items-center mb-3">
        <View className={`w-10 h-10 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full items-center justify-center mr-3`}>
          <Ionicons name="mail-outline" size={20} color="#00C870" />
        </View>
        <Text className="text-brand-600 text-sm">partners@pawcare.com</Text>
      </TouchableOpacity>
      <TouchableOpacity className="flex-row items-center">
        <View className={`w-10 h-10 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full items-center justify-center mr-3`}>
          <Ionicons name="call-outline" size={20} color="#00C870" />
        </View>
        <Text className="text-brand-600 text-sm">(555) 123-4567</Text>
      </TouchableOpacity>
    </View>
  );
}
