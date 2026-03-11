import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

const petTypes = [
  { id: 'dog', emoji: '🐕', label: 'Dog' },
  { id: 'cat', emoji: '🐈', label: 'Cat' },
  { id: 'parrot', emoji: '🦜', label: 'Parrot' },
  { id: 'turtle', emoji: '🐢', label: 'Turtle' },
  { id: 'fish', emoji: '🐠', label: 'Fish' },
  { id: 'snake', emoji: '🐍', label: 'Snake' },
];

interface PetTypeSelectorProps {
  selectedType: string;
  onSelectType: (type: string) => void;
  isDarkMode: boolean;
  textColor: string;
  inputBg: string;
}

export default function PetTypeSelector({
  selectedType,
  onSelectType,
  isDarkMode,
  textColor,
  inputBg,
}: PetTypeSelectorProps) {
  return (
    <View className="mb-6">
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>
        Type <Text className="text-red-500">*</Text>
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {petTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            onPress={() => onSelectType(type.id)}
            className={`items-center justify-center px-4 py-3 rounded-xl border-2 ${
              selectedType === type.id
                ? 'bg-brand-500 border-brand-500'
                : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
            }`}
            style={{ width: '30%' }}
          >
            <Text style={{ fontSize: 32, marginBottom: 4 }}>{type.emoji}</Text>
            <Text className={`text-xs font-medium ${selectedType === type.id ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
