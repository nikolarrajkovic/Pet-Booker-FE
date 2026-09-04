import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import { useEnums } from '../../../context/EnumsContext';
import type { EnumEntry } from '../../../services/enums';
import { PROVIDER_TYPE_LABELS } from '../../../services/service-providers';
import { useFormChain } from '../../../hooks/useFormChain';

// The provider's type is the ServiceProviderType enum — the same value every other screen
// filters and labels by. It used to be a local list of six invented ids
// ('dog-walking', 'training', 'veterinary'), which matched no enum member, left
// Transporter/PetHotel unreachable, and was dropped on submit in favour of a hardcoded
// type: 0 — so every application was filed as a Sitter.
//
// Fallback for the brief window before /enums resolves (and if it fails outright): the
// static labels, so the applicant is never shown an empty required field. tEnum still
// localizes whichever list we render.
const FALLBACK_TYPE_ENTRIES: EnumEntry[] = Object.keys(PROVIDER_TYPE_LABELS).map((value) => ({
  value: Number(value),
  name: PROVIDER_TYPE_LABELS[Number(value)],
}));

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  streetAddress: string;
  city: string;
  zipCode: string;
  /** ServiceProviderType value — null until the applicant picks one. */
  serviceType: number | null;
  yearsOfExperience: string;
  aboutYou: string;
  motivation: string;
}

interface ServiceInfoStepProps {
  /** Advance to the next step — wired to Enter on the step's last single-line field. */
  onContinue?: () => void;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  inputBg: string;
  inputText: string;
  borderColor: string;
  placeholderColor: string;
}

export default function ServiceInfoStep({
  formData,
  setFormData,
  onContinue,
  isDarkMode,
  textColor,
  subtextColor,
  inputBg,
  inputText,
  borderColor,
  placeholderColor,
}: ServiceInfoStepProps) {
  const { t, tEnum } = useLocale();
  const { enums } = useEnums();
  const typeEntries = enums?.serviceProviderType?.length
    ? enums.serviceProviderType
    : FALLBACK_TYPE_ENTRIES;

  // "About you" and "Motivation" are text areas, so Enter must make a paragraph break in them
  // rather than jumping the user to the next step mid-sentence. Only the years-of-experience
  // field advances, and the step is submitted with the Continue button.
  const form = useFormChain(
    [
      'yearsOfExperience',
      { name: 'aboutYou', multiline: true },
      { name: 'motivation', multiline: true },
    ],
    () => onContinue?.()
  );

  return (
    <View>
      <Text className={`text-xl font-bold ${textColor} mb-2`}>
        {t('partnerApplication.serviceInfo')}
      </Text>
      <Text className={`text-sm ${subtextColor} mb-6`}>{t('partnerApplication.whatServices')}</Text>

      {/* Service Type — one per provider, so this is a single choice, not a multi-select */}
      <View className="mb-6">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.serviceTypesLabel')} <Text className="text-red-500">*</Text>
        </Text>
        <Text className={`text-xs ${subtextColor} mb-3`}>
          {t('partnerApplication.pickServiceType')}
        </Text>

        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {typeEntries.map((entry) => {
            const isSelected = formData.serviceType === entry.value;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={entry.value}
                onPress={() => setFormData({ ...formData, serviceType: entry.value })}
                className={`rounded-xl border-2 px-6 py-3 ${
                  isSelected ? 'border-brand-500 bg-brand-500' : `${inputBg} ${borderColor}`
                }`}>
                <Text
                  className={`font-medium ${isSelected ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {tEnum('serviceProviderType', entry.value, entry.displayName ?? entry.name)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Years of Experience */}
      <View className="mb-6">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.yearsOfExperience')} <Text className="text-red-500">*</Text>
        </Text>
        <View
          className={`flex-row items-center ${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <Ionicons
            name="briefcase-outline"
            size={20}
            color={placeholderColor}
            style={{ marginRight: 12 }}
          />
          <TextInput
            className={`flex-1 ${inputText}`}
            placeholder={t('partnerApplication.yearsPlaceholder')}
            placeholderTextColor={placeholderColor}
            {...form.field('yearsOfExperience')}
            value={formData.yearsOfExperience}
            onChangeText={(text) => setFormData({ ...formData, yearsOfExperience: text })}
          />
        </View>
      </View>

      {/* About Me */}
      <View className="mb-6">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.aboutMe')} <Text className="text-red-500">*</Text>
        </Text>
        <Text className={`text-xs ${subtextColor} mb-3`}>
          {t('partnerApplication.aboutMeHint')}
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <TextInput
            className={inputText}
            placeholder={t('partnerApplication.aboutMePlaceholder')}
            placeholderTextColor={placeholderColor}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            {...form.field('aboutYou')}
            value={formData.aboutYou}
            onChangeText={(text) => setFormData({ ...formData, aboutYou: text })}
          />
        </View>
      </View>

      {/* Motivation for Work */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.motivation')} <Text className="text-red-500">*</Text>
        </Text>
        <Text className={`text-xs ${subtextColor} mb-3`}>
          {t('partnerApplication.motivationHint')}
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <TextInput
            className={inputText}
            placeholder={t('partnerApplication.motivationPlaceholder')}
            placeholderTextColor={placeholderColor}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            {...form.field('motivation')}
            value={formData.motivation}
            onChangeText={(text) => setFormData({ ...formData, motivation: text })}
          />
        </View>
      </View>
    </View>
  );
}
