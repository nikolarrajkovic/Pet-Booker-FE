import React from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';

interface ServiceDetailViewProps {
  service: {
    name: string;
    type: string;
    description: string;
    price: number;
    images?: string[];
    isNew?: boolean;
    rating?: number;
    reviews?: number;
    distance?: string;
    additionalServices?: {
      pickup?: number;
      dropOff?: number;
      photoUpdates?: number;
      medicationAdmin?: number;
      specialNeeds?: number;
    };
  };
  isDarkMode: boolean;
  showBookButton?: boolean;
  onBookPress?: () => void;
}

export default function ServiceDetailView({
  service,
  isDarkMode,
  showBookButton = true,
  onBookPress,
}: ServiceDetailViewProps) {
  const { textColor, subtextColor, cardBg } = themeColors(isDarkMode);

  const hasImage = service.images && service.images.length > 0;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: showBookButton ? 100 : 20 }}>
      <View className="px-6 py-5">
        {/* Title and Badge */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className={`text-2xl font-bold ${textColor}`}>{service.name || 'Service Name'}</Text>
            <Text className="text-brand-600 text-base mt-1">{service.type || 'Service Type'}</Text>
          </View>
          {service.isNew && (
            <View className="bg-brand-500 px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-semibold">New</Text>
            </View>
          )}
        </View>

        {/* Rating and Distance */}
        {(service.rating || service.distance) && (
          <View className="flex-row items-center mt-3 flex-wrap">
            {service.rating && (
              <>
                <View className="flex-row items-center bg-brand-50 px-2 py-1 rounded-lg">
                  <Ionicons name="star" size={16} color="#00C870" />
                  <Text className="text-brand-700 font-semibold ml-1">{service.rating}</Text>
                </View>
                <Text className={`${subtextColor} ml-2`}>{service.reviews || 0} reviews</Text>
              </>
            )}
            {service.distance && (
              <View className="flex-row items-center mt-2">
                <Ionicons name="location-outline" size={18} color="#6B7280" />
                <Text className={`${subtextColor} ml-1`}>{service.distance} away</Text>
              </View>
            )}
          </View>
        )}

        {/* About */}
        <View className="mt-6">
          <Text className={`text-lg font-semibold ${textColor} mb-2`}>About</Text>
          <Text className={`${subtextColor} leading-6`}>
            {service.description || 'Experienced and caring pet service provider dedicated to giving your furry friend the best care possible.'}
          </Text>
        </View>

        {/* Pricing */}
        <View className={`mt-6 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} rounded-2xl p-4`}>
          <Text className={`text-lg font-semibold ${textColor} mb-2`}>Pricing</Text>
          <View className="flex-row items-baseline">
            <Text className="text-3xl font-bold text-brand-600">${service.price || 0}</Text>
            <Text className={`${subtextColor} ml-2`}>starting from</Text>
          </View>
        </View>

        {/* Additional Services */}
        {service.additionalServices && Object.values(service.additionalServices).some(v => v !== undefined && v !== null) && (
          <View className="mt-6">
            <Text className={`text-lg font-semibold ${textColor} mb-3`}>Additional Services</Text>
            <View className="space-y-2">
              {service.additionalServices.pickup !== undefined && service.additionalServices.pickup !== null && (
                <View className={`flex-row items-center justify-between p-3 rounded-xl ${isDarkMode ? 'bg-[#243447]' : 'bg-green-50'}`}>
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 bg-brand-100 rounded-full items-center justify-center mr-3">
                      <Ionicons name="car-outline" size={20} color="#00C870" />
                    </View>
                    <Text className={`font-medium ${textColor}`}>Pet Pickup Available</Text>
                  </View>
                  <Text className="text-brand-600 font-semibold">
                    {service.additionalServices.pickup === 0 ? 'Included free' : `$${service.additionalServices.pickup}`}
                  </Text>
                </View>
              )}
              {service.additionalServices.dropOff !== undefined && service.additionalServices.dropOff !== null && (
                <View className={`flex-row items-center justify-between p-3 rounded-xl ${isDarkMode ? 'bg-[#243447]' : 'bg-green-50'} mt-2`}>
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 bg-brand-100 rounded-full items-center justify-center mr-3">
                      <Ionicons name="home-outline" size={20} color="#00C870" />
                    </View>
                    <Text className={`font-medium ${textColor}`}>Pet Drop-off Available</Text>
                  </View>
                  <Text className="text-brand-600 font-semibold">
                    {service.additionalServices.dropOff === 0 ? 'Included free' : `$${service.additionalServices.dropOff}`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Location */}
        <View className="mt-6">
          <Text className={`text-lg font-semibold ${textColor} mb-3`}>Location</Text>
          <View className={`${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'} rounded-2xl p-4 items-center`}>
            <View className="w-12 h-12 bg-brand-100 rounded-full items-center justify-center mb-2">
              <Ionicons name="location" size={24} color="#00C870" />
            </View>
            <Text className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>
              San Francisco, CA
            </Text>
          </View>
        </View>
      </View>

      {/* Book Button - only shown if showBookButton is true */}
      {showBookButton && (
        <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-100'} px-6 py-4`}>
          <TouchableOpacity
            onPress={onBookPress}
            disabled={!onBookPress}
            className={`${onBookPress ? 'bg-brand-500' : 'bg-gray-300'} py-4 rounded-2xl items-center`}
            style={onBookPress ? { shadowColor: '#00C870', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 } : {}}
          >
            <Text className="text-white text-lg font-bold">Book Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
