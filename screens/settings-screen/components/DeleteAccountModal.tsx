import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';

type DeleteAccountModalProps = {
  visible: boolean;
  submitting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (password: string) => void;
};

/**
 * Closing the account for good. Says plainly what happens, and asks for the password: it is
 * irreversible, and a phone left unlocked should not be enough to do it.
 */
export default function DeleteAccountModal({
  visible,
  submitting,
  error,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const { cardBg, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();
  const { t } = useLocale();
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (visible) setPassword('');
  }, [visible]);

  const consequences = [
    t('settings.deleteAccountPointBookings'),
    t('settings.deleteAccountPointData'),
    t('settings.deleteAccountPointPartner'),
  ];

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      mobilePresentation="centered"
      dismissOnBackdropPress={false}
      dialogWidth={480}>
      <View className={`${cardBg} p-5`}>
        <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <Ionicons name="warning-outline" size={24} color="#EF4444" />
        </View>
        <Text className={`text-lg font-bold ${textColor} mb-2`}>
          {t('settings.deleteAccountTitle')}
        </Text>
        {consequences.map((line) => (
          <View key={line} className="mb-1.5 flex-row">
            <Text className={`${subtextColor} mr-2`}>•</Text>
            <Text className={`flex-1 text-sm ${subtextColor}`}>{line}</Text>
          </View>
        ))}
        <Text className={`mb-2 mt-3 text-sm font-semibold ${textColor}`}>
          {t('settings.deleteAccountPasswordLabel')}
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!submitting}
          placeholder={t('settings.deleteAccountPasswordPlaceholder')}
          placeholderTextColor={placeholderColor}
          accessibilityLabel={t('settings.deleteAccountPasswordLabel')}
          onSubmitEditing={() => password && onConfirm(password)}
          className={`${inputBg} rounded-xl px-4 py-3 ${inputText} mb-2`}
          selectionColor={BRAND_GREEN}
        />
        {error ? <Text className="mb-2 text-sm text-red-500">{error}</Text> : null}
        <View className="mt-2 flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            disabled={submitting}
            activeOpacity={0.7}
            className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
            <Text className={`font-semibold ${textColor}`}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !password || submitting }}
            onPress={() => onConfirm(password)}
            disabled={!password || submitting}
            activeOpacity={0.7}
            className={`flex-1 items-center rounded-xl bg-red-500 py-3 ${!password ? 'opacity-50' : ''}`}>
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">{t('settings.deleteAccountConfirm')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModal>
  );
}
