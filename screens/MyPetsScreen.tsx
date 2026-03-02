import React from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const mockPets = [
  {
    id: 1,
    name: 'Max',
    breed: 'Golden Retriever',
    sex: 'Male',
    age: '3 years',
    weight: '70 lbs',
    height: '24 inches',
    image: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=300',
  },
  {
    id: 2,
    name: 'Luna',
    breed: 'Persian',
    sex: 'Female',
    age: '2 years',
    weight: '8 lbs',
    height: '10 inches',
    image: null,
  },
];

export default function MyPetsScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-100';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View className={`${bgColor} px-6 pt-12 pb-6`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mr-4"
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">My Pets</Text>
          </View>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('AddPet')}
            className="w-10 h-10 bg-white rounded-full items-center justify-center"
          >
            <Ionicons name="add" size={24} color="#00C870" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className={`flex-1 ${contentBg} rounded-t-3xl -mt-4`} contentContainerStyle={{ paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24 }}>
        {mockPets.map((pet) => (
          <View key={pet.id} className={`${cardBg} rounded-2xl p-4 mb-4 border ${borderColor} flex-row`}>
            {/* Pet Image */}
            {pet.image ? (
              <Image
                source={{ uri: pet.image }}
                className="w-20 h-20 rounded-xl mr-4"
                resizeMode="cover"
              />
            ) : (
              <View className={`w-20 h-20 rounded-xl mr-4 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} items-center justify-center`}>
                <Ionicons name="image-outline" size={32} color="#9CA3AF" />
              </View>
            )}

            {/* Pet Info */}
            <View className="flex-1">
              <Text className={`text-lg font-bold ${textColor}`}>{pet.name}</Text>
              <Text className={`text-sm ${subtextColor} mt-1`}>
                {pet.breed} • {pet.sex}
              </Text>
              <View className="flex-row mt-2 flex-wrap">
                <Text className={`text-xs ${subtextColor} mr-4`}>Age: {pet.age}</Text>
                <Text className={`text-xs ${subtextColor} mr-4`}>Weight: {pet.weight}</Text>
                <Text className={`text-xs ${subtextColor}`}>Height: {pet.height}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="justify-start">
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('AddPet', { pet })}
                className="mb-3"
              >
                <Ionicons name="pencil" size={20} color="#00C870" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {/* Handle delete */}}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
