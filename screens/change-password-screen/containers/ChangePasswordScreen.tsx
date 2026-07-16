import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
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
import { changePassword } from '../../../services/auth';
import { getErrorMessage } from '../../../services/http';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { bgColor, textColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('changePassword.missingFieldsTitle'), t('changePassword.missingFieldsBody'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('changePassword.mismatchTitle'), t('changePassword.mismatchBody'));
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      Alert.alert(t('changePassword.changedTitle'), t('changePassword.changedBody'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      showError(getErrorMessage(e, t('changePassword.changeFailed')));
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
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('changePassword.title')}
      contentBg={bgColor}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled">
        {field(t('changePassword.currentPassword'), currentPassword, setCurrentPassword)}
        {field(t('changePassword.newPassword'), newPassword, setNewPassword)}
        {field(t('changePassword.confirmPassword'), confirmPassword, setConfirmPassword)}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className="mt-2 items-center rounded-2xl bg-brand-500 py-4"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-lg font-bold text-white">
              {t('changePassword.updatePassword')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}
