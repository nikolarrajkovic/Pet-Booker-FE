import React from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

interface Provider {
  id: number;
  name: string;
  service: string;
  rating: number;
  reviews: number;
  distance: string;
  price: number;
  image: string;
  verified: boolean;
}

interface ListViewProps {
  providers: Provider[];
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  cardBg: string;
  borderColor: string;
}

export default function ListView({
  providers,
  isDarkMode,
  textColor,
  subtextColor,
  cardBg,
  borderColor,
}: ListViewProps) {
  const navigation = useNavigation();

  return (
    <ScrollView className="flex-1">
      <View className="px-6 pt-8">
        <Text className={`text-sm ${subtextColor} mb-4`}>{providers.length} providers found</Text>

        {/* Provider cards */}
        {providers.map((provider) => (
          <TouchableOpacity
            key={provider.id}
            onPress={() => (navigation as any).navigate('ProviderDetail', { provider })}
            className={`${cardBg} rounded-2xl mb-3 p-3 flex-row shadow-sm border ${borderColor}`}
            activeOpacity={0.9}
          >
            {/* Provider image */}
            <View className="relative">
              <Image
                source={{ uri: provider.image }}
                className="w-20 h-20 rounded-xl"
                resizeMode="cover"
              />
              {provider.verified && (
                <View className="absolute -top-1 -right-1 w-6 h-6 bg-brand-500 rounded-full items-center justify-center">
                  <Ionicons name="checkmark" size={14} color="white" />
                </View>
              )}
            </View>

            {/* Provider info */}
            <View className="flex-1 ml-3 justify-between">
              <View>
                <Text className={`text-base font-semibold ${textColor}`}>{provider.name}</Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>{provider.service}</Text>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center">
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} ml-1 font-medium`}>
                    {provider.rating} <Text className={subtextColor}>({provider.reviews})</Text>
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="location" size={14} color="#6B7280" />
                  <Text className={`text-sm ${subtextColor} ml-1`}>{provider.distance}</Text>
                </View>
              </View>

              <Text className="text-brand-600 font-semibold mt-1">from ${provider.price}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom spacing */}
      <View className="h-24" />
    </ScrollView>
  );
}
