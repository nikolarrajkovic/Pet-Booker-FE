import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { forgotPassword, resetPassword } from '../../../services/auth';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { bgColor, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } = useThemeColors();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendEmail = async () => {
    if (!email.trim()) { Alert.alert('Email required', 'Please enter your email address.'); return; }
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      Alert.alert('Check your email', 'If an account exists, a reset code has been sent.');
      setStep('reset');
    } catch (e: any) {
      Alert.alert('Could not send reset email', e?.message ?? 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReset = async () => {
    if (!resetToken || !newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords don’t match', 'New password and confirmation must match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword({ resetToken: resetToken.trim(), newPassword, confirmPassword });
      Alert.alert('Password reset', 'You can now sign in with your new password.', [
        // Terminal step — reset so back can't return to the reset form.
        { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
      ]);
    } catch (e: any) {
      Alert.alert('Could not reset password', e?.message ?? 'Please try again.');
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
    <ScreenLayout headerVariant="standard" showBackButton headerTitle="Reset Password" contentBg={bgColor}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        {step === 'request' ? (
          <>
            <Text className={`text-sm ${subtextColor} mb-5`}>
              Enter the email associated with your account and we’ll send you a reset code.
            </Text>
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Email</Text>
            {input(email, setEmail, { placeholder: 'you@example.com', keyboardType: 'email-address', autoCapitalize: 'none' })}
            <TouchableOpacity
              onPress={sendEmail}
              disabled={isSubmitting}
              className="bg-brand-500 py-4 rounded-2xl items-center mt-2"
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white text-lg font-bold">Send Reset Code</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('reset')} className="items-center mt-4">
              <Text className="text-brand-600 font-semibold text-sm">I already have a reset code</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text className={`text-sm ${subtextColor} mb-5`}>
              Enter the reset code from your email along with your new password.
            </Text>
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Reset Code</Text>
            {input(resetToken, setResetToken, { placeholder: 'Paste your reset code', autoCapitalize: 'none' })}
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>New Password</Text>
            {input(newPassword, setNewPassword, { secureTextEntry: true, autoCapitalize: 'none' })}
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Confirm New Password</Text>
            {input(confirmPassword, setConfirmPassword, { secureTextEntry: true, autoCapitalize: 'none' })}
            <TouchableOpacity
              onPress={submitReset}
              disabled={isSubmitting}
              className="bg-brand-500 py-4 rounded-2xl items-center mt-2"
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white text-lg font-bold">Reset Password</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
