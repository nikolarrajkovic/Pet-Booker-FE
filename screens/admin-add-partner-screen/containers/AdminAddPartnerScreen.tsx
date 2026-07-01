import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocation } from '../../../hooks/useLocation';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import MapAddressPicker from '../../../components/shared/MapAddressPicker';
import { AddressDto } from '../../../services/service-providers';
import { PersonalInfoStep, ServiceInfoStep } from '../../partner-application-screen/components';

export default function AdminAddPartnerScreen() {
  const navigation = useNavigation();
  const location = useLocation();
  const {
    isDarkMode,
    bgColor,
    cardBg,
    textColor,
    subtextColor,
    inputBg,
    inputText,
    borderColor,
    placeholderColor,
  } = useThemeColors();

  const [step, setStep] = useState(1);
  const [addressPickerVisible, setAddressPickerVisible] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    streetAddress: '',
    city: '',
    zipCode: '',
    selectedServices: [] as string[],
    yearsOfExperience: '',
    aboutYou: '',
    motivation: '',
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

  // Fill the address fields from a pin dropped on the map (city/ZIP stay editable).
  const onSelectAddressFromMap = (picked: AddressDto) => {
    setFormData((prev) => ({
      ...prev,
      streetAddress: picked.line1 || prev.streetAddress,
      city: picked.city || prev.city,
      zipCode: picked.postalCode || prev.zipCode,
    }));
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
          <View className="mb-2 mt-4">
            <View className="h-2 overflow-hidden rounded-full bg-white/30">
              <View
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </View>
          </View>
          <Text className="text-sm text-white">
            Step {step} of {totalSteps}
          </Text>
        </>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 100, paddingHorizontal: 24 }}>
        {step === 1 && (
          <PersonalInfoStep
            formData={formData}
            setFormData={setFormData}
            onOpenAddressMap={() => setAddressPickerVisible(true)}
            {...themeProps}
          />
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
          className="items-center rounded-2xl bg-brand-500 py-4">
          <Text className="text-lg font-bold text-white">
            {step === totalSteps ? 'Add Partner' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map picker for the street address — opens on the current location */}
      {addressPickerVisible && (
        <MapAddressPicker
          visible
          title="Partner address"
          initialRegion={{ latitude: location.latitude, longitude: location.longitude }}
          isDarkMode={isDarkMode}
          onClose={() => setAddressPickerVisible(false)}
          onSelect={(picked) => onSelectAddressFromMap(picked)}
        />
      )}
    </ScreenLayout>
  );
}
