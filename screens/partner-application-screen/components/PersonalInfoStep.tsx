import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PhoneInput from '../../../components/shared/PhoneInput';
import { useLocale } from '../../../context/LocaleContext';

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  country: string; // ISO code from the phone-number country picker
  streetAddress: string;
  city: string;
  zipCode: string;
  selectedServices: string[];
  yearsOfExperience: string;
  aboutYou: string;
  motivation: string;
}

interface PersonalInfoStepProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  /** When provided, shows a button that prefills the fields from the user's account. */
  onPrefill?: () => void;
  /** When provided, the street address field can open a map picker (fills street/city/ZIP). */
  onOpenAddressMap?: () => void;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  inputBg: string;
  inputText: string;
  borderColor: string;
  placeholderColor: string;
  cardBg: string;
}

export default function PersonalInfoStep({
  formData,
  setFormData,
  onPrefill,
  onOpenAddressMap,
  isDarkMode,
  textColor,
  subtextColor,
  inputBg,
  inputText,
  borderColor,
  placeholderColor,
  cardBg,
}: PersonalInfoStepProps) {
  const { t } = useLocale();
  return (
    <View>
      <Text className={`text-xl font-bold ${textColor} mb-2`}>
        {t('partnerApplication.personalInfo')}
      </Text>
      <Text className={`text-sm ${subtextColor} mb-4`}>
        {t('partnerApplication.tellUsAboutYourself')}
      </Text>

      {/* Prefill from the signed-in user's account details */}
      {onPrefill && (
        <TouchableOpacity
          onPress={onPrefill}
          accessibilityRole="button"
          accessibilityLabel={t('partnerApplication.useAccountDetails')}
          className="mb-6 flex-row items-center justify-center rounded-xl border border-brand-500 bg-brand-50 px-4 py-3">
          <Ionicons name="sparkles-outline" size={18} color="#00A85A" style={{ marginRight: 8 }} />
          <Text className="font-semibold text-brand-700">
            {t('partnerApplication.useAccountDetails')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Full Name */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.fullName')} <Text className="text-red-500">*</Text>
        </Text>
        <View
          className={`flex-row items-center ${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <Ionicons
            name="person-outline"
            size={20}
            color={placeholderColor}
            style={{ marginRight: 12 }}
          />
          <TextInput
            className={`flex-1 ${inputText}`}
            placeholder={t('partnerApplication.fullNamePlaceholder')}
            placeholderTextColor={placeholderColor}
            value={formData.fullName}
            onChangeText={(text) => setFormData({ ...formData, fullName: text })}
          />
        </View>
      </View>

      {/* Email Address */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.emailAddress')} <Text className="text-red-500">*</Text>
        </Text>
        <View
          className={`flex-row items-center ${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <Ionicons
            name="mail-outline"
            size={20}
            color={placeholderColor}
            style={{ marginRight: 12 }}
          />
          <TextInput
            className={`flex-1 ${inputText}`}
            placeholder="john@example.com"
            placeholderTextColor={placeholderColor}
            keyboardType="email-address"
            autoCapitalize="none"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
          />
        </View>
      </View>

      {/* Phone Number */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.phoneNumber')} <Text className="text-red-500">*</Text>
        </Text>
        <PhoneInput
          value={formData.phone}
          onChangeText={(text) => setFormData((prev) => ({ ...prev, phone: text }))}
          onChangeCountry={(iso) => setFormData((prev) => ({ ...prev, country: iso }))}
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          inputBg={inputBg}
          inputText={inputText}
          borderColor={borderColor}
          placeholderColor={placeholderColor}
          cardBg={cardBg}
        />
      </View>

      {/* Street Address — picked on a map (same pattern as AccountScreen /
          BookService): the whole row opens the picker, which fills street/city/ZIP.
          Falls back to a plain text field when no map handler is wired. */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.streetAddress')} <Text className="text-red-500">*</Text>
        </Text>
        {onOpenAddressMap ? (
          <TouchableOpacity
            onPress={onOpenAddressMap}
            accessibilityRole="button"
            accessibilityLabel={t('partnerApplication.pickAddressOnMap')}
            className={`flex-row items-center ${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
            <Ionicons
              name="location-outline"
              size={20}
              color="#00C870"
              style={{ marginRight: 12 }}
            />
            <Text
              className={`flex-1 ${formData.streetAddress ? inputText : subtextColor}`}
              numberOfLines={2}>
              {formData.streetAddress || t('bookService.pickOnMap')}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={placeholderColor} />
          </TouchableOpacity>
        ) : (
          <View
            className={`flex-row items-center ${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
            <Ionicons
              name="location-outline"
              size={20}
              color={placeholderColor}
              style={{ marginRight: 12 }}
            />
            <TextInput
              className={`flex-1 ${inputText}`}
              placeholder={t('partnerApplication.streetPlaceholder')}
              placeholderTextColor={placeholderColor}
              value={formData.streetAddress}
              onChangeText={(text) => setFormData({ ...formData, streetAddress: text })}
            />
          </View>
        )}
        {onOpenAddressMap && (
          <Text className={`text-xs ${subtextColor} mt-1`}>{t('partnerApplication.mapHint')}</Text>
        )}
      </View>

      {/* City */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.city')} <Text className="text-red-500">*</Text>
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <TextInput
            className={inputText}
            placeholder={t('partnerApplication.cityPlaceholder')}
            placeholderTextColor={placeholderColor}
            value={formData.city}
            onChangeText={(text) => setFormData({ ...formData, city: text })}
          />
        </View>
      </View>

      {/* ZIP Code */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.zipCode')} <Text className="text-red-500">*</Text>
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <TextInput
            className={inputText}
            placeholder="11000"
            placeholderTextColor={placeholderColor}
            keyboardType="number-pad"
            maxLength={5}
            value={formData.zipCode}
            onChangeText={(text) => setFormData({ ...formData, zipCode: text })}
          />
        </View>
      </View>
    </View>
  );
}
