import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useLocale } from '../../../context/LocaleContext';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import LanguagePicker from '../../../components/shared/LanguagePicker';
import { LANGUAGES } from '../../../i18n';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { toggleDarkMode } = useTheme();
  const { t, language, setLanguage } = useLocale();
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor } = useThemeColors();
  const sectionTextColor = textColor;

  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);

  const currentLanguageLabel = LANGUAGES.find((l) => l.code === language)?.label ?? 'English';

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('settings.title')}
      contentBg={contentBg}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 }}>
        {/* Appearance */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>
          {t('settings.appearance')}
        </Text>
        <View className={`${cardBg} mb-6 rounded-2xl p-4`}>
          <View className="flex-row items-center">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
              <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={24} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.darkMode')}
              </Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>
                {isDarkMode ? t('settings.darkEnabled') : t('settings.lightEnabled')}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#D1D5DB', true: '#00C870' }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* Notifications */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>
          {t('settings.notifications')}
        </Text>
        <View className={`${cardBg} mb-6 rounded-2xl`}>
          <View className="flex-row items-center border-b border-gray-100 p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <Ionicons name="notifications" size={24} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.pushNotifications')}
              </Text>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: '#D1D5DB', true: '#00C870' }}
              thumbColor="white"
            />
          </View>
          <View className="flex-row items-center border-b border-gray-100 p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
              <Ionicons name="mail" size={24} color="#A855F7" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.emailNotifications')}
              </Text>
            </View>
            <Switch
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              trackColor={{ false: '#D1D5DB', true: '#00C870' }}
              thumbColor="white"
            />
          </View>
          <View className="flex-row items-center p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
              <Ionicons name="chatbubble" size={24} color="#F97316" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.smsNotifications')}
              </Text>
            </View>
            <Switch
              value={smsNotifications}
              onValueChange={setSmsNotifications}
              trackColor={{ false: '#D1D5DB', true: '#00C870' }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* Privacy & Security */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>
          {t('settings.privacySecurity')}
        </Text>
        <View className={`${cardBg} mb-6 rounded-2xl`}>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('ChangePassword')}
            className="flex-row items-center border-b border-gray-100 p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-red-50">
              <Ionicons name="lock-closed" size={24} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.changePassword')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center border-b border-gray-100 p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-green-50">
              <Ionicons name="shield-checkmark" size={24} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.twoFactor')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <Ionicons name="eye-off" size={24} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.privacySettings')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* General */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>
          {t('settings.general')}
        </Text>
        <View className={`${cardBg} rounded-2xl`}>
          <TouchableOpacity
            onPress={() => setLanguagePickerOpen(true)}
            className="flex-row items-center border-b border-gray-100 p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
              <Ionicons name="globe" size={24} color="#A855F7" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.language')}
              </Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>{currentLanguageLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center border-b border-gray-100 p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
              <Ionicons name="help-circle" size={24} color="#F97316" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.helpSupport')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-green-50">
              <Ionicons name="document-text" size={24} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.termsPrivacy')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LanguagePicker
        visible={languagePickerOpen}
        current={language}
        onSelect={(lang) => {
          setLanguage(lang);
          setLanguagePickerOpen(false);
        }}
        onClose={() => setLanguagePickerOpen(false)}
      />
    </ScreenLayout>
  );
}
