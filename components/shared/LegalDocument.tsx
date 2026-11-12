import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { formatLongDate } from '../../i18n/dates';
import type { TranslationKey } from '../../i18n';
import {
  LEGAL_SECTION_COUNT,
  LEGAL_UPDATED,
  LEGAL_VERSION,
  type LegalDoc,
} from '../../services/legal';

type Props = {
  doc: LegalDoc;
  /** The link at the end that opens the other document. */
  onOpenOther: (other: LegalDoc) => void;
};

/**
 * The text of the Terms of Service or the Privacy Policy: the draft notice, the version line and
 * the numbered sections, ending in a link to the other document. No padding or scrolling of its
 * own — the Legal page and the pop-up the agreement links open (`LegalDocumentModal`) frame it.
 */
export default function LegalDocument({ doc, onOpenOther }: Props) {
  const { textColor, subtextColor, isDarkMode } = useThemeColors();
  const { t } = useLocale();

  const other: LegalDoc = doc === 'terms' ? 'privacy' : 'terms';
  const sections = Array.from({ length: LEGAL_SECTION_COUNT }, (_, i) => i + 1);

  return (
    <View>
      <View
        className="mb-4 flex-row items-start rounded-xl px-3 py-3"
        style={{ backgroundColor: isDarkMode ? 'rgba(217,119,6,0.14)' : '#FFFBEB' }}>
        <Ionicons name="construct-outline" size={18} color="#D97706" style={{ marginTop: 1 }} />
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
          <Text className={`mb-1.5 text-base font-bold ${textColor}`} accessibilityRole="header">
            {t(`legal.${doc}S${n}Title` as TranslationKey)}
          </Text>
          <Text className={`text-sm leading-6 ${subtextColor}`}>
            {t(`legal.${doc}S${n}Body` as TranslationKey)}
          </Text>
        </View>
      ))}

      <TouchableOpacity
        accessibilityRole="link"
        onPress={() => onOpenOther(other)}
        className="mt-2 flex-row items-center self-start">
        <Ionicons name="document-text-outline" size={18} color="#00A85A" />
        <Text className="ml-2 font-semibold text-brand-600">
          {other === 'privacy' ? t('legal.readPrivacy') : t('legal.readTerms')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
