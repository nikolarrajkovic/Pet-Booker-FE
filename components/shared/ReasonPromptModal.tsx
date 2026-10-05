import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from './ResponsiveModal';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

type ReasonPromptModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  placeholder?: string;
  confirmLabel: string;
  /** The reason is required and must be at least this long (trimmed). */
  minLength?: number;
  /** Shown under the field while the reason is too short. */
  tooShortMessage?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

/**
 * Asks why before an action the other side is told about (a customer cancelling a booking).
 * The reason is stored on the booking and shown to them, so it is required rather than optional:
 * the app used to send a generic sentence instead, and the provider never learned why.
 */
export default function ReasonPromptModal({
  visible,
  title,
  subtitle,
  placeholder,
  confirmLabel,
  minLength = 5,
  tooShortMessage,
  submitting = false,
  onClose,
  onConfirm,
}: ReasonPromptModalProps) {
  const { cardBg, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();
  const { t } = useLocale();
  const [reason, setReason] = useState('');

  // A fresh prompt every time it opens.
  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length < minLength;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      mobilePresentation="centered"
      dismissOnBackdropPress={false}
      dialogWidth={480}>
      <View className={`${cardBg} p-5`}>
        <Text className={`text-lg font-bold ${textColor} mb-1`}>{title}</Text>
        {!!subtitle && <Text className={`text-sm ${subtextColor} mb-4`}>{subtitle}</Text>}
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          multiline
          numberOfLines={3}
          maxLength={1000}
          textAlignVertical="top"
          editable={!submitting}
          accessibilityLabel={title}
          className={`${inputBg} rounded-xl px-4 py-3 ${inputText} mb-1`}
          style={{ minHeight: 80 }}
          selectionColor={BRAND_GREEN}
        />
        <Text
          className={`mb-4 text-xs ${trimmed.length > 0 && tooShort ? 'text-red-500' : subtextColor}`}>
          {tooShort ? tooShortMessage : ' '}
        </Text>
        <View className="flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            disabled={submitting}
            activeOpacity={0.7}
            className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
            <Text className={`font-semibold ${textColor}`}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: tooShort || submitting }}
            onPress={() => onConfirm(trimmed)}
            disabled={tooShort || submitting}
            activeOpacity={0.7}
            className={`flex-1 items-center rounded-xl bg-red-500 py-3 ${tooShort ? 'opacity-50' : ''}`}>
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">{confirmLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModal>
  );
}
