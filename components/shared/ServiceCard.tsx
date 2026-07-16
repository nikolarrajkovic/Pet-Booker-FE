import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

type ServiceCardProps = {
  image: string;
  name: string;
  service: string;
  rating: number;
  reviews: number;
  distance?: string;
  price: number;
  badge?: 'popular' | 'deal';
  /** Formatted discount (e.g. "3% OFF" / "$5 OFF") — shown on the deal badge. */
  dealAmount?: string;
  onPress: () => void;
};

export default function ServiceCard({
  image,
  name,
  service,
  rating,
  reviews,
  distance,
  price,
  badge,
  dealAmount,
  onPress,
}: ServiceCardProps) {
  const { cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`${cardBg} overflow-hidden rounded-2xl border ${borderColor}`}
      style={{ width: 200 }}>
      <View className="relative">
        <Image source={{ uri: image }} className="h-32 w-full" resizeMode="cover" />

        {/* Distance Badge */}
        {distance && (
          <View className="absolute left-2 top-2 flex-row items-center rounded-full bg-blue-500 px-3 py-1">
            <Ionicons name="location" size={12} color="white" />
            <Text className="ml-1 text-xs font-semibold text-white">{distance}</Text>
          </View>
        )}

        {/* Price Badge */}
        {price > 0 && (
          <View className="absolute right-2 top-2 rounded-full bg-brand-500 px-3 py-1">
            <Text className="text-xs font-bold text-white">${price}+</Text>
          </View>
        )}

        {/* Popular Badge */}
        {badge === 'popular' && (
          <View className="absolute left-2 top-2 flex-row items-center rounded-full bg-amber-500 px-3 py-1">
            <Ionicons name="flame" size={12} color="white" />
            <Text className="ml-1 text-xs font-semibold text-white">{t('card.popular')}</Text>
          </View>
        )}

        {/* Deal Badge — shows the discount amount when known, else just "Deal" */}
        {badge === 'deal' && (
          <View className="absolute left-2 top-2 flex-row items-center rounded-full bg-red-500 px-3 py-1">
            <Ionicons name="pricetag" size={12} color="white" />
            <Text className="ml-1 text-xs font-semibold text-white">
              {dealAmount ?? t('card.deal')}
            </Text>
          </View>
        )}
      </View>

      <View className="p-3">
        <Text className={`font-semibold ${textColor} mb-1`} numberOfLines={1}>
          {name}
        </Text>
        <Text className={`text-xs ${subtextColor} mb-2`}>{service}</Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text className={`text-xs font-semibold ${textColor} ml-1`}>{rating.toFixed(1)}</Text>
            <Text className={`text-xs ${subtextColor} ml-1`}>({reviews})</Text>
          </View>
          {distance && <Text className={`text-xs ${subtextColor}`}>{distance}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}
