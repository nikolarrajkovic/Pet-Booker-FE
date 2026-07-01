import React from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ServiceDto } from '../../../services/services';

export interface ServiceSearchItem {
  id: number;
  name: string;
  service: string; // service-type displayName (e.g. "Walker")
  rating: number;
  reviews: number;
  distance: string;
  price: number;
  image: string;
  latitude: number;
  longitude: number;
  dto: ServiceDto; // the real service record — booking targets this
}

interface ListViewProps {
  services: ServiceSearchItem[];
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  cardBg: string;
  borderColor: string;
  // When the list is scoped to a Home category (Most Popular / Special Deals),
  // every card carries the same banner the Home cards show.
  badge?: 'popular' | 'deal';
}

export default function ListView({
  services,
  isDarkMode,
  textColor,
  subtextColor,
  cardBg,
  borderColor,
  badge,
}: ListViewProps) {
  const navigation = useNavigation();

  return (
    <ScrollView className="flex-1">
      <View className="px-6 pt-8">
        <Text className={`text-sm ${subtextColor} mb-4`}>{services.length} services found</Text>

        {/* Service cards — tap to read the full service detail before booking */}
        {services.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => (navigation as any).navigate('ServiceDetail', { service: item.dto })}
            className={`${cardBg} rounded-2xl mb-3 p-3 flex-row shadow-sm border ${borderColor}`}
            activeOpacity={0.9}
          >
            {/* Service image + category banner (Popular / Deal) */}
            <View className="relative">
              <Image
                source={{ uri: item.image }}
                className="w-20 h-20 rounded-xl"
                resizeMode="cover"
              />
              {badge === 'popular' && (
                <View className="absolute top-1 left-1 bg-amber-500 rounded-full px-1.5 py-0.5 flex-row items-center">
                  <Ionicons name="flame" size={10} color="white" />
                  <Text className="text-white text-[9px] font-bold ml-0.5">Popular</Text>
                </View>
              )}
              {badge === 'deal' && (
                <View className="absolute top-1 left-1 bg-red-500 rounded-full px-1.5 py-0.5 flex-row items-center">
                  <Ionicons name="pricetag" size={10} color="white" />
                  <Text className="text-white text-[9px] font-bold ml-0.5">Deal</Text>
                </View>
              )}
            </View>

            {/* Service info */}
            <View className="flex-1 ml-3 justify-between">
              <View>
                <Text className={`text-base font-semibold ${textColor}`} numberOfLines={1}>{item.name}</Text>
                {item.service ? (
                  <Text className={`text-sm ${subtextColor} mt-0.5`}>{item.service}</Text>
                ) : null}
              </View>

              <View className="flex-row items-center gap-3">
                {item.rating > 0 && (
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} ml-1 font-medium`}>
                      {item.rating.toFixed(1)} <Text className={subtextColor}>({item.reviews})</Text>
                    </Text>
                  </View>
                )}
                {item.distance ? (
                  <View className="flex-row items-center">
                    <Ionicons name="location" size={14} color="#6B7280" />
                    <Text className={`text-sm ${subtextColor} ml-1`}>{item.distance}</Text>
                  </View>
                ) : null}
              </View>

              <Text className="text-brand-600 font-semibold mt-1">from ${item.price}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom spacing */}
      <View className="h-24" />
    </ScrollView>
  );
}
