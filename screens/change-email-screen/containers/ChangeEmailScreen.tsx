import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FormCard from '../../../components/shared/FormCard';
import { confirmEmailChange, requestEmailChange } from '../../../services/auth';
import { getErrorMessage } from '../../../services/http';
import { usePageGutter } from '../../../hooks/usePageGutter';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Changing the account's email (app review 2026-11-13, finding 28). Two steps: the new address and
 * the current password, then the code sent to the new address. The account moves only once the
 * code is entered, so a mistyped address changes nothing; the old address is told afterwards.
 */
export default function ChangeEmailScreen() {
  const gutter = usePageGutter();
  const { leaveTo } = useAppNavigation();
  const { bgColor, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();
  const { showError, showSuccess } = useToast();
  const { t } = useLocale();
  const { currentUser, refreshUser } = useAuth();

  const [step, setStep] = useState<'address' | 'code'>('address');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const trimmed = newEmail.trim();
  const addressOk = EMAIL.test(trimmed) && password.length > 0;
  const codeOk = /^\d{6}$/.test(code.trim());

  const send = async () => {
    if (!addressOk || busy) return;
    setBusy(true);
    try {
      await requestEmailChange({ newEmail: trimmed, currentPassword: password });
      setStep('code');
      setCode('');
    } catch (e) {
      showError(getErrorMessage(e, t('changeEmail.sendFailed')));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!codeOk || busy) return;
    setBusy(true);
    try {
      const email = await confirmEmailChange(code.trim());
      await refreshUser();
      showSuccess(t('changeEmail.changed', { email: email || trimmed }));
      leaveTo('Account');
    } catch (e) {
      showError(getErrorMessage(e, t('changeEmail.confirmFailed')));
    } finally {
      setBusy(false);
    }
  };

  const input = (
    testID: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    extra: Partial<React.ComponentProps<typeof TextInput>> = {}
  ) => (
    <View className="mb-4">
      <Text className={`mb-2 text-sm font-semibold ${textColor}`}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        className={`${inputBg} rounded-xl border px-4 py-3 ${inputText} ${borderColor}`}
        placeholderTextColor={placeholderColor}
        {...extra}
      />
    </View>
  );

  const button = (testID: string, label: string, enabled: boolean, onPress: () => void) => (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={!enabled || busy}
      className="mt-2 items-center rounded-2xl bg-brand-500 py-4"
      style={{ opacity: !enabled || busy ? 0.6 : 1 }}>
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className="text-lg font-bold text-white">{label}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenLayout
      narrow
      headerVariant="standard"
      showBackButton
      headerTitle={t('changeEmail.title')}
      contentBg={bgColor}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: gutter.value }}
        keyboardShouldPersistTaps="handled">
        <FormCard>
          {step === 'address' ? (
            <>
              <Text className={`mb-4 text-sm ${subtextColor}`}>
                {t('changeEmail.intro', { email: currentUser?.email ?? '' })}
              </Text>
              {input('change-email-new', t('changeEmail.newEmail'), newEmail, setNewEmail, {
                keyboardType: 'email-address',
                autoComplete: 'email',
                placeholder: 'name@example.com',
              })}
              {input('change-email-password', t('changeEmail.password'), password, setPassword, {
                secureTextEntry: true,
                onSubmitEditing: send,
              })}
              {button('change-email-send', t('changeEmail.sendCode'), addressOk, send)}
            </>
          ) : (
            <>
              <Text className={`mb-4 text-sm ${subtextColor}`}>
                {t('changeEmail.codeSent', { email: trimmed })}
              </Text>
              {input('change-email-code', t('changeEmail.code'), code, setCode, {
                keyboardType: 'number-pad',
                maxLength: 6,
                placeholder: '123456',
                onSubmitEditing: confirm,
              })}
              {button('change-email-confirm', t('changeEmail.confirm'), codeOk, confirm)}
              <View className="mt-4 flex-row justify-between">
                <TouchableOpacity accessibilityRole="button" onPress={send} disabled={busy}>
                  <Text className="text-sm font-semibold text-brand-600">
                    {t('changeEmail.resend')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setStep('address')}
                  disabled={busy}>
                  <Text className={`text-sm ${subtextColor}`}>{t('changeEmail.otherAddress')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </FormCard>
      </ScrollView>
    </ScreenLayout>
  );
}
