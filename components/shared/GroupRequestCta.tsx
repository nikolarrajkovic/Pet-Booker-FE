import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import type { CreateGroupRequestParams } from '../../screens/group-requests-screen/containers/CreateGroupRequestScreen';
import { useRequireSignIn } from '../../hooks/useRequireSignIn';

type Props = {
  /** `bar` — a slim row above search results. `banner` — a card on Home. */
  variant?: 'bar' | 'banner';
  /** Handed to the form: the filters the user is browsing with, so "every matching provider"
   *  means the providers they are looking at. */
  params?: CreateGroupRequestParams;
  /** `banner` only: take the height of the row it sits in (Home's web row beside the pet card). */
  fill?: boolean;
};

/**
 * The way into "ask several providers": rather than booking one provider directly, send one
 * request to many and let the first who can take it. Shown wherever a user browses providers —
 * above the Search results (carrying the current filters) and on Home.
 */
export default function GroupRequestCta({ variant = 'bar', params, fill = false }: Props) {
  const navigation = useNavigation<any>();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  // A guest is asked to sign in first and comes back to the page they were on (app review G7).
  const requireSignIn = useRequireSignIn();
  const open = (asap = false) =>
    requireSignIn(() =>
      navigation.navigate('CreateGroupRequest', asap ? { ...params, asap: true } : params)
    );

  // "Need someone now?" — the same request, opened on "As soon as possible": sent at once to the
  // providers working before a deadline, and the first to accept says how soon they can come.
  const nowButton = (onGreen: boolean) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('groupRequest.ctaNow')}
      onPress={() => open(true)}
      className={`flex-row items-center rounded-full px-3 py-1.5 ${
        onGreen ? 'bg-white' : 'bg-amber-500'
      }`}>
      <Ionicons name="flash" size={13} color={onGreen ? '#D97706' : 'white'} />
      <Text className={`ml-1 text-xs font-bold ${onGreen ? 'text-amber-700' : 'text-white'}`}>
        {t('groupRequest.ctaNow')}
      </Text>
    </TouchableOpacity>
  );

  if (variant === 'banner') {
    return (
      <View className={`rounded-2xl bg-brand-500 p-4 ${fill ? 'flex-1 justify-center' : ''}`}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('groupRequest.ctaTitle')}
          activeOpacity={0.85}
          onPress={() => open()}
          className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <Ionicons name="people" size={24} color="white" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-bold text-white">{t('groupRequest.ctaTitle')}</Text>
            <Text className="mt-0.5 text-xs text-white/90">{t('groupRequest.ctaBody')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="white" />
        </TouchableOpacity>
        <View className="ml-[60px] mt-3 flex-row">{nowButton(true)}</View>
      </View>
    );
  }

  // The "now" button sits on its own line under the text: beside it, at 390px, it squeezed the
  // title to "provider s at once".
  return (
    <View
      className={`mb-4 rounded-2xl border border-dashed border-brand-500 px-4 py-3 ${
        isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'
      }`}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('groupRequest.ctaTitle')}
        activeOpacity={0.8}
        onPress={() => open()}
        className="flex-row items-center">
        <Ionicons name="people-outline" size={20} color={BRAND_GREEN} />
        <View className="ml-3 flex-1">
          <Text className={`text-sm font-semibold ${textColor}`}>{t('groupRequest.ctaTitle')}</Text>
          <Text className={`text-xs ${subtextColor}`} numberOfLines={2}>
            {t('groupRequest.ctaShort')}
          </Text>
        </View>
        <View className={`ml-2 rounded-full border px-3 py-1.5 ${borderColor} ${cardBg}`}>
          <Text className="text-xs font-semibold text-brand-600">
            {t('groupRequest.ctaAction')}
          </Text>
        </View>
      </TouchableOpacity>
      <View className="ml-8 mt-2 flex-row">{nowButton(false)}</View>
    </View>
  );
}
