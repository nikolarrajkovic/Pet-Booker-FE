import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SexSelectorProps {
  selectedSex: string;
  onSelectSex: (sex: string) => void;
  isDarkMode: boolean;
  textColor: string;
  inputBg: string;
}

export default function SexSelector({
  selectedSex,
  onSelectSex,
  isDarkMode,
  textColor,
  inputBg,
}: SexSelectorProps) {
  return (
    <View className="mb-6">
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>Sex</Text>
      <View className="flex-row" style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={() => onSelectSex('male')}
          className={`flex-1 items-center justify-center py-4 rounded-xl border-2 ${
            selectedSex === 'male' ? 'bg-brand-500 border-brand-500' : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
          }`}
        >
          <Ionicons name="male" size={32} color={selectedSex === 'male' ? 'white' : '#3B82F6'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onSelectSex('female')}
          className={`flex-1 items-center justify-center py-4 rounded-xl border-2 ${
            selectedSex === 'female' ? 'bg-brand-500 border-brand-500' : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
          }`}
        >
          <Ionicons name="female" size={32} color={selectedSex === 'female' ? 'white' : '#EC4899'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
