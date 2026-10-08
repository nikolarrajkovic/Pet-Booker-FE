import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PhoneInput from '../../../components/shared/PhoneInput';
import { useFormChain } from '../../../hooks/useFormChain';
import { useLocale } from '../../../context/LocaleContext';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
interface FormData {
  fullName: string;
  /** Optional: the name customers see. Empty means the partner is listed under their own name. */
  businessName: string;
  email: string;
  phone: string;
  country: string; // ISO code from the phone-number country picker
  streetAddress: string;
  city: string;
  zipCode: string;
  /** ServiceProviderType value — picked in step 2, declared here so the shared form shape matches. */
  serviceType: number | null;
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
  /**
   * The applicant's account address, formatted. When set, the business address is optional: left
   * empty, the partner's page uses the account address (and follows it when it changes).
   */
  accountAddressLabel?: string | null;
  /**
   * Shown under Business name: the server refused the name customers would see because another
   * partner has it (names are unique), so the applicant picks a business name of their own.
   */
  businessNameError?: string;
  /**
   * Advance to the next step. Wired to Enter on the step's last field, so the keyboard can carry
   * someone through the whole application without reaching for the Continue button.
   */
  onContinue?: () => void;
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
  accountAddressLabel,
  businessNameError,
  onContinue,
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
  // Without an account address to fall back on, the business address is what places the partner.
  const addressRequired = !accountAddressLabel;
  const requiredMark = addressRequired ? <Text className="text-red-500">*</Text> : null;
  // Phone is a composite control (dial-code dropdown + number), so it stays out of the chain;
  // Enter runs full name -> email -> street -> city -> ZIP and then continues to step 2.
  const form = useFormChain(
    ['fullName', 'businessName', 'email', 'streetAddress', 'city', 'zipCode'],
    () => onContinue?.()
  );

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
            {...form.field('fullName')}
            value={formData.fullName}
            onChangeText={(text) => setFormData({ ...formData, fullName: text })}
          />
        </View>
      </View>

      {/* Business name — optional; what customers see. Without it the partner is listed under
          their own name, which no longer has to be unique (two people can share a name). */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.businessName')}{' '}
          <Text className={`text-xs font-normal ${subtextColor}`}>{t('common.optional')}</Text>
        </Text>
        <View
          className={`flex-row items-center ${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <Ionicons
            name="storefront-outline"
            size={20}
            color={placeholderColor}
            style={{ marginRight: 12 }}
          />
          <TextInput
            className={`flex-1 ${inputText}`}
            placeholder={t('partnerApplication.businessNamePlaceholder')}
            placeholderTextColor={placeholderColor}
            accessibilityLabel={t('partnerApplication.businessName')}
            maxLength={200}
            {...form.field('businessName')}
            value={formData.businessName}
            onChangeText={(text) => setFormData({ ...formData, businessName: text })}
          />
        </View>
        <Text className={`mt-1 text-xs ${businessNameError ? 'text-red-500' : subtextColor}`}>
          {businessNameError || t('partnerApplication.businessNameHint')}
        </Text>
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
            placeholder={t('forgotPassword.emailPlaceholderExample')}
            placeholderTextColor={placeholderColor}
            keyboardType="email-address"
            autoCapitalize="none"
            {...form.field('email')}
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

      {/* Street Address — always TYPEABLE, with the map as a shortcut beside it.
          It used to be map-only whenever a picker handler was wired, and the text fallback
          rendered only when one was NOT. That made the map the single way to satisfy a required
          field, so anything that stops it loading — no Maps key, an exhausted quota, an outage, a
          blocked script — left the application impossible to finish, with no error explaining
          why. The map fills street/city/ZIP in one tap when it works; typing is the floor. */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.streetAddress')} {requiredMark}
        </Text>
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
            {...form.field('streetAddress')}
            value={formData.streetAddress}
            onChangeText={(text) => setFormData({ ...formData, streetAddress: text })}
          />
          {onOpenAddressMap ? (
            <TouchableOpacity
              onPress={onOpenAddressMap}
              accessibilityRole="button"
              accessibilityLabel={t('partnerApplication.pickAddressOnMap')}
              hitSlop={8}
              className="ml-2">
              <Ionicons name="map-outline" size={20} color={BRAND_GREEN} />
            </TouchableOpacity>
          ) : null}
        </View>
        {onOpenAddressMap && (
          <Text className={`text-xs ${subtextColor} mt-1`}>{t('partnerApplication.mapHint')}</Text>
        )}
        {accountAddressLabel ? (
          <Text className={`text-xs ${subtextColor} mt-1`}>
            {t('partnerApplication.addressOptionalHint', { address: accountAddressLabel })}
          </Text>
        ) : null}
      </View>

      {/* City */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.city')} {requiredMark}
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <TextInput
            className={inputText}
            placeholder={t('partnerApplication.cityPlaceholder')}
            placeholderTextColor={placeholderColor}
            {...form.field('city')}
            value={formData.city}
            onChangeText={(text) => setFormData({ ...formData, city: text })}
          />
        </View>
      </View>

      {/* ZIP Code */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.zipCode')} {requiredMark}
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <TextInput
            className={inputText}
            placeholder="11000"
            placeholderTextColor={placeholderColor}
            keyboardType="number-pad"
            maxLength={5}
            {...form.field('zipCode')}
            value={formData.zipCode}
            onChangeText={(text) => setFormData({ ...formData, zipCode: text })}
          />
        </View>
      </View>
    </View>
  );
}
