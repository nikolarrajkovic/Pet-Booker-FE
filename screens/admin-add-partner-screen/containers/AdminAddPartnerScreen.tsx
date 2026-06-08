import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PersonalInfoStep, ServiceInfoStep } from '../../partner-application-screen/components';

export default function AdminAddPartnerScreen() {
  const navigation = useNavigation();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    selectedServices: [] as string[],
    yearsOfExperience: '',
    aboutYou: '',
    certifications: '',
    availability: '',
  });

  const totalSteps = 2;
  const progressPercentage = (step / totalSteps) * 100;

  const themeProps = {
    isDarkMode,
    textColor,
    subtextColor,
    inputBg,
    inputText,
    borderColor,
    placeholderColor,
    cardBg,
  };

  const handleSubmit = () => {
    Alert.alert(
      'Partner Added',
      `${formData.fullName || 'Partner'} has been successfully added as a partner.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Add New Partner"
      headerSubtitle="Add partner details manually"
      contentBg={bgColor}
      contentRounded={false}
      headerChildren={
        <>
          <View className="mt-4 mb-2">
            <View className="h-2 bg-white/30 rounded-full overflow-hidden">
              <View
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </View>
          </View>
          <Text className="text-white text-sm">Step {step} of {totalSteps}</Text>
        </>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 100, paddingHorizontal: 24 }}
      >
        {step === 1 && (
          <PersonalInfoStep formData={formData} setFormData={setFormData} {...themeProps} />
        )}

        {step === 2 && (
          <ServiceInfoStep formData={formData} setFormData={setFormData} {...themeProps} />
        )}
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => {
            if (step < totalSteps) {
              setStep(step + 1);
            } else {
              handleSubmit();
            }
          }}
          className="bg-brand-500 py-4 rounded-2xl items-center"
        >
          <Text className="text-white text-lg font-bold">
            {step === totalSteps ? 'Add Partner' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
