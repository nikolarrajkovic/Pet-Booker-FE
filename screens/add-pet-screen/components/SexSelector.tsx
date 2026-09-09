import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import { useResponsive } from '../../../hooks/useResponsive';

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
  const { isWebLayout } = useResponsive();
  return (
    <View className="mb-6">
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>
        {t('addPet.sex')} <Text className="text-red-500">*</Text>
      </Text>
      {/* Web only: the chips size to their labels, so the row must not stretch. On the phone
          the tiles are flex-1 and the row has to stay full width for them to fill it. */}
      <View
        className="flex-row"
        style={{ gap: 12, alignSelf: isWebLayout ? 'flex-start' : undefined }}>
        {sexOptions.map((option) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={option.value}
            onPress={() => onSelectSex(option.value)}
            // Half the form width each is a phone's thumb target. On the web they are chips,
            // sized to their label and sitting on one line — see PetTypeSelector.
            className={`justify-center rounded-xl border-2 ${
              isWebLayout ? 'flex-row items-center px-4 py-2' : 'flex-1 items-center py-4'
            } ${
              selectedSex === option.value
                ? 'border-brand-500 bg-brand-500'
                : error
                  ? `${inputBg} border-red-500`
                  : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
            }`}>
            <Ionicons
              name={option.icon}
              size={isWebLayout ? 18 : 32}
              color={selectedSex === option.value ? 'white' : option.color}
            />
            <Text
              className={`text-xs font-medium ${isWebLayout ? 'ml-2' : 'mt-1'} ${selectedSex === option.value ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {tEnum('sex', option.value, option.label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
