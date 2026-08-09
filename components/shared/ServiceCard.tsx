import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { formatMoney } from '../../services/currency';

type ServiceCardProps = {
  image: string;
  name: string;
  service: string;
  rating: number;
  reviews: number;
  distance?: string;
  price: number;
  /**
   * Currency the `price` is in, from the DTO that carried it (`ServiceDto.currency`).
   * Omit to fall back to the user's display preference.
   */
  currency?: string | null;
  badge?: 'popular' | 'deal';
  /** Formatted discount (e.g. "3% OFF" / "5 € OFF") — shown on the deal badge. */
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
  currency,
  badge,
  dealAmount,
  onPress,
}: ServiceCardProps) {
  const { cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();

  // A card is one control, but its content is a dozen scattered Texts and icons — read out
  // individually they arrive as "Boarding / Sitter / star / 4.5 / (12)", which is noise. Composing
  // one sentence here, and marking the subtree as a single element, makes the card announce the
  // same thing a sighted user takes from it at a glance.
  const label = [
    name,
    service,
    price > 0 ? t('card.a11yPriceFrom', { price: formatMoney(price, currency) }) : null,
    reviews > 0
      ? t('card.a11yRating', { rating: rating.toFixed(1), reviews })
      : t('card.a11yNoReviews'),
    badge === 'deal' ? (dealAmount ?? t('card.deal')) : null,
    badge === 'popular' ? t('card.popular') : null,
    distance,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessible
      className={`${cardBg} overflow-hidden rounded-2xl border ${borderColor}`}
      style={{ width: 200 }}>
      <View className="relative">
        {/* Decorative: the card's own label already names the service. */}
        <Image
          source={{ uri: image }}
          accessibilityRole="none"
          alt=""
          className="h-32 w-full"
          resizeMode="cover"
        />

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
            <Text className="text-xs font-bold text-white">{formatMoney(price, currency)}+</Text>
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
