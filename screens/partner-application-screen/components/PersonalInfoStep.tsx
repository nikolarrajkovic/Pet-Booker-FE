import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  selectedServices: string[];
  yearsOfExperience: string;
  aboutYou: string;
  certifications: string;
  availability: string;
}

interface PersonalInfoStepProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  textColor: string;
  subtextColor: string;
  inputBg: string;
  inputText: string;
  borderColor: string;
  placeholderColor: string;
}

export default function PersonalInfoStep({
  formData,
  setFormData,
  textColor,
  subtextColor,
  inputBg,
  inputText,
  borderColor,
  placeholderColor,
}: PersonalInfoStepProps) {
  return (
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
  );
}
