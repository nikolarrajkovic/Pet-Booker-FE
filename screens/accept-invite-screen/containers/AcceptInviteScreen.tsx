import React, { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import Button from '../../../components/shared/Button';
import AuthLayout from '../../../components/layout/AuthLayout';
import { resetPassword } from '../../../services/auth';
import { getErrorMessage } from '../../../services/http';
import LegalAgreement from '../../../components/shared/LegalAgreement';

type RootStackParamList = {
  Login: { email?: string; notice?: string } | undefined;
  AcceptInvite: { token?: string };
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** The address the invite was sent to, read from the token (display only — the server verifies it). */
function emailFromToken(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.email === 'string' ? json.email : null;
  } catch {
    return null;
  }
}

/**
 * Where a partner the admin added lands from their invite email: they choose a password, then sign
 * in with the address the invite was sent to. The link carries a one-time set-password token
 * (`/accept-invite?token=…`); it expires after seven days, and Forgot password covers that case.
 */
export default function AcceptInviteScreen() {
  const { isDarkMode, textColor, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'AcceptInvite'>>();
  const token = route.params?.token ?? '';
  const email = useMemo(() => (token ? emailFromToken(token) : null), [token]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputStyle = {
    backgroundColor: isDarkMode ? '#243447' : '#F9FAFB',
    color: isDarkMode ? '#ffffff' : '#111827',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  };

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !!token && password.length >= 8 && password === confirm && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError('');
    try {
      await resetPassword({ resetToken: token, newPassword: password, confirmPassword: confirm });
      navigation.reset({
        index: 0,
        routes: [
          { name: 'Login', params: { email: email ?? undefined, notice: t('acceptInvite.done') } },
        ],
      });
    } catch (e) {
      setError(getErrorMessage(e, t('acceptInvite.failed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title={t('acceptInvite.title')} subtitle={t('acceptInvite.subtitle')}>
        <Text className={`mb-6 text-center text-sm ${subtextColor}`}>
          {t('acceptInvite.missingToken')}
        </Text>
        <Button
          text={t('acceptInvite.toSignIn')}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
          variant="primary"
          className="rounded-2xl py-4"
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('acceptInvite.title')} subtitle={t('acceptInvite.subtitle')}>
      {email ? (
        <View className="mb-6 flex-row items-center rounded-2xl bg-emerald-50 px-4 py-4">
          <Ionicons name="mail-outline" size={20} color="#00A85A" />
          <View className="ml-3">
            <Text className="text-xs text-gray-500">{t('acceptInvite.signInWith')}</Text>
            <Text className="text-sm font-semibold text-gray-900">{email}</Text>
          </View>
        </View>
      ) : null}

      <Text className={`mb-2 text-sm font-semibold ${textColor}`}>
        {t('acceptInvite.password')}
      </Text>
      <View className="mb-1">
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          accessibilityLabel={t('acceptInvite.password')}
          placeholder={t('acceptInvite.passwordPlaceholder')}
          placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
          style={inputStyle}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('acceptInvite.togglePassword')}
          onPress={() => setShowPassword((v) => !v)}
          style={{ position: 'absolute', right: 16, top: 13 }}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={isDarkMode ? '#9CA3AF' : '#6B7280'}
          />
        </TouchableOpacity>
      </View>
      <Text className={`mb-4 text-xs ${subtextColor}`}>{t('acceptInvite.passwordRules')}</Text>

      <Text className={`mb-2 text-sm font-semibold ${textColor}`}>{t('acceptInvite.confirm')}</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        accessibilityLabel={t('acceptInvite.confirm')}
        onSubmitEditing={handleSubmit}
        style={inputStyle}
      />
      {mismatch ? (
        <Text className="mt-1 text-xs text-red-500">{t('acceptInvite.mismatch')}</Text>
      ) : null}

      {error ? <Text className="mt-4 text-center text-sm text-red-500">{error}</Text> : null}

      <LegalAgreement prefixKey="legal.inviteNotice" className="mt-5" />

      <Button
        text={isSubmitting ? t('acceptInvite.saving') : t('acceptInvite.submit')}
        onPress={handleSubmit}
        variant="primary"
        className="mt-6 rounded-2xl py-4"
        disabled={!canSubmit}
      />
    </AuthLayout>
  );
}
