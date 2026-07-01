import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const serviceTypes = [
  { id: 'dog-walking', label: 'Dog Walking' },
  { id: 'grooming', label: 'Grooming' },
  { id: 'pet-sitting', label: 'Pet Sitting' },
  { id: 'boarding', label: 'Boarding' },
  { id: 'training', label: 'Training' },
  { id: 'veterinary', label: 'Veterinary' },
];

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  streetAddress: string;
  city: string;
  zipCode: string;
  selectedServices: string[];
  yearsOfExperience: string;
  aboutYou: string;
  motivation: string;
}

interface ServiceInfoStepProps {
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
  isDarkMode,
  textColor,
  subtextColor,
  inputBg,
  inputText,
  borderColor,
  placeholderColor,
}: ServiceInfoStepProps) {
  return (
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
                      selectedServices: formData.selectedServices.filter((s) => s !== service.id),
                    });
                  } else {
                    setFormData({
                      ...formData,
                      selectedServices: [...formData.selectedServices, service.id],
                    });
                  }
                }}
                className={`rounded-xl border-2 px-6 py-3 ${
                  isSelected ? 'border-brand-500 bg-brand-500' : `${inputBg} ${borderColor}`
                }`}>
                <Text
                  className={`font-medium ${isSelected ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
            placeholder="5 years"
            placeholderTextColor={placeholderColor}
            value={formData.yearsOfExperience}
            onChangeText={(text) => setFormData({ ...formData, yearsOfExperience: text })}
          />
        </View>
      </View>

      {/* About Me */}
      <View className="mb-6">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          About Me <Text className="text-red-500">*</Text>
        </Text>
        <Text className={`text-xs ${subtextColor} mb-3`}>
          Tell pet owners about yourself and why they should choose you
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
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

      {/* Motivation for Work */}
      <View className="mb-4">
        <Text className={`text-sm font-semibold ${textColor} mb-2`}>
          Motivation for Work <Text className="text-red-500">*</Text>
        </Text>
        <Text className={`text-xs ${subtextColor} mb-3`}>
          What motivates you to care for pets?
        </Text>
        <View className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor}`}>
          <TextInput
            className={inputText}
            placeholder="I love building trust with animals and giving owners peace of mind..."
            placeholderTextColor={placeholderColor}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={formData.motivation}
            onChangeText={(text) => setFormData({ ...formData, motivation: text })}
          />
        </View>
      </View>
    </View>
  );
}
