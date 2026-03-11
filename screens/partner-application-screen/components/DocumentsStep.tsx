import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DocumentsStepProps {
  profilePhoto: string | null;
  governmentId: string | null;
  insuranceCert: string | null;
  pickImage: (type: 'profile' | 'governmentId' | 'insurance') => void;
  pickDocument: (type: 'governmentId' | 'insurance') => void;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  inputBg: string;
  cardBg: string;
  borderColor: string;
  placeholderColor: string;
}

export default function DocumentsStep({
  profilePhoto,
  governmentId,
  insuranceCert,
  pickImage,
  pickDocument,
  isDarkMode,
  textColor,
  subtextColor,
  inputBg,
  cardBg,
  borderColor,
  placeholderColor,
}: DocumentsStepProps) {
  return (
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
  );
}
