import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import ServiceTypePicker from '../../../components/shared/ServiceTypePicker';
import { useFormChain } from '../../../hooks/useFormChain';
import type { ApplicationErrors, ApplicationField } from '../applicationValidation';

interface FormData {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  country: string;
  streetAddress: string;
  city: string;
  zipCode: string;
  /** ServiceProviderType values — every kind of service they offer, none picked to begin with. */
  serviceTypes: number[];
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
  /** The application asks why they want to partner; a partner the admin adds is not asked. */
  showMotivation?: boolean;
  /** What Continue found missing: those fields get a red outline and the reason under them. */
  errors?: ApplicationErrors;
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
  showMotivation = true,
  errors,
}: ServiceInfoStepProps) {
  const { t } = useLocale();
  const border = (field: ApplicationField) => (errors?.[field] ? 'border-red-500' : borderColor);
  const fieldError = (field: ApplicationField) =>
    errors?.[field] ? (
      <Text className="mt-1 text-xs text-red-500">{t(errors[field] as any)}</Text>
    ) : null;

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

      {/* The kinds of service offered — several, since each service they add later picks one
          and prices it on its own (app review G13). */}
      <View className="mb-6">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.serviceTypesLabel')} <Text className="text-red-500">*</Text>
        </Text>
        <Text className={`text-xs ${subtextColor} mb-3`}>
          {t('partnerApplication.pickServiceType')}
        </Text>

        <ServiceTypePicker
          selected={formData.serviceTypes}
          onChange={(serviceTypes) => setFormData({ ...formData, serviceTypes })}
          invalid={!!errors?.serviceTypes}
        />
        {fieldError('serviceTypes')}
      </View>

      {/* Years of Experience */}
      <View className="mb-6">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.yearsOfExperience')} <Text className="text-red-500">*</Text>
        </Text>
        <View
          className={`flex-row items-center ${inputBg} rounded-xl border px-4 py-3 ${border('yearsOfExperience')}`}>
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
        {fieldError('yearsOfExperience')}
      </View>

      {/* About Me */}
      <View className="mb-6">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          {t('partnerApplication.aboutMe')} <Text className="text-red-500">*</Text>
        </Text>
        <Text className={`text-xs ${subtextColor} mb-3`}>
          {t('partnerApplication.aboutMeHint')}
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${border('aboutYou')}`}>
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
        {fieldError('aboutYou')}
      </View>

      {/* Motivation for Work */}
      {showMotivation && (
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>
            {t('partnerApplication.motivation')} <Text className="text-red-500">*</Text>
          </Text>
          <Text className={`text-xs ${subtextColor} mb-3`}>
            {t('partnerApplication.motivationHint')}
          </Text>
          <View className={`${inputBg} rounded-xl border px-4 py-3 ${border('motivation')}`}>
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
          {fieldError('motivation')}
        </View>
      )}
    </View>
  );
}
