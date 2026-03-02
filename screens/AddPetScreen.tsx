import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';

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

  const [isMetric, setIsMetric] = useState(true); // Default to metric
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
          // Only US, Liberia, and Myanmar use imperial system
          const imperialCountries = ['US', 'LR', 'MM'];
          const useMetric = !imperialCountries.includes(countryCode);
          
          setIsMetric(useMetric);
          setWeightUnit(useMetric ? 'kg' : 'lbs');
          setHeightUnit(useMetric ? 'cm' : 'in');
          
          console.log('Country:', countryCode, 'isMetric:', useMetric);
        }
      } catch (error) {
        console.log('Error getting location:', error);
        // Default to metric if location fails
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
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Green Header */}
      <View className={`${bgColor} px-6 pt-12 pb-6`}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-4"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">
            {existingPet ? 'Edit Pet' : 'Add New Pet'}
          </Text>
        </View>
      </View>

      <ScrollView className={`flex-1 ${contentBg} rounded-t-3xl -mt-4`} contentContainerStyle={{ paddingTop: 24, paddingBottom: 100, paddingHorizontal: 24 }}>
        {/* Pet Photo */}
        <View className="mb-6">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Pet Photo</Text>
          <View className="flex-row flex-wrap" style={{ gap: 12, paddingVertical: 8, paddingHorizontal: 4 }}>
            {petPhotos.map((photo, index) => (
              <View key={index} className="relative" style={{ overflow: 'visible', width: '30%' }}>
                <Image source={{ uri: photo }} className="w-full h-24 rounded-xl" />
                <TouchableOpacity
                  onPress={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                  style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}
                >
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity 
              onPress={pickImage}
              className={`border-2 border-dashed ${isDarkMode ? 'border-gray-600' : 'border-gray-300'} rounded-xl items-center justify-center`}
              style={{ width: '30%', height: 96 }}
            >
              <Ionicons name="cloud-upload-outline" size={28} color="#9CA3AF" />
              <Text className="text-xs text-gray-500 mt-2">Upload</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pet Name */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>
            Pet Name <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            placeholder="Enter pet's name"
            placeholderTextColor={placeholderColor}
            value={petName}
            onChangeText={setPetName}
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
          />
        </View>

        {/* Pet Type Selection */}
        <View className="mb-6">
          <Text className={`text-sm font-semibold ${textColor} mb-3`}>
            Type <Text className="text-red-500">*</Text>
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {[
              { id: 'dog', emoji: '🐕', label: 'Dog' },
              { id: 'cat', emoji: '🐈', label: 'Cat' },
              { id: 'parrot', emoji: '🦜', label: 'Parrot' },
              { id: 'turtle', emoji: '🐢', label: 'Turtle' },
              { id: 'fish', emoji: '🐠', label: 'Fish' },
              { id: 'snake', emoji: '🐍', label: 'Snake' },
            ].map((type) => (
              <TouchableOpacity
                key={type.id}
                onPress={() => setPetType(type.id)}
                className={`items-center justify-center px-4 py-3 rounded-xl border-2 ${
                  petType === type.id
                    ? 'bg-brand-500 border-brand-500'
                    : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
                }`}
                style={{ width: '30%' }}
              >
                <Text style={{ fontSize: 32, marginBottom: 4 }}>{type.emoji}</Text>
                <Text
                  className={`text-xs font-medium ${
                    petType === type.id ? 'text-white' : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Breed */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Breed</Text>
          <TextInput
            placeholder="Enter breed"
            placeholderTextColor={placeholderColor}
            value={breed}
            onChangeText={setBreed}
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
          />
        </View>

        {/* Sex */}
        <View className="mb-6">
          <Text className={`text-sm font-semibold ${textColor} mb-3`}>Sex</Text>
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => setSex('male')}
              className={`flex-1 items-center justify-center py-4 rounded-xl border-2 ${
                sex === 'male'
                  ? 'bg-brand-500 border-brand-500'
                  : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
              }`}
            >
              <Ionicons 
                name="male" 
                size={32} 
                color={sex === 'male' ? 'white' : '#3B82F6'} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSex('female')}
              className={`flex-1 items-center justify-center py-4 rounded-xl border-2 ${
                sex === 'female'
                  ? 'bg-brand-500 border-brand-500'
                  : `${inputBg} ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`
              }`}
            >
              <Ionicons 
                name="female" 
                size={32} 
                color={sex === 'female' ? 'white' : '#EC4899'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Age, Weight, Height */}
        <View className="flex-row mb-4 gap-3">
          <View className="flex-1">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Age</Text>
            <TextInput
              placeholder="e.g. 3 years"
              placeholderTextColor={placeholderColor}
              value={age}
              onChangeText={setAge}
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
            />
          </View>
          <View className="flex-1">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Weight ({weightUnit})</Text>
            <TextInput
              placeholder={`e.g. ${isMetric ? '20' : '50'}`}
              placeholderTextColor={placeholderColor}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
            />
          </View>
          <View className="flex-1">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>Height ({heightUnit})</Text>
            <TextInput
              placeholder={`e.g. ${isMetric ? '50' : '20'}`}
              placeholderTextColor={placeholderColor}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
            />
          </View>
        </View>

        {/* Dietary Notes */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Dietary Notes</Text>
          <TextInput
            placeholder="e.g. Do not feed chicken"
            placeholderTextColor={placeholderColor}
            value={dietaryNotes}
            onChangeText={setDietaryNotes}
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
          />
        </View>

        {/* Favorite Food */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Favorite Food</Text>
          <TextInput
            placeholder="e.g. Beef treats"
            placeholderTextColor={placeholderColor}
            value={favoriteFood}
            onChangeText={setFavoriteFood}
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
          />
        </View>

        {/* Additional Notes */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Additional Notes</Text>
          <TextInput
            placeholder="Temperament, medications, special care instructions..."
            placeholderTextColor={placeholderColor}
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
          />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-brand-500 py-4 rounded-2xl items-center"
        >
          <Text className="text-white text-lg font-bold">Save Pet</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
