import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PetPhotoUploaderProps {
  photos: string[];
  isDarkMode: boolean;
  textColor: string;
  onPickImage: () => void;
  onRemovePhoto: (index: number) => void;
  error?: string;
}

export default function PetPhotoUploader({
  photos,
  isDarkMode,
  textColor,
  onPickImage,
  onRemovePhoto,
  error,
}: PetPhotoUploaderProps) {
  return (
    <View className="mb-6">
      <Text className={`text-sm font-semibold ${textColor} mb-2`}>
        Pet Photo <Text className="text-red-500">*</Text>
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 12, paddingVertical: 8, paddingHorizontal: 4 }}>
        {photos.map((photo, index) => (
          <View key={index} className="relative" style={{ overflow: 'visible', width: '30%' }}>
            <Image source={{ uri: photo }} className="w-full h-24 rounded-xl" />
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
