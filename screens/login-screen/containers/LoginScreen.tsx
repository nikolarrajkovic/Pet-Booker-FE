import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/shared/Button';
import { SocialButton } from '../components';

export default function LoginScreen() {
  const { isDarkMode } = useTheme();
  const { signIn, signInWithCredentials, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isDarkMode ? 'bg-[#243447]' : 'bg-white';
  const inputText = isDarkMode ? 'text-white' : 'text-gray-900';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const placeholderColor = isDarkMode ? '#9CA3AF' : '#9CA3AF';
  const dividerColor = isDarkMode ? 'bg-gray-700' : 'bg-gray-300';

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }

    // API call commented out - using mock login for development
    setIsSubmitting(true);
    setLoginError('');
    
    // Bypass API and sign in with mock tokens
    await signIn('mock-access-token', 'mock-refresh-token');
    
    setIsSubmitting(false);

    /* Original API call - commented out
    try {
      setIsSubmitting(true);
      setLoginError('');
      await signInWithCredentials(email.trim(), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed. Please try again.';
      setLoginError(message);
    } finally {
      setIsSubmitting(false);
    }
    */
  };

  return (
    <SafeAreaView className={`flex-1 ${contentBg}`}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
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
          {/* Email Field */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
              placeholderTextColor={placeholderColor}
            />
          </View>

          {/* Password Field */}
          <View className="mb-2">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                className={`${inputBg} rounded-xl px-4 py-3 pr-12 ${inputText} border ${borderColor}`}
                placeholderTextColor={placeholderColor}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3"
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity className="self-end mb-6">
            <Text className="text-brand-600 font-semibold text-sm">Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <Button
            text={isSubmitting ? 'Signing In...' : 'Sign In'}
            onPress={handleSignIn}
            variant="primary"
            className="py-4 rounded-2xl mb-6"
            disabled={isSubmitting}
          />

          {loginError ? <Text className="text-red-500 text-sm mb-4">{loginError}</Text> : null}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
