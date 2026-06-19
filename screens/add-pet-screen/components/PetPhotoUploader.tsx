import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  return (
    <View className="mb-6">
      <Text className={`text-sm font-semibold ${textColor} mb-1`}>
        Pet Photo <Text className="text-red-500">*</Text>
      </Text>
      {photos.length > 0 ? (
        <Text className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
          Tap a photo to set it as the profile photo.
        </Text>
      ) : null}
      <View className="flex-row flex-wrap" style={{ gap: 12, paddingVertical: 8, paddingHorizontal: 4 }}>
        {photos.map((photo, index) => (
          <View key={index} className="relative" style={{ overflow: 'visible', width: '30%' }}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => onSetMain(index)}>
              <Image
                source={{ uri: photo }}
                className="w-full h-24 rounded-xl"
                style={index === selectedIndex ? { borderWidth: 2, borderColor: '#00C870' } : undefined}
              />
            </TouchableOpacity>
            {index === selectedIndex && (
              <View
                className="absolute bottom-0 left-0 right-0 bg-brand-500 items-center"
                style={{ paddingVertical: 2, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}
              >
                <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>Profile</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => onRemovePhoto(index)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
              style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}
            >
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          onPress={onPickImage}
          className={`border-2 border-dashed ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'} rounded-xl items-center justify-center`}
          style={{ width: '30%', height: 96 }}
        >
          <Ionicons name="cloud-upload-outline" size={28} color={error ? '#EF4444' : '#9CA3AF'} />
          <Text className="text-xs text-gray-500 mt-2">Upload</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
}
