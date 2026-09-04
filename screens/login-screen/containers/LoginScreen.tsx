import React, { useState } from 'react';
import { Text, View, TouchableOpacity, TextInput } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useFormChain } from '../../../hooks/useFormChain';
import { useAuth } from '../../../context/AuthContext';
import { getErrorMessage, isNetworkError, statusOf } from '../../../services/http';
import { useLocale } from '../../../context/LocaleContext';
import Button from '../../../components/shared/Button';
import { SocialButton } from '../components';
import AuthLayout from '../../../components/layout/AuthLayout';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Validators ───────────────────────────────────────────────────────────────
function validateIdentifier(v: string) {
  if (!v.trim()) return 'login.identifierRequired';
  return '';
}

function validatePassword(v: string) {
  if (!v) return 'login.passwordRequired';
  return '';
}

/**
 * Turns a failed sign-in into the line shown under the form.
 *
 * This used to be a bare `catch` that reported *every* failure as "invalid credentials", so an
 * unreachable API sent users off to reset a password that was never wrong — and a real outage
 * (a CORS misconfiguration) was indistinguishable from a typo.
 *
 * Note the API answers a rejected sign-in with **400**, not 401, and puts the reason in the body
 * ("Invalid credentials.", or the dated lockout notice) already localized via `Accept-Language`.
 * Those exact words are more useful than generic copy, so they win when present; the translated
 * strings are only the fallback for a body that said nothing.
 */
function resolveLoginError(error: unknown, t: (key: string) => string): string {
  if (isNetworkError(error)) return t('login.cannotReachServer');

  const serverMessage = getErrorMessage(error, '');
  if (serverMessage) return serverMessage;

  const status = statusOf(error);
  if (status === 400 || status === 401) return t('login.invalidCredentials');
  return t('login.signInFailed');
}

export default function LoginScreen() {
  const { isDarkMode, textColor, subtextColor } = useThemeColors();
  const { signInWithCredentials, signInWithGoogle } = useAuth();
  const { t } = useLocale();
  const navigation = useNavigation<NavigationProp>();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Already-resolved display text (see resolveLoginError), not a translation key: the message can
  // be the server's own localized words, which have no key to look up.
  const [loginError, setLoginError] = useState('');
  const inputBg = isDarkMode ? '#243447' : '#ffffff';
  const inputTextColor = isDarkMode ? '#ffffff' : '#111827';
  const defaultBorder = isDarkMode ? '#374151' : '#E5E7EB';
  const placeholderColor = '#9CA3AF';
  const dividerColor = isDarkMode ? 'bg-gray-700' : 'bg-gray-300';

  const errors = {
    identifier: validateIdentifier(identifier),
    password: validatePassword(password),
  };

  const isFormValid = Object.values(errors).every((e) => e === '');

  const borderFor = (field: keyof typeof errors) => {
    if (!touched[field]) return defaultBorder;
    return errors[field] ? '#EF4444' : '#00A85A';
  };

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const handleSignIn = async () => {
    setTouched({ identifier: true, password: true });
    if (!isFormValid) return;

    try {
      setIsSubmitting(true);
      setLoginError('');
      await signInWithCredentials(identifier.trim(), password);
    } catch (error) {
      setLoginError(resolveLoginError(error, t as (key: string) => string));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enter moves identifier -> password -> sign in. `handleSignIn` is the same function the button
  // calls, guards included, so pressing Enter on an incomplete form does exactly what clicking the
  // disabled button does rather than a second, subtly different thing.
  const form = useFormChain(['identifier', 'password'], handleSignIn);

  return (
    <AuthLayout title={t('login.appName')} subtitle={t('login.welcomeBack')}>
      {/* Email or Username */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('login.emailOrUsername')}
        </Text>
        <TextInput
          {...form.field('identifier')}
          value={identifier}
          onChangeText={(v) => {
            setIdentifier(v);
            touch('identifier');
            setLoginError('');
          }}
          onBlur={() => touch('identifier')}
          placeholder={t('login.emailOrUsernamePlaceholder')}
          autoCapitalize="none"
          style={{
            backgroundColor: inputBg,
            color: inputTextColor,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: borderFor('identifier'),
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 15,
          }}
          placeholderTextColor={placeholderColor}
        />
        {touched.identifier && errors.identifier ? (
          <Text className="mt-1 text-xs text-red-500">{t(errors.identifier as any)}</Text>
        ) : null}
      </View>

      {/* Password */}
      <View className="mb-2">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>{t('login.password')}</Text>
        <View>
          <TextInput
            {...form.field('password')}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              touch('password');
              setLoginError('');
            }}
            onBlur={() => touch('password')}
            placeholder={t('login.passwordPlaceholder')}
            secureTextEntry={!showPassword}
            style={{
              backgroundColor: inputBg,
              color: inputTextColor,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: borderFor('password'),
              paddingHorizontal: 16,
              paddingVertical: 12,
              paddingRight: 48,
              fontSize: 15,
            }}
            placeholderTextColor={placeholderColor}
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: 16, top: 13 }}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={isDarkMode ? '#9CA3AF' : '#6B7280'}
            />
          </TouchableOpacity>
        </View>
        {touched.password && errors.password ? (
          <Text className="mt-1 text-xs text-red-500">{t(errors.password as any)}</Text>
        ) : null}
      </View>

      {/* Forgot Password */}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => (navigation as any).navigate('ForgotPassword')}
        className="mb-5 mt-1 self-end">
        <Text className="text-sm font-semibold text-brand-600">{t('login.forgotPassword')}</Text>
      </TouchableOpacity>

      {/* Global login error */}
      {loginError ? (
        <Text className="mb-4 text-center text-sm text-red-500">{loginError}</Text>
      ) : null}

      {/* Sign In Button */}
      <Button
        text={isSubmitting ? t('login.signingIn') : t('login.signIn')}
        onPress={handleSignIn}
        variant="primary"
        className="mb-6 rounded-2xl py-4"
        disabled={isSubmitting}
      />

      {/* Divider */}
      <View className="mb-6 flex-row items-center">
        <View className={`h-px flex-1 ${dividerColor}`} />
        <Text className={`mx-4 ${subtextColor} text-sm`}>{t('common.or')}</Text>
        <View className={`h-px flex-1 ${dividerColor}`} />
      </View>

      {/* Social Buttons */}
      <View className="gap-3">
        <SocialButton
          text={t('login.continueWithGoogle')}
          icon={<MaterialCommunityIcons name="google" size={22} color="#DB4437" />}
          onPress={signInWithGoogle}
          isDarkMode={isDarkMode}
        />
        <SocialButton
          text={t('login.continueWithFacebook')}
          icon={<MaterialCommunityIcons name="facebook" size={22} color="#1877F2" />}
          onPress={() => {}}
          isDarkMode={isDarkMode}
        />
      </View>

      {/* Sign Up Link */}
      <View className="mt-6 flex-row justify-center">
        <Text className={`text-sm ${subtextColor}`}>{t('login.noAccount')}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.navigate('Register')}>
          <Text className="text-sm font-semibold text-brand-600">{t('login.signUp')}</Text>
        </TouchableOpacity>
      </View>
    </AuthLayout>
  );
}
