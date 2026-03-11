import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Pet {
  id: number;
  name: string;
  breed: string;
  image: string;
}

interface PetSelectorProps {
  selectedPet: number | null;
  onSelectPet: (petId: number) => void;
  pets: Pet[];
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  cardBg: string;
  borderColor: string;
}

export default function PetSelector({
  selectedPet,
  onSelectPet,
  pets,
  isDarkMode,
  textColor,
  subtextColor,
  cardBg,
  borderColor,
}: PetSelectorProps) {
  return (
    <View className={`px-6 py-5 border-t ${borderColor}`}>
      <View className="flex-row items-center mb-4">
        <View className={`w-6 h-6 rounded-full items-center justify-center ${selectedPet ? 'bg-brand-500' : 'bg-gray-300'}`}>
          {selectedPet ? (
            <Ionicons name="checkmark" size={16} color="white" />
          ) : (
            <Text className="text-white text-xs font-bold">4</Text>
          )}
        </View>
        <Text className={`text-base font-semibold ${textColor} ml-3`}>Select Pet</Text>
        <Text className={`text-sm ${subtextColor} ml-2`}>Select one or more pets</Text>
      </View>

      <View className="flex-row gap-3">
        {pets.map(pet => (
          <TouchableOpacity
            key={pet.id}
            onPress={() => onSelectPet(pet.id)}
            className={`flex-1 rounded-2xl p-4 border-2 ${
              selectedPet === pet.id
                ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                : `${borderColor} ${cardBg}`
            }`}
          >
            {pet.image ? (
              <Image source={{ uri: pet.image }} className="w-full h-32 rounded-xl mb-3" resizeMode="cover" />
            ) : (
              <View className={`w-full h-32 rounded-xl mb-3 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
                <Ionicons name="image-outline" size={40} color="#9CA3AF" />
              </View>
            )}
            <Text className={`text-base font-semibold ${textColor}`}>{pet.name}</Text>
            <Text className={`text-sm ${subtextColor}`}>{pet.breed}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
