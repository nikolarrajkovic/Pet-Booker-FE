import React from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { PetCard } from '../components';

const mockPets = [
  { id: 1, name: 'Max', breed: 'Golden Retriever', sex: 'Male', age: '3 years', weight: '70 lbs', height: '24 inches', image: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=300' },
  { id: 2, name: 'Luna', breed: 'Persian', sex: 'Female', age: '2 years', weight: '8 lbs', height: '10 inches', image: null },
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
      <View className={`${bgColor} px-6 pt-12 pb-6`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">My Pets</Text>
          </View>
          <TouchableOpacity onPress={() => (navigation as any).navigate('AddPet')} className="w-10 h-10 bg-white rounded-full items-center justify-center">
            <Ionicons name="add" size={24} color="#00C870" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className={`flex-1 ${contentBg} rounded-t-3xl -mt-4`} contentContainerStyle={{ paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24 }}>
        {mockPets.map((pet) => (
          <PetCard
            key={pet.id}
            pet={pet}
            isDarkMode={isDarkMode}
            cardBg={cardBg}
            textColor={textColor}
            subtextColor={subtextColor}
            borderColor={borderColor}
            onEdit={() => (navigation as any).navigate('AddPet', { pet })}
            onDelete={() => {}}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
