import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';

const serviceTypes = [
  { id: 'dog-walking', label: 'Dog Walking' },
  { id: 'grooming', label: 'Grooming' },
  { id: 'pet-sitting', label: 'Pet Sitting' },
  { id: 'boarding', label: 'Boarding' },
  { id: 'training', label: 'Training' },
  { id: 'veterinary', label: 'Veterinary' },
];

export default function PartnerApplicationScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  
  const [step, setStep] = useState(1);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [governmentId, setGovernmentId] = useState<string | null>(null);
  const [insuranceCert, setInsuranceCert] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    // Step 1
    fullName: '',
    email: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    // Step 2
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
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (type === 'profile') {
        setProfilePhoto(uri);
      } else if (type === 'governmentId') {
        setGovernmentId(uri);
      } else {
        setInsuranceCert(uri);
      }
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
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (type === 'governmentId') {
        setGovernmentId(uri);
      } else {
        setInsuranceCert(uri);
      }
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

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Green Header with Progress */}
      <View className="bg-brand-500 px-6 pt-12 pb-6">
        <View className="flex-row items-center mb-6">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-4"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Partner Application</Text>
        </View>
        
        {/* Progress Bar */}
        <View className="mb-2">
          <View className="h-2 bg-white/30 rounded-full overflow-hidden">
            <View 
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </View>
        </View>
        <Text className="text-white text-sm">Step {step} of {totalSteps}</Text>
      </View>

      <ScrollView 
        className={`flex-1 ${bgColor}`}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 }}
      >
        {/* Step 1: Personal Information */}
        {step === 1 && (
          <View>
            <Text className={`text-xl font-bold ${textColor} mb-2`}>Personal Information</Text>
            <Text className={`text-sm ${subtextColor} mb-6`}>Tell us about yourself</Text>

            {/* Full Name */}
            <View className="mb-4">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                Full Name <Text className="text-red-500">*</Text>
              </Text>
              <View className={`flex-row items-center ${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <Ionicons name="person-outline" size={20} color={placeholderColor} style={{ marginRight: 12 }} />
                <TextInput
                  className={`flex-1 ${inputText}`}
                  placeholder="John Doe"
                  placeholderTextColor={placeholderColor}
                  value={formData.fullName}
                  onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                />
              </View>
            </View>

            {/* Email Address */}
            <View className="mb-4">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                Email Address <Text className="text-red-500">*</Text>
              </Text>
              <View className={`flex-row items-center ${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <Ionicons name="mail-outline" size={20} color={placeholderColor} style={{ marginRight: 12 }} />
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
                Phone Number <Text className="text-red-500">*</Text>
              </Text>
              <View className={`flex-row items-center ${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <Ionicons name="call-outline" size={20} color={placeholderColor} style={{ marginRight: 12 }} />
                <TextInput
                  className={`flex-1 ${inputText}`}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                />
              </View>
            </View>

            {/* Street Address */}
            <View className="mb-4">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                Street Address <Text className="text-red-500">*</Text>
              </Text>
              <View className={`flex-row items-center ${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <Ionicons name="location-outline" size={20} color={placeholderColor} style={{ marginRight: 12 }} />
                <TextInput
                  className={`flex-1 ${inputText}`}
                  placeholder="123 Main Street"
                  placeholderTextColor={placeholderColor}
                  value={formData.streetAddress}
                  onChangeText={(text) => setFormData({ ...formData, streetAddress: text })}
                />
              </View>
            </View>

            {/* City and State Row */}
            <View className="flex-row mb-4" style={{ gap: 12 }}>
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                  City <Text className="text-red-500">*</Text>
                </Text>
                <View className={`${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                  <TextInput
                    className={inputText}
                    placeholder="San Francisco"
                    placeholderTextColor={placeholderColor}
                    value={formData.city}
                    onChangeText={(text) => setFormData({ ...formData, city: text })}
                  />
                </View>
              </View>

              <View style={{ width: 100 }}>
                <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                  State <Text className="text-red-500">*</Text>
                </Text>
                <View className={`${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                  <TextInput
                    className={inputText}
                    placeholder="CA"
                    placeholderTextColor={placeholderColor}
                    maxLength={2}
                    autoCapitalize="characters"
                    value={formData.state}
                    onChangeText={(text) => setFormData({ ...formData, state: text })}
                  />
                </View>
              </View>
            </View>

            {/* ZIP Code */}
            <View className="mb-4">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                ZIP Code <Text className="text-red-500">*</Text>
              </Text>
              <View className={`${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <TextInput
                  className={inputText}
                  placeholder="94102"
                  placeholderTextColor={placeholderColor}
                  keyboardType="number-pad"
                  maxLength={5}
                  value={formData.zipCode}
                  onChangeText={(text) => setFormData({ ...formData, zipCode: text })}
                />
              </View>
            </View>
          </View>
        )}

        {/* Placeholder for Step 2 and 3 */}
        {step === 2 && (
          <View>
            <Text className={`text-xl font-bold ${textColor} mb-2`}>Service Information</Text>
            <Text className={`text-sm ${subtextColor} mb-6`}>What services do you offer?</Text>

            {/* Service Types */}
            <View className="mb-6">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                Service Types <Text className="text-red-500">*</Text>
              </Text>
              <Text className={`text-xs ${subtextColor} mb-3`}>Select all that apply</Text>
              
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {serviceTypes.map((service) => {
                  const isSelected = formData.selectedServices.includes(service.id);
                  return (
                    <TouchableOpacity
                      key={service.id}
                      onPress={() => {
                        if (isSelected) {
                          setFormData({
                            ...formData,
                            selectedServices: formData.selectedServices.filter(s => s !== service.id)
                          });
                        } else {
                          setFormData({
                            ...formData,
                            selectedServices: [...formData.selectedServices, service.id]
                          });
                        }
                      }}
                      className={`px-6 py-3 rounded-xl border-2 ${
                        isSelected 
                          ? 'bg-brand-500 border-brand-500' 
                          : `${inputBg} ${borderColor}`
                      }`}
                    >
                      <Text className={`font-medium ${isSelected ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {service.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Years of Experience */}
            <View className="mb-6">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                Years of Experience <Text className="text-red-500">*</Text>
              </Text>
              <View className={`flex-row items-center ${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <Ionicons name="briefcase-outline" size={20} color={placeholderColor} style={{ marginRight: 12 }} />
                <TextInput
                  className={`flex-1 ${inputText}`}
                  placeholder="5 years"
                  placeholderTextColor={placeholderColor}
                  value={formData.yearsOfExperience}
                  onChangeText={(text) => setFormData({ ...formData, yearsOfExperience: text })}
                />
              </View>
            </View>

            {/* About You */}
            <View className="mb-6">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>
                About You <Text className="text-red-500">*</Text>
              </Text>
              <Text className={`text-xs ${subtextColor} mb-3`}>Tell pet owners why they should choose you</Text>
              <View className={`${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <TextInput
                  className={inputText}
                  placeholder="I'm a passionate pet lover with over 5 years of experience..."
                  placeholderTextColor={placeholderColor}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={formData.aboutYou}
                  onChangeText={(text) => setFormData({ ...formData, aboutYou: text })}
                />
              </View>
            </View>

            {/* Certifications */}
            <View className="mb-6">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>Certifications</Text>
              <Text className={`text-xs ${subtextColor} mb-3`}>List any relevant certifications or training</Text>
              <View className={`${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <TextInput
                  className={inputText}
                  placeholder="Certified Professional Dog Trainer, Pet First Aid..."
                  placeholderTextColor={placeholderColor}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={formData.certifications}
                  onChangeText={(text) => setFormData({ ...formData, certifications: text })}
                />
              </View>
            </View>

            {/* Availability */}
            <View className="mb-4">
              <Text className={`text-sm font-semibold ${textColor} mb-2`}>Availability</Text>
              <Text className={`text-xs ${subtextColor} mb-3`}>When are you typically available?</Text>
              <View className={`${inputBg} rounded-xl px-4 py-3 border ${borderColor}`}>
                <TextInput
                  className={inputText}
                  placeholder="Monday-Friday: 9am-6pm, Weekends: Flexible"
                  placeholderTextColor={placeholderColor}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  value={formData.availability}
                  onChangeText={(text) => setFormData({ ...formData, availability: text })}
                />
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text className={`text-xl font-bold ${textColor} mb-2`}>Documents & Verification</Text>
            <Text className={`text-sm ${subtextColor} mb-6`}>Upload required documents</Text>

            {/* Profile Photo */}
            <View className={`${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-8 mb-4 items-center`}>
              {profilePhoto ? (
                <>
                  <Image source={{ uri: profilePhoto }} className="w-32 h-32 rounded-full mb-4" />
                  <Text className={`text-sm ${subtextColor} mb-2`}>Profile photo selected</Text>
                </>
              ) : (
                <>
                  <View className={`w-20 h-20 ${inputBg} rounded-full items-center justify-center mb-4`}>
                    <Ionicons name="camera-outline" size={40} color={placeholderColor} />
                  </View>
                  <Text className={`text-base font-semibold ${textColor} mb-1`}>
                    Profile Photo <Text className="text-red-500">*</Text>
                  </Text>
                  <Text className={`text-xs ${subtextColor} mb-4 text-center`}>Upload a professional photo</Text>
                </>
              )}
              <TouchableOpacity 
                onPress={() => pickImage('profile')}
                className={`${inputBg} px-6 py-3 rounded-xl flex-row items-center border ${borderColor}`}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#00C870" style={{ marginRight: 8 }} />
                <Text className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{profilePhoto ? 'Change Photo' : 'Choose Photo'}</Text>
              </TouchableOpacity>
            </View>

            {/* Government ID */}
            <View className={`${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-8 mb-4 items-center`}>
              {governmentId ? (
                <>
                  {governmentId.endsWith('.pdf') ? (
                    <View className={`w-20 h-20 ${inputBg} rounded-xl items-center justify-center mb-4`}>
                      <Ionicons name="document-text" size={40} color="#00C870" />
                    </View>
                  ) : (
                    <Image source={{ uri: governmentId }} className="w-full h-40 rounded-xl mb-4" resizeMode="contain" />
                  )}
                  <Text className={`text-sm ${subtextColor} mb-2`}>Document uploaded</Text>
                </>
              ) : (
                <>
                  <View className={`w-20 h-20 ${inputBg} rounded-full items-center justify-center mb-4`}>
                    <Ionicons name="document-outline" size={40} color={placeholderColor} />
                  </View>
                  <Text className={`text-base font-semibold ${textColor} mb-1`}>
                    Government ID <Text className="text-red-500">*</Text>
                  </Text>
                  <Text className={`text-xs ${subtextColor} mb-4 text-center`}>Driver's license or passport</Text>
                </>
              )}
              <TouchableOpacity 
                onPress={() => pickDocument('governmentId')}
                className={`${inputBg} px-6 py-3 rounded-xl flex-row items-center border ${borderColor}`}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#00C870" style={{ marginRight: 8 }} />
                <Text className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{governmentId ? 'Change Document' : 'Upload Document'}</Text>
              </TouchableOpacity>
            </View>

            {/* Insurance Certificate */}
            <View className={`${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-8 mb-6 items-center`}>
              {insuranceCert ? (
                <>
                  {insuranceCert.endsWith('.pdf') ? (
                    <View className={`w-20 h-20 ${inputBg} rounded-xl items-center justify-center mb-4`}>
                      <Ionicons name="document-text" size={40} color="#00C870" />
                    </View>
                  ) : (
                    <Image source={{ uri: insuranceCert }} className="w-full h-40 rounded-xl mb-4" resizeMode="contain" />
                  )}
                  <Text className={`text-sm ${subtextColor} mb-2`}>Document uploaded</Text>
                </>
              ) : (
                <>
                  <View className={`w-20 h-20 ${inputBg} rounded-full items-center justify-center mb-4`}>
                    <Ionicons name="document-outline" size={40} color={placeholderColor} />
                  </View>
                  <Text className={`text-base font-semibold ${textColor} mb-1`}>Insurance Certificate</Text>
                  <Text className={`text-xs ${subtextColor} mb-4 text-center`}>Proof of liability insurance (optional)</Text>
                </>
              )}
              <TouchableOpacity 
                onPress={() => pickDocument('insurance')}
                className={`${inputBg} px-6 py-3 rounded-xl flex-row items-center border ${borderColor}`}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#00C870" style={{ marginRight: 8 }} />
                <Text className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{insuranceCert ? 'Change Document' : 'Upload Document'}</Text>
              </TouchableOpacity>
            </View>

            {/* Background Check Notice */}
            <View className={`${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-2xl p-4 border ${isDarkMode ? 'border-blue-800' : 'border-blue-200'}`}>
              <Text className={`text-sm font-semibold ${isDarkMode ? 'text-blue-200' : 'text-blue-900'} mb-2`}>
                Background Check
              </Text>
              <Text className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-700'} leading-5`}>
                A background check will be conducted as part of the approval process. This helps ensure the safety of all pets and pet owners on our platform.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => {
            if (step < totalSteps) {
              setStep(step + 1);
            } else {
              // Submit application
              (navigation as any).navigate('ApplicationSubmitted');
            }
          }}
          className="bg-brand-500 py-4 rounded-2xl items-center"
        >
          <Text className="text-white text-lg font-bold">
            {step === totalSteps ? 'Submit Application' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
