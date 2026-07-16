import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import Button from '../../../components/shared/Button';
import { SocialButton } from '../components';

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
  const [loginError, setLoginError] = useState('');

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
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
    } catch {
      setLoginError('login.invalidCredentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className={`flex-1 ${contentBg}`}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        {/* Green Header */}
        <View className={`${bgColor} items-center rounded-b-3xl px-6 pb-12 pt-16`}>
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg">
            <MaterialCommunityIcons name="paw" size={40} color="#00A85A" />
          </View>
          <Text className="text-2xl font-bold text-white">{t('login.appName')}</Text>
          <Text className="mt-1 text-brand-100">{t('login.welcomeBack')}</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">
          {/* Email or Username */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('login.emailOrUsername')}
            </Text>
            <TextInput
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
            onPress={() => (navigation as any).navigate('ForgotPassword')}
            className="mb-5 mt-1 self-end">
            <Text className="text-sm font-semibold text-brand-600">
              {t('login.forgotPassword')}
            </Text>
          </TouchableOpacity>

          {/* Global login error */}
          {loginError ? (
            <Text className="mb-4 text-center text-sm text-red-500">{t(loginError as any)}</Text>
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
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text className="text-sm font-semibold text-brand-600">{t('login.signUp')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
