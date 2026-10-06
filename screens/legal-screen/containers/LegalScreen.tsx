import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FormCard from '../../../components/shared/FormCard';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { formatLongDate } from '../../../i18n/dates';
import type { TranslationKey } from '../../../i18n';
import {
  LEGAL_SECTION_COUNT,
  LEGAL_UPDATED,
  LEGAL_VERSION,
  type LegalDoc,
} from '../../../services/legal';

type Params = { Legal: { doc?: LegalDoc } };

/**
 * The Terms of Service or the Privacy Policy (`/legal/terms`, `/legal/privacy`), readable signed
 * in or out — sign-up links here before an account exists. The text is a translated placeholder
 * draft, marked as such, until the real documents replace it (see services/legal.ts).
 */
export default function LegalScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Params, 'Legal'>>();
  const doc: LegalDoc = route.params?.doc === 'privacy' ? 'privacy' : 'terms';
  const { bgColor, textColor, subtextColor, isDarkMode } = useThemeColors();
  const { t } = useLocale();

  const title = doc === 'terms' ? t('legal.termsTitle') : t('legal.privacyTitle');
  const other: LegalDoc = doc === 'terms' ? 'privacy' : 'terms';
  const sections = Array.from({ length: LEGAL_SECTION_COUNT }, (_, i) => i + 1);

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={title}
      contentBg={bgColor}
      width="narrow">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <FormCard>
          <View className={`${gutter.px} py-6`}>
            <View
              className="mb-4 flex-row items-start rounded-xl px-3 py-3"
              style={{ backgroundColor: isDarkMode ? 'rgba(217,119,6,0.14)' : '#FFFBEB' }}>
              <Ionicons
                name="construct-outline"
                size={18}
                color="#D97706"
                style={{ marginTop: 1 }}
              />
              <Text className={`ml-2 flex-1 text-sm ${textColor}`}>{t('legal.draftNotice')}</Text>
            </View>
            <Text className={`mb-5 text-xs ${subtextColor}`}>
              {t('legal.version', {
                version: LEGAL_VERSION,
                date: formatLongDate(new Date(`${LEGAL_UPDATED}T12:00:00`)),
              })}
            </Text>

            {sections.map((n) => (
              <View key={n} className="mb-5">
                <Text
                  className={`mb-1.5 text-base font-bold ${textColor}`}
                  accessibilityRole="header">
                  {t(`legal.${doc}S${n}Title` as TranslationKey)}
                </Text>
                <Text className={`text-sm leading-6 ${subtextColor}`}>
                  {t(`legal.${doc}S${n}Body` as TranslationKey)}
                </Text>
              </View>
            ))}

            <TouchableOpacity
              accessibilityRole="link"
              onPress={() => navigation.setParams({ doc: other })}
              className="mt-2 flex-row items-center">
              <Ionicons name="document-text-outline" size={18} color="#00A85A" />
              <Text className="ml-2 font-semibold text-brand-600">
                {other === 'privacy' ? t('legal.readPrivacy') : t('legal.readTerms')}
              </Text>
            </TouchableOpacity>
          </View>
        </FormCard>
      </ScrollView>
    </ScreenLayout>
  );
}
