import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from '../../../components/shared/DatePicker';
import { useLocale } from '../../../context/LocaleContext';

export type DocumentFile = { uri: string; fileName?: string };
export type CertificateEntry = {
  uri: string;
  fileName?: string;
  issuer: string;
  issuedDate: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → "YYYY-MM-DD" (the stored issuedDate format). */
const fmtISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "YYYY-MM-DD" → Date for the picker; falls back to today when empty/invalid. */
const parseISO = (s: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

interface DocumentsStepProps {
  profilePhoto: string | null;
  petPhotos: (string | null)[];
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
      <View className={`h-20 w-full ${inputBg} mb-3 items-center justify-center rounded-xl`}>
        <Ionicons name="document-text" size={32} color="#00C870" />
        <Text className="mt-1 text-xs text-gray-400">PDF</Text>
      </View>
    );
  }
  return <Image source={{ uri }} className="mb-3 h-20 w-full rounded-xl" resizeMode="cover" />;
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
  const { t } = useLocale();
  const [openDateIndex, setOpenDateIndex] = useState<number | null>(null);
  const today = new Date();

  const uploadBtn = (label: string, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      className={`${inputBg} flex-row items-center justify-center rounded-xl border px-4 py-3 ${borderColor}`}
      activeOpacity={0.7}>
      <Ionicons name="cloud-upload-outline" size={18} color="#00C870" style={{ marginRight: 6 }} />
      <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <Text className={`text-xl font-bold ${textColor} mb-2`}>
        {t('partnerApplication.documentsTitle')}
      </Text>
      <Text className={`text-sm ${subtextColor} mb-6`}>
        {t('partnerApplication.documentsSubtitle')}
      </Text>

      {/* Profile Photo */}
      <View
        className={`${cardBg} border-2 border-dashed ${borderColor} mb-4 items-center rounded-2xl p-6`}>
        {profilePhoto ? (
          <Image source={{ uri: profilePhoto }} className="mb-3 h-24 w-24 rounded-full" />
        ) : (
          <>
            <View className={`h-16 w-16 ${inputBg} mb-3 items-center justify-center rounded-full`}>
              <Ionicons name="camera-outline" size={32} color={placeholderColor} />
            </View>
            <Text className={`text-sm font-semibold ${textColor} mb-1`}>
              {t('partnerApplication.profilePhoto')} <Text className="text-red-500">*</Text>
            </Text>
            <Text className={`text-xs ${subtextColor} mb-3 text-center`}>
              {t('partnerApplication.professionalPhoto')}
            </Text>
          </>
        )}
        {uploadBtn(
          profilePhoto ? t('partnerApplication.changePhoto') : t('partnerApplication.choosePhoto'),
          () => pickImage('profile')
        )}
      </View>

      {/* Photos with pets — 3 slots */}
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>
        {t('partnerApplication.photosWithPets')}
      </Text>
      <Text className={`text-xs ${subtextColor} mb-3`}>
        {t('partnerApplication.photosWithPetsHint')}
      </Text>
      <View className="mb-6 flex-row gap-3">
        {petPhotos.map((photo, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => pickPetPhoto(index)}
            activeOpacity={0.7}
            className={`flex-1 ${cardBg} border-2 border-dashed ${borderColor} items-center rounded-2xl p-3`}>
            {photo ? (
              <Image
                source={{ uri: photo }}
                className="mb-2 h-20 w-full rounded-xl"
                resizeMode="cover"
              />
            ) : (
              <View
                className={`h-20 w-full ${inputBg} mb-2 items-center justify-center rounded-xl`}>
                <Ionicons name="paw-outline" size={28} color={placeholderColor} />
              </View>
            )}
            <Text className={`text-xs ${subtextColor} text-center`}>
              {photo
                ? t('partnerApplication.change')
                : t('partnerApplication.photoN', { n: index + 1 })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Government ID — front + back */}
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>
        {t('partnerApplication.governmentId')} <Text className="text-red-500">*</Text>
      </Text>
      <View className="mb-6 flex-row gap-3">
        {/* Front */}
        <View className={`flex-1 ${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-4`}>
          <Text className={`text-xs font-semibold ${subtextColor} mb-2 text-center`}>
            {t('partnerApplication.front')}
          </Text>
          {governmentIdFront ? (
            <DocPreview uri={governmentIdFront} inputBg={inputBg} />
          ) : (
            <View className={`h-20 ${inputBg} mb-3 items-center justify-center rounded-xl`}>
              <Ionicons name="card-outline" size={32} color={placeholderColor} />
            </View>
          )}
          {uploadBtn(
            governmentIdFront ? t('partnerApplication.change') : t('partnerApplication.upload'),
            () => pickDocument('governmentIdFront')
          )}
        </View>

        {/* Back */}
        <View className={`flex-1 ${cardBg} border-2 border-dashed ${borderColor} rounded-2xl p-4`}>
          <Text className={`text-xs font-semibold ${subtextColor} mb-2 text-center`}>
            {t('partnerApplication.back')}
          </Text>
          {governmentIdBack ? (
            <DocPreview uri={governmentIdBack} inputBg={inputBg} />
          ) : (
            <View className={`h-20 ${inputBg} mb-3 items-center justify-center rounded-xl`}>
              <Ionicons name="card-outline" size={32} color={placeholderColor} />
            </View>
          )}
          {uploadBtn(
            governmentIdBack ? t('partnerApplication.change') : t('partnerApplication.upload'),
            () => pickDocument('governmentIdBack')
          )}
        </View>
      </View>

      {/* Certificates */}
      <Text className={`text-sm font-semibold ${textColor} mb-3`}>
        {t('partnerApplication.certificates')}
      </Text>

      {certificates.map((cert, index) => (
        <View key={index} className={`${cardBg} border ${borderColor} mb-4 rounded-2xl p-4`}>
          {/* Header row */}
          <View className="mb-3 flex-row items-center">
            <View className={`h-10 w-10 ${inputBg} mr-3 items-center justify-center rounded-xl`}>
              {isPdf(cert.uri) ? (
                <Ionicons name="document-text" size={20} color="#00C870" />
              ) : (
                <Ionicons name="image-outline" size={20} color="#00C870" />
              )}
            </View>
            <Text className={`flex-1 text-sm font-semibold ${textColor}`} numberOfLines={1}>
              {cert.fileName ?? t('partnerApplication.certificateN', { n: index + 1 })}
            </Text>
            <TouchableOpacity onPress={() => onRemoveCertificate(index)} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* File preview */}
          <DocPreview uri={cert.uri} inputBg={inputBg} />

          {/* Issued by */}
          <Text className={`text-xs font-semibold ${subtextColor} mb-1`}>
            {t('partnerApplication.issuedBy')}
          </Text>
          <TextInput
            value={cert.issuer}
            onChangeText={(v) => onUpdateCertificate(index, 'issuer', v)}
            placeholder={t('partnerApplication.issuerPlaceholder')}
            placeholderTextColor={placeholderColor}
            className={`${inputBg} rounded-xl px-3 py-2 ${inputText} mb-3 text-sm`}
          />

          {/* Issued date */}
          <Text className={`text-xs font-semibold ${subtextColor} mb-1`}>
            {t('partnerApplication.issuedDate')}
          </Text>
          <TouchableOpacity
            onPress={() => setOpenDateIndex((i) => (i === index ? null : index))}
            activeOpacity={0.75}
            className={`${inputBg} flex-row items-center justify-between rounded-xl px-3 py-2`}>
            <Text
              className={`text-sm ${cert.issuedDate ? inputText : ''}`}
              style={cert.issuedDate ? undefined : { color: placeholderColor }}>
              {cert.issuedDate || t('partnerApplication.selectDate')}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={placeholderColor} />
          </TouchableOpacity>
          {openDateIndex === index && (
            <DatePicker
              value={parseISO(cert.issuedDate)}
              maxDate={today}
              isDarkMode={isDarkMode}
              onChange={(date) => {
                onUpdateCertificate(index, 'issuedDate', date ? fmtISO(date) : '');
                setOpenDateIndex(null);
              }}
              onClose={() => setOpenDateIndex(null)}
            />
          )}
        </View>
      ))}

      <TouchableOpacity
        onPress={() => pickDocument('certificate')}
        className={`${inputBg} border-2 border-dashed ${borderColor} mb-6 flex-row items-center justify-center rounded-2xl p-4`}
        activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={20} color="#00C870" style={{ marginRight: 8 }} />
        <Text className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          {t('partnerApplication.addCertificate')}
        </Text>
      </TouchableOpacity>

      {/* Background Check Notice */}
      <View
        className={`${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-2xl border p-4 ${isDarkMode ? 'border-blue-800' : 'border-blue-200'}`}>
        <Text
          className={`text-sm font-semibold ${isDarkMode ? 'text-blue-200' : 'text-blue-900'} mb-2`}>
          {t('partnerApplication.backgroundCheck')}
        </Text>
        <Text className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-700'} leading-5`}>
          {t('partnerApplication.backgroundCheckText')}
        </Text>
      </View>
    </View>
  );
}
