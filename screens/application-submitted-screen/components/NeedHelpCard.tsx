import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { SUPPORT_EMAIL, SUPPORT_PHONE, emailSupport, callSupport } from '../../../services/support';

interface NeedHelpCardProps {
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  borderColor: string;
}

/**
 * How a new partner reaches support while their application is reviewed.
 *
 * Renders only the contacts that are configured (see `services/support.ts`), and nothing at all
 * when none is — this card used to show a placeholder email and a fictional (555) number.
 */
export default function NeedHelpCard({
  isDarkMode,
  cardBg,
  textColor,
  borderColor,
}: NeedHelpCardProps) {
  const { t } = useLocale();
  if (!SUPPORT_EMAIL && !SUPPORT_PHONE) return null;

  const iconDisc = `h-10 w-10 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} mr-3 items-center justify-center rounded-full`;

  return (
    <View className={`${cardBg} rounded-2xl border p-5 ${borderColor} mb-6`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>
        {t('applicationSubmitted.needHelp')}
      </Text>
      {SUPPORT_EMAIL && (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={emailSupport}
          className={`flex-row items-center ${SUPPORT_PHONE ? 'mb-3' : ''}`}>
          <View className={iconDisc}>
            <Ionicons name="mail-outline" size={20} color={BRAND_GREEN} />
          </View>
          <Text className="text-sm text-brand-600">{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      )}
      {SUPPORT_PHONE && (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={callSupport}
          className="flex-row items-center">
          <View className={iconDisc}>
            <Ionicons name="call-outline" size={20} color={BRAND_GREEN} />
          </View>
          <Text className="text-sm text-brand-600">{SUPPORT_PHONE}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
