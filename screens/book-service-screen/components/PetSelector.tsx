import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import { usePageGutter } from '../../../hooks/usePageGutter';

interface Pet {
  id: number;
  name: string;
  breed: string;
  image: string;
  /** False when the service doesn't take this pet's species — shown, but not selectable. */
  accepted?: boolean;
}

interface PetSelectorProps {
  selectedPet: number | null;
  onSelectPet: (petId: number) => void;
  pets: Pet[];
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  cardBg: string;
  borderColor: string;
}

export default function PetSelector({
  selectedPet,
  onSelectPet,
  pets,
  isDarkMode,
  textColor,
  subtextColor,
  cardBg,
  borderColor,
}: PetSelectorProps) {
  const gutter = usePageGutter();
  const { t } = useLocale();
  return (
    <View className={`border-t ${gutter.px} py-5 ${borderColor}`}>
      <View className="mb-4 flex-row items-center">
        <View
          className={`h-6 w-6 items-center justify-center rounded-full ${selectedPet ? 'bg-brand-500' : 'bg-gray-300'}`}>
          {selectedPet ? (
            <Ionicons name="checkmark" size={16} color="white" />
          ) : (
            <Text className="text-xs font-bold text-white">4</Text>
          )}
        </View>
        <Text className={`text-base font-semibold ${textColor} ml-3`}>
          {t('bookService.selectPet')}
        </Text>
        <Text className={`text-sm ${subtextColor} ml-2`}>{t('bookService.selectPetHint')}</Text>
      </View>

      {pets.every((pet) => pet.accepted === false) ? (
        <Text className={`mb-3 text-sm ${subtextColor}`}>{t('bookService.noPetsAccepted')}</Text>
      ) : null}

      <View className="flex-row gap-3">
        {pets.map((pet) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{
              disabled: pet.accepted === false,
              selected: selectedPet === pet.id,
            }}
            // react-native-web reads aria-*, not accessibilityState.
            aria-disabled={pet.accepted === false}
            aria-selected={selectedPet === pet.id}
            key={pet.id}
            disabled={pet.accepted === false}
            onPress={() => onSelectPet(pet.id)}
            style={pet.accepted === false ? { opacity: 0.5 } : undefined}
            className={`flex-1 rounded-2xl border-2 p-4 ${
              selectedPet === pet.id
                ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                : `${borderColor} ${cardBg}`
            }`}>
            {pet.image ? (
              <Image
                source={{ uri: pet.image }}
                className="mb-3 h-32 w-full rounded-xl"
                resizeMode="cover"
              />
            ) : (
              <View
                className={`mb-3 h-32 w-full rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
                <Ionicons name="image-outline" size={40} color="#9CA3AF" />
              </View>
            )}
            <Text className={`text-base font-semibold ${textColor}`}>{pet.name}</Text>
            <Text className={`text-sm ${subtextColor}`}>{pet.breed}</Text>
            {pet.accepted === false ? (
              <Text className={`mt-1 text-xs ${subtextColor}`}>
                {t('bookService.petNotAccepted')}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
