import React from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FormCard from '../../../components/shared/FormCard';
import LegalDocument from '../../../components/shared/LegalDocument';
import { useResponsive } from '../../../hooks/useResponsive';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { usePageGutter } from '../../../hooks/usePageGutter';
import type { LegalDoc } from '../../../services/legal';

type Params = { Legal: { doc?: LegalDoc } };

/**
 * The Terms of Service or the Privacy Policy (`/legal/terms`, `/legal/privacy`), readable signed
 * in or out — Settings, Help and the guest profile link here. The forms that ask the user to agree
 * (sign-up, an invite, the partner application) open the same text in a pop-up instead
 * (`LegalAgreement` → `LegalDocumentModal`), so reading it doesn't leave the form. The text is a
 * translated placeholder draft, marked as such, until the real documents replace it (see
 * services/legal.ts).
 */
export default function LegalScreen() {
  const gutter = usePageGutter();
  const { isWebLayout } = useResponsive();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Params, 'Legal'>>();
  const doc: LegalDoc = route.params?.doc === 'privacy' ? 'privacy' : 'terms';
  const { bgColor } = useThemeColors();
  const { t } = useLocale();

  const title = doc === 'terms' ? t('legal.termsTitle') : t('legal.privacyTitle');

  return (
    <ScreenLayout
      narrow
      headerVariant="standard"
      showBackButton
      headerTitle={title}
      contentBg={bgColor}>
      {/* Web: the card sits inside the page gutter like every other page's, and pads itself.
          Phone: FormCard is a pass-through, so the text carries the gutter. */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 32,
          paddingHorizontal: isWebLayout ? gutter.value : 0,
        }}>
        <FormCard>
          <View className={`${isWebLayout ? '' : gutter.px} py-6`}>
            <LegalDocument
              doc={doc}
              onOpenOther={(other) => navigation.setParams({ doc: other })}
            />
          </View>
        </FormCard>
      </ScrollView>
    </ScreenLayout>
  );
}
