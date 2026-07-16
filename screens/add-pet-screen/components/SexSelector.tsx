import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

// Backend Sex enum: 1=Male, 2=Female (0 is not a valid value per the API spec)
const sexOptions = [
  { value: 1, icon: 'male' as const, label: 'Male', color: '#3B82F6' },
  { value: 2, icon: 'female' as const, label: 'Female', color: '#EC4899' },
];

interface SexSelectorProps {
  selectedSex: number | null;
  onSelectSex: (sex: number) => void;
  isDarkMode: boolean;
  textColor: string;
  inputBg: string;
  error?: string;
}

export default function SexSelector({
  selectedSex,
  onSelectSex,
  isDarkMode,
  textColor,
  inputBg,
  error,
}: SexSelectorProps) {
  const { t, tEnum } = useLocale();
  return (
    <View className="mb-6">
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>
        {t('addPet.sex')} <Text className="text-red-500">*</Text>
      </Text>
      <View className="flex-row" style={{ gap: 12 }}>
        {sexOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            onPress={() => onSelectSex(option.value)}
            className={`flex-1 items-center justify-center rounded-xl border-2 py-4 ${
              selectedSex === option.value
                ? 'border-brand-500 bg-brand-500'
                : error
                  ? `${inputBg} border-red-500`
                  : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
            }`}>
            <Ionicons
              name={option.icon}
              size={32}
              color={selectedSex === option.value ? 'white' : option.color}
            />
            <Text
              className={`mt-1 text-xs font-medium ${selectedSex === option.value ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {tEnum('sex', option.value, option.label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
