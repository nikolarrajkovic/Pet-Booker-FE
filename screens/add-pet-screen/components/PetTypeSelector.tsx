import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { PetSpecies } from '../../../services/pets';
import { useLocale } from '../../../context/LocaleContext';

// Values are PetSpeciesType FLAGS (1,2,4,8,16,32) — not sequential ints
const petTypes = [
  { value: PetSpecies.Dog, emoji: '🐕', label: 'Dog' },
  { value: PetSpecies.Cat, emoji: '🐈', label: 'Cat' },
  { value: PetSpecies.Parrot, emoji: '🦜', label: 'Parrot' },
  { value: PetSpecies.Turtle, emoji: '🐢', label: 'Turtle' },
  { value: PetSpecies.Fish, emoji: '🐠', label: 'Fish' },
  { value: PetSpecies.Snake, emoji: '🐍', label: 'Snake' },
];

interface PetTypeSelectorProps {
  selectedType: number | null;
  onSelectType: (type: number) => void;
  isDarkMode: boolean;
  textColor: string;
  inputBg: string;
  error?: string;
}

export default function PetTypeSelector({
  selectedType,
  onSelectType,
  isDarkMode,
  textColor,
  inputBg,
  error,
}: PetTypeSelectorProps) {
  const { t, tEnum } = useLocale();
  return (
    <View className="mb-6">
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>
        {t('addPet.type')} <Text className="text-red-500">*</Text>
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {petTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            onPress={() => onSelectType(type.value)}
            className={`items-center justify-center rounded-xl border-2 px-4 py-3 ${
              selectedType === type.value
                ? 'border-brand-500 bg-brand-500'
                : error
                  ? `${inputBg} border-red-500`
                  : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
            }`}
            style={{ width: '30%' }}>
            <Text style={{ fontSize: 32, marginBottom: 4 }}>{type.emoji}</Text>
            <Text
              className={`text-xs font-medium ${selectedType === type.value ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {tEnum('petSpeciesType', type.value, type.label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
