import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { forgotPassword, resetPassword } from '../../../services/auth';
import { getErrorMessage } from '../../../services/http';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { bgColor, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendEmail = async () => {
    if (!email.trim()) {
      Alert.alert(t('forgotPassword.emailRequiredTitle'), t('forgotPassword.emailRequiredBody'));
      return;
    }
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      Alert.alert(t('forgotPassword.checkEmailTitle'), t('forgotPassword.checkEmailBody'));
      setStep('reset');
    } catch (e) {
      showError(getErrorMessage(e, t('forgotPassword.sendFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReset = async () => {
    if (!resetToken || !newPassword || !confirmPassword) {
      Alert.alert(t('forgotPassword.missingFieldsTitle'), t('forgotPassword.missingFieldsBody'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('forgotPassword.mismatchTitle'), t('forgotPassword.mismatchBody'));
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword({ resetToken: resetToken.trim(), newPassword, confirmPassword });
      Alert.alert(t('forgotPassword.resetDoneTitle'), t('forgotPassword.resetDoneBody'), [
        // Terminal step — reset so back can't return to the reset form.
        {
          text: t('common.ok'),
          onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }),
        },
      ]);
    } catch (e) {
      showError(getErrorMessage(e, t('forgotPassword.resetFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const input = (value: string, setter: (v: string) => void, props: object = {}) => (
    <TextInput
      value={value}
      onChangeText={setter}
      className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor} mb-4`}
      placeholderTextColor={placeholderColor}
      {...props}
    />
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('forgotPassword.title')}
      contentBg={bgColor}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled">
        {step === 'request' ? (
          <>
            <Text className={`text-sm ${subtextColor} mb-5`}>
              {t('forgotPassword.requestSubtitle')}
            </Text>
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('forgotPassword.email')}
            </Text>
            {input(email, setEmail, {
              placeholder: t('forgotPassword.emailPlaceholderExample'),
              keyboardType: 'email-address',
              autoCapitalize: 'none',
            })}
            <TouchableOpacity
              onPress={sendEmail}
              disabled={isSubmitting}
              className="mt-2 items-center rounded-2xl bg-brand-500 py-4"
              style={{ opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-bold text-white">{t('forgotPassword.sendCode')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('reset')} className="mt-4 items-center">
              <Text className="text-sm font-semibold text-brand-600">
                {t('forgotPassword.haveCode')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text className={`text-sm ${subtextColor} mb-5`}>
              {t('forgotPassword.resetSubtitle')}
            </Text>
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('forgotPassword.resetCode')}
            </Text>
            {input(resetToken, setResetToken, {
              placeholder: t('forgotPassword.resetCodePlaceholderPaste'),
              autoCapitalize: 'none',
            })}
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('forgotPassword.newPassword')}
            </Text>
            {input(newPassword, setNewPassword, { secureTextEntry: true, autoCapitalize: 'none' })}
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('forgotPassword.confirmPassword')}
            </Text>
            {input(confirmPassword, setConfirmPassword, {
              secureTextEntry: true,
              autoCapitalize: 'none',
            })}
            <TouchableOpacity
              onPress={submitReset}
              disabled={isSubmitting}
              className="mt-2 items-center rounded-2xl bg-brand-500 py-4"
              style={{ opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-bold text-white">
                  {t('forgotPassword.resetPassword')}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
