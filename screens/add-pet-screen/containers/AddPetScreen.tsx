import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PetPhotoUploader, PetTypeSelector, SexSelector } from '../components';

type AddPetRouteParams = {
  pet?: {
    id: number;
    name: string;
    breed: string;
    sex: string;
    age: string;
    weight: string;
    height: string;
    image: string | null;
  };
};

export default function AddPetScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: AddPetRouteParams }, 'params'>>();
  const existingPet = route.params?.pet;
  const { isDarkMode } = useTheme();

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
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const inputBg = isDarkMode ? 'bg-[#243447]' : 'bg-gray-50';
  const inputText = isDarkMode ? 'text-white' : 'text-gray-900';
  const placeholderColor = isDarkMode ? '#6B7280' : undefined;

  const [petPhotos, setPetPhotos] = useState<string[]>(existingPet?.image ? [existingPet.image] : []);
  const [petName, setPetName] = useState(existingPet?.name || '');
  const [petType, setPetType] = useState('');
  const [breed, setBreed] = useState(existingPet?.breed || '');
  const [sex, setSex] = useState(existingPet?.sex || '');
  const [age, setAge] = useState(existingPet?.age || '');
  const [weight, setWeight] = useState(existingPet?.weight || '');
  const [height, setHeight] = useState(existingPet?.height || '');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [favoriteFood, setFavoriteFood] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

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
    });

    if (!result.canceled && result.assets[0]) {
      setPetPhotos([...petPhotos, result.assets[0].uri]);
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
          photos={petPhotos}
          isDarkMode={isDarkMode}
          textColor={textColor}
          onPickImage={pickImage}
          onRemovePhoto={removePhoto}
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

        {/* Age, Weight, Height */}
        <View className="flex-row mb-4 gap-3">
          <View className="flex-1">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Age</Text>
            <TextInput placeholder="e.g. 3 years" placeholderTextColor={placeholderColor} value={age} onChangeText={setAge} className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`} />
          </View>
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
        <TouchableOpacity onPress={() => navigation.goBack()} className="bg-brand-500 py-4 rounded-2xl items-center">
          <Text className="text-white text-lg font-bold">Save Pet</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
