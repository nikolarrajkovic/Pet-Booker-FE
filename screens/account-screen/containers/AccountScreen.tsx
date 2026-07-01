import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocation } from '../../../hooks/useLocation';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import MapAddressPicker from '../../../components/shared/MapAddressPicker';
import PhoneInput from '../../../components/shared/PhoneInput';
import { getUser, updateUser, UserDto } from '../../../services/users';
import { getErrorMessage } from '../../../services/http';
import { uploadFile } from '../../../services/files';
import { resolveImageUrl, AddressDto } from '../../../services/service-providers';
import { addressLabel } from '../../../services/geocoding';

type PickedPhoto = { uri: string; fileName?: string; mimeType?: string };

export default function AccountScreen() {
  const { currentUser, refreshUser } = useAuth();
  const location = useLocation();
  const {
    isDarkMode,
    bgColor,
    cardBg,
    textColor,
    subtextColor,
    inputBg,
    inputText,
    borderColor,
    placeholderColor,
  } = useThemeColors();

  const { showError, showSuccess } = useToast();

  const [original, setOriginal] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); // read-only

  const [newPhoto, setNewPhoto] = useState<PickedPhoto | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const [address, setAddress] = useState<AddressDto | null>(null); // newly picked
  const [pickerVisible, setPickerVisible] = useState(false);

  // Load the full user record (id from auth/me) and prefill the form.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser?.id) {
        setIsLoading(false);
        return;
      }
      try {
        const u = await getUser(currentUser.id);
        if (cancelled) return;
        setOriginal(u);
        setFirstName(u.firstName ?? '');
        setLastName(u.lastName ?? '');
        setPhone(u.phone ?? '');
        setEmail(u.email ?? '');
      } catch (e) {
        if (!cancelled) setLoadError(getErrorMessage(e, 'Could not load your profile.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please allow access to your photos to upload a profile photo.'
      );
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
      const uri = asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;
      setNewPhoto({
        uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
      });
      setAvatarError(false);
    }
  };

  const handleSave = async () => {
    if (!original?.id) return;
    setIsSaving(true);
    try {
      // 1) Upload the new photo first; its src becomes the avatarUrl.
      let avatarUrl = original.avatarUrl ?? null;
      if (newPhoto) {
        const uploaded = await uploadFile(newPhoto.uri, newPhoto.fileName, newPhoto.mimeType);
        avatarUrl = uploaded.src;
      }

      // 2) Address goes INLINE in the user body — the backend creates + links it
      //    (verified live: returns the new addressId). id:0 signals "new".
      let addressId = original.addressId ?? null;
      let addressObj = original.address ?? null;
      if (address) {
        addressObj = { ...address, id: 0 };
        addressId = null;
      }

      // 3) PUT the full record (no PATCH endpoint) with all the new data in the
      //    body — this also preserves passwordHash/salt etc. returned by getUser.
      const updated = await updateUser({
        ...original,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        avatarUrl,
        addressId,
        address: addressObj,
      });
      setOriginal(updated);
      setNewPhoto(null);
      setAddress(null);
      await refreshUser();
      showSuccess('Your changes have been saved!');
    } catch (e) {
      showError(getErrorMessage(e, 'Could not save your changes. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Avatar to display: the freshly-picked photo, else the saved avatar, else initials.
  const savedAvatar = avatarError ? '' : resolveImageUrl(original?.avatarUrl);
  const avatarUri = newPhoto?.uri || savedAvatar;
  const initials = ((firstName || email || '?').trim()[0] ?? '?').toUpperCase();

  const currentAddress = address ?? original?.address ?? null;

  if (isLoading) {
    return (
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle="Account"
        contentBg={bgColor}>
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#00C870" />
        </View>
      </ScreenLayout>
    );
  }

  if (loadError) {
    return (
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle="Account"
        contentBg={bgColor}>
        <View className="flex-1 items-center justify-center px-8 py-20">
          <Ionicons name="alert-circle-outline" size={56} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
          <Text className={`${subtextColor} mt-4 text-center`}>{loadError}</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout headerVariant="standard" showBackButton headerTitle="Account" contentBg={bgColor}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Profile Photo */}
        <View className="items-center py-8">
          <View className="relative">
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                className="h-32 w-32 rounded-full"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <View
                className={`h-32 w-32 rounded-full ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-100'} items-center justify-center`}>
                <Text className="text-5xl font-bold text-brand-600">{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={pickProfilePhoto}
              className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-brand-500"
              style={{
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
              }}>
              <Ionicons name="camera" size={20} color="white" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={pickProfilePhoto} className="mt-3">
            <Text className="font-semibold text-brand-600">Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View className="px-6">
          <Text className={`text-lg font-bold ${textColor} mb-4`}>Personal Information</Text>

          {/* First Name */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>First Name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
              placeholderTextColor={placeholderColor}
            />
          </View>

          {/* Last Name */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Last Name</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
              placeholderTextColor={placeholderColor}
            />
          </View>

          {/* Email — read-only */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Email</Text>
            <TextInput
              value={email}
              editable={false}
              autoCapitalize="none"
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`}
              style={{ opacity: 0.6 }}
              placeholderTextColor={placeholderColor}
            />
            <Text className={`text-xs ${subtextColor} mt-1`}>Email can’t be changed here.</Text>
          </View>

          {/* Phone Number — country flag/dial-code dropdown + national number */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Phone Number</Text>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
              inputBg={inputBg}
              inputText={inputText}
              borderColor={borderColor}
              placeholderColor={placeholderColor}
              cardBg={cardBg}
            />
          </View>

          {/* Address — picked on a map */}
          <View className="mb-6">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Address</Text>
            <TouchableOpacity
              onPress={() => setPickerVisible(true)}
              className={`${inputBg} rounded-xl border px-4 py-3 ${borderColor} flex-row items-center`}>
              <Ionicons name="location-outline" size={20} color="#00C870" />
              <Text
                className={`ml-3 flex-1 ${currentAddress ? inputText : subtextColor}`}
                numberOfLines={2}>
                {currentAddress ? addressLabel(currentAddress) : 'Pick location on map'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>

          {/* Payment Methods (mock — no backend) */}
          <View className="mb-3 flex-row items-center justify-between">
            <Text className={`text-lg font-bold ${textColor}`}>Payment Methods</Text>
            <TouchableOpacity>
              <Text className="font-semibold text-brand-600">+ Add Card</Text>
            </TouchableOpacity>
          </View>
          <View
            className={`${cardBg} mb-4 rounded-xl border p-4 ${borderColor} flex-row items-center justify-between`}>
            <View className="flex-1 flex-row items-center">
              <View className="mr-3 rounded-lg bg-blue-600 px-3 py-2">
                <Text className="text-xs font-bold text-white">VISA</Text>
              </View>
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${textColor}`}>•••• •••• •••• 4242</Text>
                <Text className={`text-xs ${subtextColor} mt-1`}>Expires 12/25</Text>
              </View>
            </View>
            <TouchableOpacity>
              <Text className="font-semibold text-red-500">Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View
        className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className="items-center rounded-2xl bg-brand-500 py-4"
          style={{ opacity: isSaving ? 0.7 : 1 }}>
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-lg font-bold text-white">Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Map picker for the address — opens on the user's current location */}
      {pickerVisible && (
        <MapAddressPicker
          visible
          title="Your address"
          initialRegion={{ latitude: location.latitude, longitude: location.longitude }}
          isDarkMode={isDarkMode}
          onClose={() => setPickerVisible(false)}
          onSelect={(picked) => setAddress(picked)}
        />
      )}
    </ScreenLayout>
  );
}
