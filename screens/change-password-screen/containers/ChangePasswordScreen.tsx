import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { changePassword } from '../../../services/auth';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { bgColor, textColor, inputBg, inputText, borderColor, placeholderColor } = useThemeColors();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords don’t match', 'New password and confirmation must match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      Alert.alert('Password changed', 'Your password has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Could not change password', e?.message ?? 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (label: string, value: string, setter: (v: string) => void) => (
    <View className="mb-4">
      <Text className={`text-sm font-semibold ${textColor} mb-2`}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={setter}
        secureTextEntry
        autoCapitalize="none"
        className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
        placeholderTextColor={placeholderColor}
      />
    </View>
  );

  return (
    <ScreenLayout headerVariant="standard" showBackButton headerTitle="Change Password" contentBg={bgColor}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        {field('Current Password', currentPassword, setCurrentPassword)}
        {field('New Password', newPassword, setNewPassword)}
        {field('Confirm New Password', confirmPassword, setConfirmPassword)}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className="bg-brand-500 py-4 rounded-2xl items-center mt-2"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white text-lg font-bold">Update Password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}
