import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PetPhotoUploader, PetTypeSelector, SexSelector } from '../components';
import DatePicker from '../../../components/shared/DatePicker';
import { createPet, updatePet } from '../../../services/pets';
import { useAuth } from '../../../context/AuthContext';

type AddPetRouteParams = {
  pet?: {
    id: string;
    name: string;
    type?: string;
    breed: string;
    sex: string;
    dateOfBirth?: string;
    weight: string;
    height: string;
    dietaryNotes?: string;
    favoriteFood?: string;
    additionalNotes?: string;
    image: string | null;
    photos?: {
      id: number;
      src: string;
      alt: string;
      name: string;
      fileUploadId: number;
      isSelected: boolean;
      contentType: number;
      uploadedAt: string;
    }[];
  };
};

export default function AddPetScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: AddPetRouteParams }, 'params'>>();
  const existingPet = route.params?.pet;
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, inputBg, inputText } = useThemeColors();
  const { currentUser } = useAuth();

  const [isMetric, setIsMetric] = useState(true);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied, defaulting to metric');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (geocode[0]?.isoCountryCode) {
          const countryCode = geocode[0].isoCountryCode;
          const imperialCountries = ['US', 'LR', 'MM'];
          const useMetric = !imperialCountries.includes(countryCode);
          
          setIsMetric(useMetric);
          setWeightUnit(useMetric ? 'kg' : 'lbs');
          setHeightUnit(useMetric ? 'cm' : 'in');
          
          console.log('Country:', countryCode, 'isMetric:', useMetric);
        }
      } catch (error) {
        console.log('Error getting location:', error);
      }
    })();
  }, []);

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const placeholderColor = isDarkMode ? '#6B7280' : undefined;

  const [petPhotos, setPetPhotos] = useState<{ uri: string; fileName?: string }[]>(() => {
    if (existingPet?.photos?.length) {
      const base = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
      return existingPet.photos.map((p) => ({
        uri: p.src.startsWith('http://') || p.src.startsWith('https://')
          ? p.src
          : `${base}${p.src.startsWith('/') ? '' : '/'}${p.src}`,
        fileName: p.name,
      }));
    }
    return existingPet?.image ? [{ uri: existingPet.image }] : [];
  });
  const [petName, setPetName] = useState(existingPet?.name || '');
  const [petType, setPetType] = useState(existingPet?.type || '');
  const [breed, setBreed] = useState(existingPet?.breed || '');
  const [sex, setSex] = useState(existingPet?.sex || '');
  const [birthDate, setBirthDate] = useState<Date | null>(
    existingPet?.dateOfBirth ? new Date(existingPet.dateOfBirth) : null
  );
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [weight, setWeight] = useState(existingPet?.weight || '');
  const [height, setHeight] = useState(existingPet?.height || '');
  const [dietaryNotes, setDietaryNotes] = useState(existingPet?.dietaryNotes || '');
  const [favoriteFood, setFavoriteFood] = useState(existingPet?.favoriteFood || '');
  const [additionalNotes, setAdditionalNotes] = useState(existingPet?.additionalNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to upload pet photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri =
        asset.base64
          ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
      setPetPhotos([...petPhotos, { uri, fileName: asset.fileName ?? undefined }]);
    }
  };

  const removePhoto = (index: number) => {
    setPetPhotos(petPhotos.filter((_, i) => i !== index));
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={existingPet ? 'Edit Pet' : 'Add New Pet'}
      contentBg={contentBg}
      contentRounded={false}
    >

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 24, paddingBottom: 100, paddingHorizontal: 24 }}>
        <PetPhotoUploader
          photos={petPhotos.map((p) => p.uri)}
          isDarkMode={isDarkMode}
          textColor={textColor}
          onPickImage={pickImage}
          onRemovePhoto={removePhoto}
          error={petPhotos.length === 0 ? 'At least one photo is required.' : undefined}
        />

        {/* Pet Name */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>
            Pet Name <Text className="text-red-500">*</Text>
          </Text>
          <TextInput placeholder="Enter pet's name" placeholderTextColor={placeholderColor} value={petName} onChangeText={setPetName} className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`} />
        </View>

        <PetTypeSelector
          selectedType={petType}
          onSelectType={setPetType}
          isDarkMode={isDarkMode}
          textColor={textColor}
          inputBg={inputBg}
        />

        {/* Breed */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Breed</Text>
          <TextInput placeholder="Enter breed" placeholderTextColor={placeholderColor} value={breed} onChangeText={setBreed} className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`} />
        </View>

        <SexSelector
          selectedSex={sex}
          onSelectSex={setSex}
          isDarkMode={isDarkMode}
          textColor={textColor}
          inputBg={inputBg}
        />

        {/* Birth Date */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Birth Date</Text>
          <TouchableOpacity
            onPress={() => setShowBirthDatePicker(v => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 13,
            }}
            className={`${inputBg}`}
          >
            <Ionicons name="calendar-outline" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            <Text style={{ marginLeft: 10, fontSize: 15, color: birthDate ? (isDarkMode ? '#ffffff' : '#111827') : (isDarkMode ? '#6B7280' : '#9CA3AF'), flex: 1 }}>
              {birthDate
                ? birthDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                : 'Select birth date'}
            </Text>
            <Ionicons name={showBirthDatePicker ? 'chevron-up' : 'chevron-down'} size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
          {showBirthDatePicker && (
            <DatePicker
              value={birthDate ?? new Date()}
              maxDate={new Date()}
              isDarkMode={isDarkMode}
              onChange={(date) => {
                setBirthDate(date);
                setShowBirthDatePicker(false);
              }}
              onClose={() => setShowBirthDatePicker(false)}
            />
          )}
        </View>

        {/* Weight, Height */}
        <View className="flex-row mb-4 gap-3">
          <View className="flex-1">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Weight ({weightUnit})</Text>
            <TextInput placeholder={`e.g. ${isMetric ? '20' : '50'}`} placeholderTextColor={placeholderColor} value={weight} onChangeText={setWeight} keyboardType="numeric" className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`} />
          </View>
          <View className="flex-1">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Height ({heightUnit})</Text>
            <TextInput placeholder={`e.g. ${isMetric ? '50' : '20'}`} placeholderTextColor={placeholderColor} value={height} onChangeText={setHeight} keyboardType="numeric" className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`} />
          </View>
        </View>

        {/* Dietary Notes */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Dietary Notes</Text>
          <TextInput placeholder="e.g. Do not feed chicken" placeholderTextColor={placeholderColor} value={dietaryNotes} onChangeText={setDietaryNotes} className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`} />
        </View>

        {/* Favorite Food */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Favorite Food</Text>
          <TextInput placeholder="e.g. Beef treats" placeholderTextColor={placeholderColor} value={favoriteFood} onChangeText={setFavoriteFood} className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`} />
        </View>

        {/* Additional Notes */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Additional Notes</Text>
          <TextInput placeholder="Temperament, medications, special care instructions..." placeholderTextColor={placeholderColor} value={additionalNotes} onChangeText={setAdditionalNotes} multiline numberOfLines={4} textAlignVertical="top" className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`} />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} px-6 py-4`}>
        <TouchableOpacity
          disabled={isSubmitting || petPhotos.length === 0}
          style={{ opacity: isSubmitting || petPhotos.length === 0 ? 0.7 : 1 }}
          onPress={async () => {
            if (petPhotos.length === 0) {
              Alert.alert('Photo required', 'Please add at least one photo of your pet before saving.');
              return;
            }
            setIsSubmitting(true);
            try {
              const input = {
                ownerUserId: currentUser?.id ?? 0,
                petName,
                petType,
                breed,
                sex,
                birthDate,
                weight,
                weightUnit,
                height,
                heightUnit,
                dietaryNotes,
                favoriteFood,
                additionalNotes,
                petPhotos,
              };
              if (existingPet?.id) {
                await updatePet({ ...input, petId: existingPet.id, originalPhotos: existingPet.photos });
              } else {
                await createPet(input);
              }
              (navigation as any).navigate('MyPets', { refreshKey: Date.now() });
            } catch (error: any) {
              Alert.alert('Error', error?.message ?? 'Something went wrong. Please try again.');
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="bg-brand-500 py-4 rounded-2xl items-center"
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-bold">Save Pet</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
