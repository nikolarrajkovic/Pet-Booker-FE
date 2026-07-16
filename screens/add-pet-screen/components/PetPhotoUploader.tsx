import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

interface PetPhotoUploaderProps {
  photos: string[];
  isDarkMode: boolean;
  textColor: string;
  onPickImage: () => void;
  onRemovePhoto: (index: number) => void;
  /** Index of the profile (main) photo. */
  selectedIndex: number;
  /** Set a photo as the profile photo. */
  onSetMain: (index: number) => void;
  error?: string;
}

export default function PetPhotoUploader({
  photos,
  isDarkMode,
  textColor,
  onPickImage,
  onRemovePhoto,
  selectedIndex,
  onSetMain,
  error,
}: PetPhotoUploaderProps) {
  const { t } = useLocale();
  return (
    <View className="mb-6">
      <Text className={`text-sm font-semibold ${textColor} mb-1`}>
        {t('addPet.petPhoto')} <Text className="text-red-500">*</Text>
      </Text>
      {photos.length > 0 ? (
        <Text className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
          {t('addPet.tapToSetProfile')}
        </Text>
      ) : null}
      <View
        className="flex-row flex-wrap"
        style={{ gap: 12, paddingVertical: 8, paddingHorizontal: 4 }}>
        {photos.map((photo, index) => (
          <View key={index} className="relative" style={{ overflow: 'visible', width: '30%' }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => onSetMain(index)}>
              <Image
                source={{ uri: photo }}
                className="h-24 w-full rounded-xl"
                style={
                  index === selectedIndex ? { borderWidth: 2, borderColor: '#00C870' } : undefined
                }
              />
            </TouchableOpacity>
            {index === selectedIndex && (
              <View
                className="absolute bottom-0 left-0 right-0 items-center bg-brand-500"
                style={{
                  paddingVertical: 2,
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                }}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>
                  {t('addPet.profileBadge')}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => onRemovePhoto(index)}
              className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-red-500"
              style={{
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
              }}>
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={onPickImage}
          className={`border-2 border-dashed ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'} items-center justify-center rounded-xl`}
          style={{ width: '30%', height: 96 }}>
          <Ionicons name="cloud-upload-outline" size={28} color={error ? '#EF4444' : '#9CA3AF'} />
          <Text className="mt-2 text-xs text-gray-500">{t('addPet.upload')}</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
