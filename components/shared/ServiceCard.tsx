import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';

type ServiceCardProps = {
  image: string;
  name: string;
  service: string;
  rating: number;
  reviews: number;
  distance?: string;
  price: number;
  badge?: 'popular' | 'deal';
  onPress: () => void;
};

export default function ServiceCard({
  image,
  name,
  service,
  rating,
  reviews,
  distance,
  price,
  badge,
  onPress,
}: ServiceCardProps) {
  const { cardBg, textColor, subtextColor, borderColor } = useThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`${cardBg} rounded-2xl overflow-hidden border ${borderColor}`}
      style={{ width: 200 }}
    >
      <View className="relative">
        <Image 
          source={{ uri: image }} 
          className="w-full h-32" 
          resizeMode="cover" 
        />
        
        {/* Distance Badge */}
        {distance && (
          <View className="absolute top-2 left-2 bg-blue-500 rounded-full px-3 py-1 flex-row items-center">
            <Ionicons name="location" size={12} color="white" />
            <Text className="text-white text-xs font-semibold ml-1">{distance}</Text>
          </View>
        )}
        
        {/* Price Badge */}
        {price && (
          <View className="absolute top-2 right-2 bg-brand-500 rounded-full px-3 py-1">
            <Text className="text-white text-xs font-bold">${price}+</Text>
          </View>
        )}
        
        {/* Popular Badge */}
        {badge === 'popular' && (
          <View className="absolute top-2 left-2 bg-amber-500 rounded-full px-3 py-1 flex-row items-center">
            <Ionicons name="flame" size={12} color="white" />
            <Text className="text-white text-xs font-semibold ml-1">Popular</Text>
          </View>
        )}
        
        {/* Deal Badge */}
        {badge === 'deal' && (
          <View className="absolute top-2 left-2 bg-red-500 rounded-full px-3 py-1 flex-row items-center">
            <Ionicons name="pricetag" size={12} color="white" />
            <Text className="text-white text-xs font-semibold ml-1">Deal</Text>
          </View>
        )}
      </View>

      <View className="p-3">
        <Text className={`font-semibold ${textColor} mb-1`} numberOfLines={1}>
          {name}
        </Text>
        <Text className={`text-xs ${subtextColor} mb-2`}>{service}</Text>
        
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text className={`text-xs font-semibold ${textColor} ml-1`}>
              {rating}
            </Text>
            <Text className={`text-xs ${subtextColor} ml-1`}>({reviews})</Text>
          </View>
          {distance && (
            <Text className={`text-xs ${subtextColor}`}>{distance}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
