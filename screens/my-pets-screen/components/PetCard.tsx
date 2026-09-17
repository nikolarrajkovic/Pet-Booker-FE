import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import ServicePhoto from '../../../components/shared/ServicePhoto';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
interface Pet {
  id: string;
  name: string;
  breed: string;
  sex: string;
  age: string;
  weight: string;
  height: string;
  image: string | null;
}

interface PetCardProps {
  pet: Pet;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export default function PetCard({
  pet,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  onEdit,
  onDelete,
  isDeleting = false,
}: PetCardProps) {
  const { t } = useLocale();
  return (
    <View className={`${cardBg} mb-4 rounded-2xl border p-4 ${borderColor} flex-row`}>
      {/* Placeholder layered BEHIND the photo, never swapped for it. The `pet.image ? …` form
          only covered a MISSING src; a src that exists and 404s (a cleaned-up upload, a stale
          URL, a brief offline moment) is still truthy, so the card drew a blank 80px square and
          pushed the pet's name off to the right of dead space. */}
      <ServicePhoto
        uri={pet.image}
        radiusClass="rounded-xl"
        iconSize={32}
        className="mr-4 h-20 w-20"
      />
      <View className="flex-1">
        <Text className={`text-lg font-bold ${textColor}`}>{pet.name}</Text>
        <Text className={`text-sm ${subtextColor} mt-1`}>
          {pet.breed} • {pet.sex}
        </Text>
        <View className="mt-2 flex-row flex-wrap">
          <Text className={`text-xs ${subtextColor} mr-4`}>
            {t('pets.age')}: {pet.age}
          </Text>
          <Text className={`text-xs ${subtextColor} mr-4`}>
            {t('pets.weight')}: {pet.weight}
          </Text>
          <Text className={`text-xs ${subtextColor}`}>
            {t('pets.height')}: {pet.height}
          </Text>
        </View>
      </View>
      <View className="justify-start">
        <TouchableOpacity accessibilityRole="button" onPress={onEdit} className="mb-3">
          <Ionicons name="pencil" size={20} color={BRAND_GREEN} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onDelete} disabled={isDeleting}>
          {isDeleting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
