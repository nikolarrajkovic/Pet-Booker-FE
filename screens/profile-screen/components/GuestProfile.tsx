import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { useTabBarSpacing } from '../../../hooks/useSafeAreaSpacing';
import ScreenLayout from '../../../components/shared/ScreenLayout';

/**
 * The Profile tab for a guest browsing signed out (app review G7): what an account is for, the way
 * in, and the pages that need none (help, the terms).
 */
export default function GuestProfile() {
  const navigation = useNavigation<any>();
  const gutter = usePageGutter();
  const { isDarkMode, cardBg, bgColor, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  const tabBarSpacing = useTabBarSpacing();

  const row = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    label: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center border-b py-4 ${borderColor}`}>
      <Ionicons name={icon} size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
      <Text className={`ml-3 flex-1 text-base ${textColor}`}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
    </TouchableOpacity>
  );

  return (
    <ScreenLayout
      narrow
      headerVariant="large"
      contentBg={bgColor}
      headerTitle={isWebLayout ? t('profile.title') : undefined}
      headerChildren={
        isWebLayout ? undefined : (
          <Text className="mb-6 text-2xl font-bold text-white">{t('profile.title')}</Text>
        )
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: isWebLayout ? 40 : tabBarSpacing }}>
        <View className={`${gutter.px} pt-6`}>
          <View className={`${cardBg} items-center rounded-2xl border p-6 ${borderColor}`}>
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: isDarkMode ? '#12302a' : '#E6FAF0' }}>
              <Ionicons name="person-outline" size={30} color={BRAND_GREEN} />
            </View>
            <Text className={`text-center text-lg font-bold ${textColor}`}>
              {t('profile.guestTitle')}
            </Text>
            <Text className={`mt-2 text-center text-sm ${subtextColor}`}>
              {t('profile.guestBody')}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.navigate('Login')}
              className="mt-5 w-full items-center rounded-2xl bg-brand-500 py-4">
              <Text className="text-base font-bold text-white">{t('login.signIn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.navigate('Register')}
              className="mt-3 w-full items-center rounded-2xl border-2 border-brand-500 py-3">
              <Text className="text-base font-semibold text-brand-600">
                {t('profile.createAccount')}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-6">
            {row('help-circle-outline', t('help.title'), () => navigation.navigate('Help'))}
            {row('document-text-outline', t('legal.termsTitle'), () =>
              navigation.navigate('Legal', { doc: 'terms' })
            )}
            {row('shield-checkmark-outline', t('legal.privacyTitle'), () =>
              navigation.navigate('Legal', { doc: 'privacy' })
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
