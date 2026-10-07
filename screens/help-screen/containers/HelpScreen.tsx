import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FormCard from '../../../components/shared/FormCard';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { usePageGutter } from '../../../hooks/usePageGutter';
import type { TranslationKey } from '../../../i18n';
import { SUPPORT_EMAIL, SUPPORT_PHONE, callSupport, emailSupport } from '../../../services/support';

const QUESTIONS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Help & Support: common questions, the support contact (when one is configured — see
 * services/support.ts) and the legal documents. The Settings row used to appear only with a
 * configured contact and then just opened the mail app; now there is always something to read.
 */
export default function HelpScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation<any>();
  const { bgColor, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const [open, setOpen] = useState<number | null>(1);

  const row = (icon: any, label: string, onPress: () => void, detail?: string) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center border-t py-3 ${borderColor}`}>
      <Ionicons name={icon} size={20} color={BRAND_GREEN} />
      <View className="ml-3 flex-1">
        <Text className={`font-semibold ${textColor}`}>{label}</Text>
        {detail ? <Text className={`text-xs ${subtextColor}`}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('help.title')}
      contentBg={bgColor}
      width="narrow">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <FormCard>
          <View className={`${gutter.px} py-6`}>
            <Text className={`mb-5 text-sm ${subtextColor}`}>{t('help.intro')}</Text>

            <Text className={`mb-2 text-base font-bold ${textColor}`} accessibilityRole="header">
              {t('help.faq')}
            </Text>
            {QUESTIONS.map((n) => {
              const expanded = open === n;
              return (
                <View key={n} className={`border-t ${borderColor}`}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => setOpen(expanded ? null : n)}
                    className="flex-row items-center py-3">
                    <Text className={`flex-1 font-semibold ${textColor}`}>
                      {t(`help.q${n}` as TranslationKey)}
                    </Text>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                  {expanded ? (
                    <Text className={`pb-3 text-sm leading-6 ${subtextColor}`}>
                      {t(`help.a${n}` as TranslationKey)}
                    </Text>
                  ) : null}
                </View>
              );
            })}

            <Text
              className={`mb-1 mt-6 text-base font-bold ${textColor}`}
              accessibilityRole="header">
              {t('help.contact')}
            </Text>
            {SUPPORT_EMAIL || SUPPORT_PHONE ? (
              <>
                <Text className={`mb-2 text-sm ${subtextColor}`}>{t('help.contactBody')}</Text>
                {SUPPORT_EMAIL
                  ? row('mail-outline', t('help.emailUs'), emailSupport, SUPPORT_EMAIL)
                  : null}
                {SUPPORT_PHONE
                  ? row('call-outline', t('help.callUs'), callSupport, SUPPORT_PHONE)
                  : null}
              </>
            ) : (
              <Text className={`text-sm ${subtextColor}`}>{t('help.noContact')}</Text>
            )}

            <Text
              className={`mb-1 mt-6 text-base font-bold ${textColor}`}
              accessibilityRole="header">
              {t('help.legal')}
            </Text>
            {row('document-text-outline', t('legal.termsTitle'), () =>
              navigation.navigate('Legal', { doc: 'terms' })
            )}
            {row('shield-checkmark-outline', t('legal.privacyTitle'), () =>
              navigation.navigate('Legal', { doc: 'privacy' })
            )}
          </View>
        </FormCard>
      </ScrollView>
    </ScreenLayout>
  );
}
