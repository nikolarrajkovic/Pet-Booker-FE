import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import type { CreateGroupRequestParams } from '../../screens/group-requests-screen/containers/CreateGroupRequestScreen';

type Props = {
  /** `bar` — a slim row above search results. `banner` — a card on Home. */
  variant?: 'bar' | 'banner';
  /** Handed to the form: the filters the user is browsing with, so "every matching provider"
   *  means the providers they are looking at. */
  params?: CreateGroupRequestParams;
};

/**
 * The way into "ask several providers": rather than booking one provider directly, send one
 * request to many and let the first who can take it. Shown wherever a user browses providers —
 * above the Search results (carrying the current filters) and on Home.
 */
export default function GroupRequestCta({ variant = 'bar', params }: Props) {
  const navigation = useNavigation<any>();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const open = () => navigation.navigate('CreateGroupRequest', params);

  if (variant === 'banner') {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('groupRequest.ctaTitle')}
        activeOpacity={0.85}
        onPress={open}
        className="flex-row items-center rounded-2xl bg-brand-500 p-4">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <Ionicons name="people" size={24} color="white" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-white">{t('groupRequest.ctaTitle')}</Text>
          <Text className="mt-0.5 text-xs text-white/90">{t('groupRequest.ctaBody')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="white" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('groupRequest.ctaTitle')}
      activeOpacity={0.8}
      onPress={open}
      className={`mb-4 flex-row items-center rounded-2xl border border-dashed border-brand-500 px-4 py-3 ${
        isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'
      }`}>
      <Ionicons name="people-outline" size={20} color={BRAND_GREEN} />
      <View className="ml-3 flex-1">
        <Text className={`text-sm font-semibold ${textColor}`}>{t('groupRequest.ctaTitle')}</Text>
        <Text className={`text-xs ${subtextColor}`} numberOfLines={2}>
          {t('groupRequest.ctaShort')}
        </Text>
      </View>
      <View className={`ml-2 rounded-full border px-3 py-1.5 ${borderColor} ${cardBg}`}>
        <Text className="text-xs font-semibold text-brand-600">{t('groupRequest.ctaAction')}</Text>
      </View>
    </TouchableOpacity>
  );
}
