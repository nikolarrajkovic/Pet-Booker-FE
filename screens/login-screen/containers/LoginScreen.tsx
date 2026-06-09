import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/shared/Button';
import { SocialButton } from '../components';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Validators ───────────────────────────────────────────────────────────────
function validateIdentifier(v: string) {
  if (!v.trim()) return 'Email or username is required';
  return '';
}

function validatePassword(v: string) {
  if (!v) return 'Password is required';
  return '';
}

export default function LoginScreen() {
  const { isDarkMode, textColor, subtextColor } = useThemeColors();
  const { signInWithCredentials, signInWithGoogle } = useAuth();
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
      setLoginError('Invalid credentials. Please check your email/username and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className={`flex-1 ${contentBg}`}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        {/* Green Header */}
        <View className={`${bgColor} px-6 pt-16 pb-12 items-center rounded-b-3xl`}>
          <View className="w-20 h-20 bg-white rounded-2xl items-center justify-center mb-4 shadow-lg">
            <MaterialCommunityIcons name="paw" size={40} color="#00A85A" />
          </View>
          <Text className="text-white text-2xl font-bold">Pet Booker</Text>
          <Text className="text-brand-100 mt-1">Welcome back!</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Email or Username */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Email or Username</Text>
            <TextInput
              value={identifier}
              onChangeText={(t) => { setIdentifier(t); touch('identifier'); setLoginError(''); }}
              onBlur={() => touch('identifier')}
              placeholder="Enter your email or username"
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
              <Text className="text-red-500 text-xs mt-1">{errors.identifier}</Text>
            ) : null}
          </View>

          {/* Password */}
          <View className="mb-2">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Password</Text>
            <View>
              <TextInput
                value={password}
                onChangeText={(t) => { setPassword(t); touch('password'); setLoginError(''); }}
                onBlur={() => touch('password')}
                placeholder="Enter your password"
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
                style={{ position: 'absolute', right: 16, top: 13 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>
            {touched.password && errors.password ? (
              <Text className="text-red-500 text-xs mt-1">{errors.password}</Text>
            ) : null}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={() => (navigation as any).navigate('ForgotPassword')} className="self-end mb-5 mt-1">
            <Text className="text-brand-600 font-semibold text-sm">Forgot Password?</Text>
          </TouchableOpacity>

          {/* Global login error */}
          {loginError ? (
            <Text className="text-red-500 text-sm mb-4 text-center">{loginError}</Text>
          ) : null}

          {/* Sign In Button */}
          <Button
            text={isSubmitting ? 'Signing In...' : 'Sign In'}
            onPress={handleSignIn}
            variant="primary"
            className="py-4 rounded-2xl mb-6"
            disabled={isSubmitting}
          />

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className={`flex-1 h-px ${dividerColor}`} />
            <Text className={`mx-4 ${subtextColor} text-sm`}>OR</Text>
            <View className={`flex-1 h-px ${dividerColor}`} />
          </View>

          {/* Social Buttons */}
          <View className="gap-3">
            <SocialButton
              text="Continue with Google"
              icon={<MaterialCommunityIcons name="google" size={22} color="#DB4437" />}
              onPress={signInWithGoogle}
              isDarkMode={isDarkMode}
            />
            <SocialButton
              text="Continue with Facebook"
              icon={<MaterialCommunityIcons name="facebook" size={22} color="#1877F2" />}
              onPress={() => {}}
              isDarkMode={isDarkMode}
            />
          </View>

          {/* Sign Up Link */}
          <View className="flex-row justify-center mt-6">
            <Text className={`text-sm ${subtextColor}`}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text className="text-brand-600 font-semibold text-sm">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
