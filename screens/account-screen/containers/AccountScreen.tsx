import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';

export default function AccountScreen() {
  const navigation = useNavigation();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [fullName, setFullName] = useState('Alex Johnson');
  const [email, setEmail] = useState('alexj@email.com');
  const [phone, setPhone] = useState('+1 (555) 123-4567');
  const [address, setAddress] = useState('123 Main St, San Francisco, CA 94102');

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to upload a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri =
        asset.base64
          ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
      setProfilePhoto(uri);
    }
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Account"
      contentBg={bgColor}
    >
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Profile Photo Section */}
        <View className="items-center py-8">
          <View className="relative">
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} className="w-32 h-32 rounded-full" />
            ) : (
              <View className={`w-32 h-32 rounded-full ${isDarkMode ? 'bg-[#243447]' : 'bg-orange-400'} items-center justify-center`}>
                <Text className="text-6xl">👩‍🦰</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={pickProfilePhoto}
              className="absolute bottom-0 right-0 w-10 h-10 bg-brand-500 rounded-full items-center justify-center border-4 border-white"
              style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}
            >
              <Ionicons name="camera" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={pickProfilePhoto} className="mt-3">
            <Text className="text-brand-600 font-semibold">Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View className="px-6">
          {/* Personal Information */}
          <Text className={`text-lg font-bold ${textColor} mb-4`}>Personal Information</Text>

          {/* Full Name */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
              placeholderTextColor={placeholderColor}
            />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
              placeholderTextColor={placeholderColor}
            />
          </View>

          {/* Phone Number */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
              placeholderTextColor={placeholderColor}
            />
          </View>

          {/* Address */}
          <View className="mb-6">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Address</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
              placeholderTextColor={placeholderColor}
            />
          </View>

          {/* Payment Methods */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className={`text-lg font-bold ${textColor}`}>Payment Methods</Text>
            <TouchableOpacity>
              <Text className="text-brand-600 font-semibold">+ Add Card</Text>
            </TouchableOpacity>
          </View>

          {/* Saved Card */}
          <View className={`${cardBg} rounded-xl p-4 mb-4 border ${borderColor} flex-row items-center justify-between`}>
            <View className="flex-row items-center flex-1">
              <View className="bg-blue-600 rounded-lg px-3 py-2 mr-3">
                <Text className="text-white text-xs font-bold">VISA</Text>
              </View>
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${textColor}`}>•••• •••• •••• 4242</Text>
                <Text className={`text-xs ${subtextColor} mt-1`}>Expires 12/25</Text>
              </View>
            </View>
            <TouchableOpacity>
              <Text className="text-red-500 font-semibold">Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Success', 'Your changes have been saved!');
          }}
          className="bg-brand-500 py-4 rounded-2xl items-center"
        >
          <Text className="text-white text-lg font-bold">Save Changes</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
