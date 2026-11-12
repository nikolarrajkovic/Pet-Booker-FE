import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ResponsiveModal from './ResponsiveModal';
import LegalDocument from './LegalDocument';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useBottomInset, useTopInset } from '../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../context/LocaleContext';
import type { LegalDoc } from '../../services/legal';

type Props = {
  /** The document to show; `null` keeps the pop-up closed. */
  doc: LegalDoc | null;
  onClose: () => void;
};

/**
 * The Terms of Service or the Privacy Policy in a pop-up, over the form that links to them.
 *
 * Sign-up used to navigate to the Legal page, which took the user off the form they were filling
 * in (and on the web brought them back to it empty, until `AppShell` stopped rebuilding the
 * navigator). A pop-up leaves the form where it is. A full-screen sheet on a phone, a dialog on a
 * desktop (`ResponsiveModal`); the link at the end switches to the other document in place.
 */
export default function LegalDocumentModal({ doc, onClose }: Props) {
  const { isWebLayout } = useResponsive();
  const { cardBg, textColor, borderColor, isDarkMode } = useThemeColors();
  const { t } = useLocale();
  const topInset = useTopInset();
  const bottomInset = useBottomInset();
  const scrollRef = useRef<ScrollView>(null);

  // Kept while the pop-up fades out, so the text doesn't blank out under the closing animation.
  const [shown, setShown] = useState<LegalDoc>(doc ?? 'terms');
  useEffect(() => {
    if (doc) setShown(doc);
  }, [doc]);

  const openOther = (other: LegalDoc) => {
    setShown(other);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const title = shown === 'terms' ? t('legal.termsTitle') : t('legal.privacyTitle');
  const px = isWebLayout ? 'px-6' : 'px-4';

  return (
    <ResponsiveModal visible={doc !== null} onClose={onClose} dialogWidth={680}>
      <View
        className={`flex-row items-center justify-between border-b ${px} py-4 ${borderColor} ${cardBg}`}
        style={isWebLayout ? undefined : { paddingTop: topInset + 16 }}>
        <Text
          className={`mr-3 flex-1 text-xl font-bold ${textColor}`}
          accessibilityRole="header"
          numberOfLines={2}>
          {title}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full">
          <Ionicons name="close" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: isWebLayout ? 24 : 16,
          paddingTop: 20,
          paddingBottom: 24 + bottomInset,
        }}>
        <LegalDocument doc={shown} onOpenOther={openOther} />
      </ScrollView>
    </ResponsiveModal>
  );
}
