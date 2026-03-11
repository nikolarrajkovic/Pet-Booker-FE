import React from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

type ProviderDetailRouteParams = {
  provider: {
    id: number; name: string; service: string; rating: number; reviews: number;
    distance: string; price: number; image: string; verified: boolean;
    latitude: number; longitude: number;
  };
};

export default function ProviderDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ProviderDetailRouteParams }, 'params'>>();
  const { provider } = route.params;
  const { isDarkMode } = useTheme();

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-100';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <View className="relative">
        <Image source={{ uri: provider.image }} className="w-full h-64" resizeMode="cover" />
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="absolute top-12 left-4 w-10 h-10 bg-white rounded-full items-center justify-center"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-6 py-5">
          <Text className={`text-2xl font-bold ${textColor}`}>{provider.name}</Text>
          <Text className="text-brand-600 text-base mt-1">{provider.service}</Text>
          <View className="flex-row items-center mt-3">
            <View className="flex-row items-center bg-brand-50 px-2 py-1 rounded-lg">
              <Ionicons name="star" size={16} color="#00C870" />
              <Text className="text-brand-700 font-semibold ml-1">{provider.rating}</Text>
            </View>
            <Text className={`${subtextColor} ml-2`}>{provider.reviews} reviews</Text>
          </View>
          <View className="flex-row items-center mt-3">
            <Ionicons name="location-outline" size={18} color="#6B7280" />
            <Text className={`${subtextColor} ml-1`}>{provider.distance} away</Text>
          </View>
          <View className="mt-6">
            <Text className={`text-lg font-semibold ${textColor} mb-2`}>About</Text>
            <Text className={`${subtextColor} leading-6`}>Comfortable overnight pet sitting in a home environment.</Text>
          </View>
          <View className={`mt-6 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} rounded-2xl p-4`}>
            <Text className={`text-lg font-semibold ${textColor} mb-2`}>Pricing</Text>
            <View className="flex-row items-baseline">
              <Text className="text-3xl font-bold text-brand-600">${provider.price}</Text>
              <Text className={`${subtextColor} ml-2`}>starting from</Text>
            </View>
          </View>
          <View className="mt-6">
            <Text className={`text-lg font-semibold ${textColor} mb-3`}>Location</Text>
            <View className={`${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'} rounded-2xl p-4 items-center`}>
              <View className="w-12 h-12 bg-brand-100 rounded-full items-center justify-center mb-2">
                <Ionicons name="location" size={24} color="#00C870" />
              </View>
              <Text className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>San Francisco, CA</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('BookService', { provider })}
          className="bg-brand-500 py-4 rounded-2xl items-center"
          style={{ shadowColor: '#00C870', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
        >
          <Text className="text-white text-lg font-bold">Book Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
