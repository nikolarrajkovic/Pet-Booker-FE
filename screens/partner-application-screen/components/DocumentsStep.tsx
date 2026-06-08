import React from 'react';
import { View, Text, TouchableOpacity, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type DocumentFile = { uri: string; fileName?: string };
export type CertificateEntry = { uri: string; fileName?: string; issuer: string; issuedDate: string };

interface DocumentsStepProps {
  profilePhoto: string | null;
  petPhotos: Array<string | null>;
  governmentIdFront: string | null;
  governmentIdBack: string | null;
  certificates: CertificateEntry[];
  pickImage: (type: 'profile') => void;
  pickPetPhoto: (slotIndex: number) => void;
  pickDocument: (type: 'governmentIdFront' | 'governmentIdBack' | 'certificate') => void;
  onRemoveCertificate: (index: number) => void;
  onUpdateCertificate: (index: number, field: 'issuer' | 'issuedDate', value: string) => void;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  inputBg: string;
  inputText: string;
  cardBg: string;
  borderColor: string;
  placeholderColor: string;
}

function isPdf(uri: string) {
  return uri.toLowerCase().includes('application/pdf') || uri.toLowerCase().endsWith('.pdf');
}

function DocPreview({ uri, inputBg }: { uri: string; inputBg: string }) {
  if (isPdf(uri)) {
    return (
      <View className={`w-full h-20 ${inputBg} rounded-xl items-center justify-center mb-3`}>
        <Ionicons name="document-text" size={32} color="#00C870" />
        <Text className="text-xs text-gray-400 mt-1">PDF</Text>
      </View>
    );
  }
  return <Image source={{ uri }} className="w-full h-20 rounded-xl mb-3" resizeMode="cover" />;
}

export default function DocumentsStep({
  profilePhoto,
  petPhotos,
  governmentIdFront,
  governmentIdBack,
  certificates,
  pickImage,
  pickPetPhoto,
  pickDocument,
  onRemoveCertificate,
  onUpdateCertificate,
  isDarkMode,
  textColor,
  subtextColor,
  inputBg,
  inputText,
  cardBg,
  borderColor,
  placeholderColor,
}: DocumentsStepProps) {
  const uploadBtn = (label: string, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      className={`${inputBg} px-4 py-3 rounded-xl flex-row items-center justify-center border ${borderColor}`}
      activeOpacity={0.7}
    >
      <Ionicons name="cloud-upload-outline" size={18} color="#00C870" style={{ marginRight: 6 }} />
      <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <Text className={`text-xl font-bold ${textColor} mb-2`}>Documents & Verification</Text>
      <Text className={`text-sm ${subtextColor} mb-6`}>Upload required documents</Text>

      {/* Profile Photo */}
      <View className={`${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-6 mb-4 items-center`}>
        {profilePhoto ? (
          <Image source={{ uri: profilePhoto }} className="w-24 h-24 rounded-full mb-3" />
        ) : (
          <>
            <View className={`w-16 h-16 ${inputBg} rounded-full items-center justify-center mb-3`}>
              <Ionicons name="camera-outline" size={32} color={placeholderColor} />
            </View>
            <Text className={`text-sm font-semibold ${textColor} mb-1`}>
              Profile Photo <Text className="text-red-500">*</Text>
            </Text>
            <Text className={`text-xs ${subtextColor} mb-3 text-center`}>Upload a professional photo</Text>
          </>
        )}
        {uploadBtn(profilePhoto ? 'Change Photo' : 'Choose Photo', () => pickImage('profile'))}
      </View>

      {/* Photos with pets — 3 slots */}
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>Photos with Pets</Text>
      <Text className={`text-xs ${subtextColor} mb-3`}>Upload 3 photos of yourself with different pets</Text>
      <View className="flex-row gap-3 mb-6">
        {petPhotos.map((photo, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => pickPetPhoto(index)}
            activeOpacity={0.7}
            className={`flex-1 ${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-3 items-center`}
          >
            {photo ? (
              <Image source={{ uri: photo }} className="w-full h-20 rounded-xl mb-2" resizeMode="cover" />
            ) : (
              <View className={`w-full h-20 ${inputBg} rounded-xl items-center justify-center mb-2`}>
                <Ionicons name="paw-outline" size={28} color={placeholderColor} />
              </View>
            )}
            <Text className={`text-xs ${subtextColor} text-center`}>{photo ? 'Change' : `Photo ${index + 1}`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Government ID — front + back */}
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>
        Government ID <Text className="text-red-500">*</Text>
      </Text>
      <View className="flex-row gap-3 mb-6">
        {/* Front */}
        <View className={`flex-1 ${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-4`}>
          <Text className={`text-xs font-semibold ${subtextColor} mb-2 text-center`}>Front</Text>
          {governmentIdFront
            ? <DocPreview uri={governmentIdFront} inputBg={inputBg} />
            : (
              <View className={`h-20 ${inputBg} rounded-xl items-center justify-center mb-3`}>
                <Ionicons name="card-outline" size={32} color={placeholderColor} />
              </View>
            )}
          {uploadBtn(governmentIdFront ? 'Change' : 'Upload', () => pickDocument('governmentIdFront'))}
        </View>

        {/* Back */}
        <View className={`flex-1 ${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-4`}>
          <Text className={`text-xs font-semibold ${subtextColor} mb-2 text-center`}>Back</Text>
          {governmentIdBack
            ? <DocPreview uri={governmentIdBack} inputBg={inputBg} />
            : (
              <View className={`h-20 ${inputBg} rounded-xl items-center justify-center mb-3`}>
                <Ionicons name="card-outline" size={32} color={placeholderColor} />
              </View>
            )}
          {uploadBtn(governmentIdBack ? 'Change' : 'Upload', () => pickDocument('governmentIdBack'))}
        </View>
      </View>

      {/* Certificates */}
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>Certificates</Text>

      {certificates.map((cert, index) => (
        <View
          key={index}
          className={`${cardBg} border ${borderColor} rounded-2xl p-4 mb-4`}
        >
          {/* Header row */}
          <View className="flex-row items-center mb-3">
            <View className={`w-10 h-10 ${inputBg} rounded-xl items-center justify-center mr-3`}>
              {isPdf(cert.uri)
                ? <Ionicons name="document-text" size={20} color="#00C870" />
                : <Ionicons name="image-outline" size={20} color="#00C870" />}
            </View>
            <Text className={`flex-1 text-sm font-semibold ${textColor}`} numberOfLines={1}>
              {cert.fileName ?? `Certificate ${index + 1}`}
            </Text>
            <TouchableOpacity onPress={() => onRemoveCertificate(index)} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* File preview */}
          <DocPreview uri={cert.uri} inputBg={inputBg} />

          {/* Issued by */}
          <Text className={`text-xs font-semibold ${subtextColor} mb-1`}>Issued by</Text>
          <TextInput
            value={cert.issuer}
            onChangeText={(v) => onUpdateCertificate(index, 'issuer', v)}
            placeholder="e.g. Veterinary Board"
            placeholderTextColor={placeholderColor}
            className={`${inputBg} rounded-xl px-3 py-2 ${inputText} text-sm mb-3`}
          />

          {/* Issued date */}
          <Text className={`text-xs font-semibold ${subtextColor} mb-1`}>Issued date</Text>
          <TextInput
            value={cert.issuedDate}
            onChangeText={(v) => onUpdateCertificate(index, 'issuedDate', v)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={placeholderColor}
            className={`${inputBg} rounded-xl px-3 py-2 ${inputText} text-sm`}
          />
        </View>
      ))}

      <TouchableOpacity
        onPress={() => pickDocument('certificate')}
        className={`${inputBg} border-2 border-dashed ${borderColor} rounded-2xl p-4 flex-row items-center justify-center mb-6`}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={20} color="#00C870" style={{ marginRight: 8 }} />
        <Text className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Add Certificate
        </Text>
      </TouchableOpacity>

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
