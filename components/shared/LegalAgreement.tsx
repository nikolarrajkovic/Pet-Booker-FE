import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import type { LegalDoc } from '../../services/legal';

type Props = {
  /** With a checkbox the user must tick; without one it is a notice ("By … you agree to …"). */
  checked?: boolean;
  onToggle?: (next: boolean) => void;
  /** Which documents to link: both (sign-up) or just the Terms (the partner obligations). */
  docs?: 'both' | 'terms';
  /** The sentence's start, e.g. `legal.agreePrefix` or `legal.inviteNotice`. */
  prefixKey?: 'legal.agreePrefix' | 'legal.partnerAgree' | 'legal.inviteNotice';
  /** Shown in red under the line when the user tried to continue without ticking. */
  error?: string;
  className?: string;
};

/**
 * "I agree to the Terms of Service and the Privacy Policy" — with the two names as links that open
 * the documents. The register screen showed the same words styled as links that did nothing.
 */
export default function LegalAgreement({
  checked,
  onToggle,
  docs = 'both',
  prefixKey = 'legal.agreePrefix',
  error,
  className = '',
}: Props) {
  const { textColor, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const hasCheckbox = typeof checked === 'boolean' && !!onToggle;
  const open = (doc: LegalDoc) => navigation.navigate('Legal', { doc });

  // What the checkbox is announced as: the whole sentence, not just the first link's title.
  const label =
    t(prefixKey) +
    t('legal.termsTitle') +
    (docs === 'both' ? t('legal.agreeAnd') + t('legal.privacyTitle') : '');

  const link = (doc: LegalDoc, label: string) => (
    <Text
      accessibilityRole="link"
      onPress={() => open(doc)}
      className="font-semibold text-brand-600 underline">
      {label}
    </Text>
  );

  const sentence = (
    <Text className={`flex-1 text-sm leading-5 ${hasCheckbox ? textColor : subtextColor}`}>
      {t(prefixKey)}
      {link('terms', t('legal.termsTitle'))}
      {docs === 'both' ? (
        <>
          {t('legal.agreeAnd')}
          {link('privacy', t('legal.privacyTitle'))}
        </>
      ) : null}
      .
    </Text>
  );

  return (
    <View className={className}>
      {hasCheckbox ? (
        <View className="flex-row items-start">
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={label}
            onPress={() => onToggle!(!checked)}
            hitSlop={8}
            className="mr-3 mt-0.5">
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={22}
              color={checked ? BRAND_GREEN : error ? '#EF4444' : '#9CA3AF'}
            />
          </TouchableOpacity>
          {sentence}
        </View>
      ) : (
        <View className="flex-row">{sentence}</View>
      )}
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
