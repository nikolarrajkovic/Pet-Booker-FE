import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Pet {
  id: number;
  name: string;
  breed: string;
  sex: string;
  age: string;
  weight: string;
  height: string;
  image: string | null;
}

interface PetCardProps {
  pet: Pet;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PetCard({
  pet,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  onEdit,
  onDelete,
}: PetCardProps) {
  return (
    <View className={`${cardBg} rounded-2xl p-4 mb-4 border ${borderColor} flex-row`}>
      {pet.image ? (
        <Image source={{ uri: pet.image }} className="w-20 h-20 rounded-xl mr-4" resizeMode="cover" />
      ) : (
        <View className={`w-20 h-20 rounded-xl mr-4 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} items-center justify-center`}>
          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
        </View>
      )}
      <View className="flex-1">
        <Text className={`text-lg font-bold ${textColor}`}>{pet.name}</Text>
        <Text className={`text-sm ${subtextColor} mt-1`}>{pet.breed} • {pet.sex}</Text>
        <View className="flex-row mt-2 flex-wrap">
          <Text className={`text-xs ${subtextColor} mr-4`}>Age: {pet.age}</Text>
          <Text className={`text-xs ${subtextColor} mr-4`}>Weight: {pet.weight}</Text>
          <Text className={`text-xs ${subtextColor}`}>Height: {pet.height}</Text>
        </View>
      </View>
      <View className="justify-start">
        <TouchableOpacity onPress={onEdit} className="mb-3">
          <Ionicons name="pencil" size={20} color="#00C870" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
