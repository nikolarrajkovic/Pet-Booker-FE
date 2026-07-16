import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PetResponse } from '../../../services/pets';
import { resolveImageUrl } from '../../../services/service-providers';
import { useLocale } from '../../../context/LocaleContext';

type Props = {
  pet: PetResponse;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
};

function petPhoto(pet: PetResponse): string {
  const list = pet.photos ?? [];
  const selected = list.find((p) => p.isSelected) ?? list[0];
  return resolveImageUrl(selected?.src ?? pet.photoUrl);
}

/**
 * Full pet briefing for the Live Session — gives the provider everything they
 * need about the animal (species/sex/age, breed, size, dietary/care notes). The
 * booking's embedded pet is shallow, so the container fetches the full pet first.
 */
export default function PetDetailsCard({
  pet,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
}: Props) {
  const { t, tEnum } = useLocale();
  const image = petPhoto(pet);
  const species = tEnum('petSpeciesType', pet.type);
  const sex = tEnum('sex', pet.sex);
  // Chips summarising the at-a-glance attributes.
  const chips = [
    species,
    sex,
    pet.ageYears
      ? pet.ageYears === 1
        ? t('liveSession.yearOne', { n: pet.ageYears })
        : t('liveSession.yearsMany', { n: pet.ageYears })
      : '',
  ].filter(Boolean);

  // Quick-stat rows (label/value) — only rendered when a value exists.
  const stats: { label: string; value: string }[] = [];
  if (pet.breed) stats.push({ label: t('liveSession.breed'), value: pet.breed });
  if (pet.weightKg) stats.push({ label: t('liveSession.weight'), value: `${pet.weightKg} kg` });
  if (pet.heightCm) stats.push({ label: t('liveSession.height'), value: `${pet.heightCm} cm` });

  // Free-text care notes.
  const notes: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [];
  if (pet.dietaryNotes)
    notes.push({
      icon: 'nutrition-outline',
      label: t('liveSession.dietaryNotes'),
      value: pet.dietaryNotes,
    });
  if (pet.favoriteFood)
    notes.push({
      icon: 'fast-food-outline',
      label: t('liveSession.favoriteFood'),
      value: pet.favoriteFood,
    });
  if (pet.additionalNotes)
    notes.push({
      icon: 'document-text-outline',
      label: t('liveSession.additionalNotes'),
      value: pet.additionalNotes,
    });

  return (
    <View className={`${cardBg} rounded-2xl border ${borderColor} p-4`}>
      <View className="flex-row items-center">
        {image ? (
          <Image
            source={{ uri: image }}
            className="mr-3 h-16 w-16 rounded-2xl"
            resizeMode="cover"
          />
        ) : (
          <View
            className={`mr-3 h-16 w-16 items-center justify-center rounded-2xl ${
              isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
            }`}>
            <Ionicons name="paw" size={26} color="#9CA3AF" />
          </View>
        )}
        <View className="flex-1">
          <Text className={`text-lg font-bold ${textColor}`}>
            {pet.name || t('liveSession.pet')}
          </Text>
          {chips.length ? (
            <Text className={`text-sm ${subtextColor} mt-0.5`}>{chips.join(' · ')}</Text>
          ) : null}
        </View>
      </View>

      {stats.length ? (
        <View className={`mt-4 flex-row flex-wrap border-t pt-4 ${borderColor}`}>
          {stats.map((s) => (
            <View key={s.label} className="mb-2 w-1/2">
              <Text className={`text-xs ${subtextColor}`}>{s.label}</Text>
              <Text className={`text-sm font-semibold ${textColor} mt-0.5`}>{s.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {pet.hasSpecialNeeds ? (
        <View
          className={`mt-3 flex-row items-center rounded-xl px-3 py-2 ${
            isDarkMode ? 'bg-[#3a2a1a]' : 'bg-orange-50'
          }`}>
          <Ionicons name="medkit-outline" size={16} color="#F59E0B" />
          <Text className="ml-2 text-xs font-semibold" style={{ color: '#D97706' }}>
            {t('liveSession.specialNeedsWarning')}
          </Text>
        </View>
      ) : null}

      {notes.length ? (
        <View className={`mt-4 border-t pt-4 ${borderColor}`}>
          {notes.map((n, i) => (
            <View key={n.label} className={`flex-row items-start ${i > 0 ? 'mt-3' : ''}`}>
              <Ionicons
                name={n.icon}
                size={16}
                color="#00C870"
                style={{ marginTop: 2, marginRight: 8 }}
              />
              <View className="flex-1">
                <Text className={`text-xs ${subtextColor}`}>{n.label}</Text>
                <Text className={`text-sm ${textColor} mt-0.5 leading-5`}>{n.value}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
