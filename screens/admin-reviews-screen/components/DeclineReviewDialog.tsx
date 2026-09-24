import React from 'react';
import { Text, View, TouchableOpacity, TextInput } from 'react-native';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';

type Props = {
  visible: boolean;
  reason: string;
  onChangeReason: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** A typed reason must be ≥10 chars (server rule); blank is fine (the caller uses a fallback). */
export function isDeclineReasonTooShort(reason: string): boolean {
  const trimmed = reason.trim();
  return trimmed.length > 0 && trimmed.length < 10;
}

/**
 * The decline-reason prompt for a review — shared by both designs of the moderation screen.
 *
 * ResponsiveModal owns the scrim, the width cap and Esc; centred on both designs because the
 * prompt is a title and one field, not a sheet's worth of content.
 */
export function DeclineReviewDialog({
  visible,
  reason,
  onChangeReason,
  onCancel,
  onConfirm,
}: Props) {
  const { hex, inputBg, inputText, textColor, subtextColor, borderColor, placeholderColor } =
    useThemeColors();
  const { t } = useLocale();
  const tooShort = isDeclineReasonTooShort(reason);

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      mobilePresentation="centered"
      dialogWidth={480}>
      <View style={{ backgroundColor: hex.card, padding: 20 }}>
        <Text style={{ color: hex.text, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
          {t('admin.declineReviewTitle')}
        </Text>
        <Text className={subtextColor} style={{ fontSize: 13, marginBottom: 16 }}>
          {t('admin.declineReviewMsg')}
        </Text>
        <TextInput
          value={reason}
          onChangeText={onChangeReason}
          placeholder={t('admin.declineReasonPlaceholder')}
          placeholderTextColor={placeholderColor}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          className={`${inputBg} ${inputText}`}
          style={{
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            minHeight: 80,
            marginBottom: tooShort ? 4 : 16,
          }}
          selectionColor={BRAND_GREEN}
        />
        {tooShort && (
          <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>
            {t('admin.declineReasonTooShort')}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onCancel}
            activeOpacity={0.7}
            className={borderColor}
            style={{
              flex: 1,
              alignItems: 'center',
              borderRadius: 12,
              borderWidth: 1,
              paddingVertical: 12,
            }}>
            <Text className={textColor} style={{ fontWeight: '600' }}>
              {t('admin.cancel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onConfirm}
            disabled={tooShort}
            activeOpacity={0.7}
            style={{
              flex: 1,
              alignItems: 'center',
              borderRadius: 12,
              backgroundColor: '#EF4444',
              paddingVertical: 12,
              opacity: tooShort ? 0.5 : 1,
            }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>{t('admin.decline')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModal>
  );
}
