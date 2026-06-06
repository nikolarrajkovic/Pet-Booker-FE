import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PersonalInfoStep, ServiceInfoStep, DocumentsStep } from '../components';
import { createServiceProvider } from '../../../services/service-providers';

export default function PartnerApplicationScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [governmentId, setGovernmentId] = useState<string | null>(null);
  const [insuranceCert, setInsuranceCert] = useState<string | null>(null);

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

  const pickImage = async (type: 'profile' | 'governmentId' | 'insurance') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: type === 'profile',
      aspect: type === 'profile' ? [1, 1] : undefined,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri =
        asset.base64
          ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
      if (type === 'profile') setProfilePhoto(uri);
      else if (type === 'governmentId') setGovernmentId(uri);
      else setInsuranceCert(uri);
    }
  };

  const pickDocument = async (type: 'governmentId' | 'insurance') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri =
        asset.base64
          ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
      if (type === 'governmentId') setGovernmentId(uri);
      else setInsuranceCert(uri);
    }
  };

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const inputBg = isDarkMode ? 'bg-[#243447]' : 'bg-gray-50';
  const inputText = isDarkMode ? 'text-white' : 'text-gray-900';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const placeholderColor = isDarkMode ? '#9CA3AF' : '#6B7280';

  const totalSteps = 3;
  const progressPercentage = (step / totalSteps) * 100;

  const themeProps = { isDarkMode, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor, cardBg };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Partner Application"
      contentBg={bgColor}
      contentRounded={false}
      headerChildren={
        <>
          {/* Progress Bar */}
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

        {step === 3 && (
          <DocumentsStep
            profilePhoto={profilePhoto}
            governmentId={governmentId}
            insuranceCert={insuranceCert}
            pickImage={pickImage}
            pickDocument={pickDocument}
            {...themeProps}
          />
        )}
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          disabled={isSubmitting}
          onPress={async () => {
            if (step < totalSteps) {
              setStep(step + 1);
              return;
            }

            setIsSubmitting(true);
            try {
              await createServiceProvider(formData);
              (navigation as any).navigate('ApplicationSubmitted');
            } catch (error: any) {
              Alert.alert('Submission Failed', error?.message ?? 'Something went wrong. Please try again.');
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="bg-brand-500 py-4 rounded-2xl items-center"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-bold">
              {step === totalSteps ? 'Submit Application' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
