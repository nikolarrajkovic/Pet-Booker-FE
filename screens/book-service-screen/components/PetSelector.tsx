import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { useResponsive } from '../../../hooks/useResponsive';

interface Pet {
  id: number;
  name: string;
  breed: string;
  image: string;
  /** False when the service doesn't take this pet's species — shown, but not selectable. */
  accepted?: boolean;
}

interface PetSelectorProps {
  /** Several pets may be picked: each becomes its own booking at the same time. */
  selectedPets: number[];
  onTogglePet: (petId: number) => void;
  pets: Pet[];
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  cardBg: string;
  borderColor: string;
}

export default function PetSelector({
  selectedPets,
  onTogglePet,
  pets,
  isDarkMode,
  textColor,
  subtextColor,
  cardBg,
  borderColor,
}: PetSelectorProps) {
  const gutter = usePageGutter();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  const anySelected = selectedPets.length > 0;
  return (
    <View className={`border-t ${gutter.px} py-5 ${borderColor}`}>
      <View className="mb-4 flex-row items-center">
        <View
          className={`h-6 w-6 items-center justify-center rounded-full ${anySelected ? 'bg-brand-500' : 'bg-gray-300'}`}>
          {anySelected ? (
            <Ionicons name="checkmark" size={16} color="white" />
          ) : (
            <Text className="text-xs font-bold text-white">4</Text>
          )}
        </View>
        <Text className={`text-base font-semibold ${textColor} ml-3`}>
          {t('bookService.selectPet')}
        </Text>
      </View>
      {/* Its own line: "one or more — each pet gets its own booking" no longer fits beside it. */}
      <Text className={`-mt-2 mb-4 text-sm ${subtextColor}`}>{t('bookService.selectPetHint')}</Text>

      {pets.every((pet) => pet.accepted === false) ? (
        <Text className={`mb-3 text-sm ${subtextColor}`}>{t('bookService.noPetsAccepted')}</Text>
      ) : null}

      {/* A wrapping grid: two per row on a phone, three on the web design. One flex row of equal
          columns squeezed four pets into strips ~80px wide, and every further pet narrowed them
          again. */}
      <View className="flex-row flex-wrap gap-3">
        {pets.map((pet) => {
          const selected = selectedPets.includes(pet.id);
          return (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{
                disabled: pet.accepted === false,
                checked: selected,
              }}
              // react-native-web reads aria-*, not accessibilityState.
              aria-disabled={pet.accepted === false}
              aria-checked={selected}
              key={pet.id}
              disabled={pet.accepted === false}
              onPress={() => onTogglePet(pet.id)}
              style={[
                { flexBasis: isWebLayout ? '31%' : '47%', flexGrow: pets.length === 1 ? 1 : 0 },
                pet.accepted === false ? { opacity: 0.5 } : null,
              ]}
              className={`rounded-2xl border-2 p-4 ${
                selected
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
              <View className="flex-row items-center justify-between">
                <Text className={`flex-1 text-base font-semibold ${textColor}`} numberOfLines={1}>
                  {pet.name}
                </Text>
                {pet.accepted !== false ? (
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={selected ? '#22C55E' : isDarkMode ? '#4B5563' : '#D1D5DB'}
                  />
                ) : null}
              </View>
              <Text className={`text-sm ${subtextColor}`}>{pet.breed}</Text>
              {pet.accepted === false ? (
                <Text className={`mt-1 text-xs ${subtextColor}`}>
                  {t('bookService.petNotAccepted')}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
