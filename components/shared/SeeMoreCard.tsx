import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

type SeeMoreCardProps = {
  onPress: () => void;
  /**
   * Which row this ends, e.g. "Special Deals". Several of these appear on one screen, and "See
   * more" repeated verbatim tells a screen-reader user nothing about which list they'd be opening.
   */
  accessibilityLabel?: string;
};

export default function SeeMoreCard({ onPress, accessibilityLabel }: SeeMoreCardProps) {
  const { cardBg, textColor, borderColor } = useThemeColors();
  const { t } = useLocale();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('common.seeMore')}
      accessible
      className={`${cardBg} rounded-2xl border ${borderColor} items-center justify-center`}
      style={{ width: 200, height: 195 }}>
      <Ionicons name="arrow-forward-circle" size={48} color="#00A85A" />
      <Text className={`${textColor} mt-3 text-base font-semibold`}>{t('common.seeMore')}</Text>
    </TouchableOpacity>
  );
}
