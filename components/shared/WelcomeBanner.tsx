import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';

type WelcomeBannerProps = {
  /** "Hi, Ana" — the greeting line. */
  title: string;
  /** Supporting line under it. */
  subtitle?: string;
  /** Where the location-sensitive rails are ranked from. Omitted when there is none to show. */
  locationLabel?: string | null;
  /** Show a spinner in place of the location while it resolves. */
  locationLoading?: boolean;
};

/**
 * The Home welcome card: a greeting, the tagline, and the location the "Near You" rail is ranked
 * against.
 *
 * It is a **card rather than loose text** so it reads as one deliberate block instead of three
 * headings floating above the content — which is how it looked when the greeting was the page
 * title, the tagline the page subtitle, and the location a stray row beneath them.
 *
 * Pair it with `useShowOnce` so it greets you when you open the app and gets out of the way after
 * that; see `HomeScreen`.
 */
export default function WelcomeBanner({
  title,
  subtitle,
  locationLabel,
  locationLoading = false,
}: WelcomeBannerProps) {
  const { isDarkMode, cardBg, borderColor, textColor, subtextColor } = useThemeColors();

  const showLocation = locationLoading || !!locationLabel;

  return (
    <View className={`${cardBg} mb-6 rounded-2xl border p-5 ${borderColor}`}>
      <View className="flex-row items-center">
        <View
          className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${
            isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'
          }`}>
          <Ionicons name="paw" size={20} color={BRAND_GREEN} />
        </View>
        <View className="flex-1">
          <Text className={`text-xl font-bold ${textColor}`} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text className={`mt-0.5 text-sm ${subtextColor}`} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {showLocation && (
        <View className="mt-3 flex-row items-center">
          <Ionicons name="location-outline" size={15} color={BRAND_GREEN} />
          {locationLoading ? (
            <ActivityIndicator size="small" color={BRAND_GREEN} style={{ marginLeft: 8 }} />
          ) : (
            <Text className={`ml-2 text-sm ${subtextColor}`} numberOfLines={1}>
              {locationLabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
