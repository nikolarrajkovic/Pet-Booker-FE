import React from 'react';
import { SafeAreaView, View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ServiceDetailView from '../../../components/shared/ServiceDetailView';

type ServicePreviewRouteParams = {
  service: {
    name: string;
    type: string;
    description: string;
    price: number;
    duration?: string;
    images?: string[];
    isNew?: boolean;
    additionalServices?: {
      pickup?: number;
      dropOff?: number;
    };
    workingHours?: any;
  };
};

export default function ServicePreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ServicePreviewRouteParams }, 'params'>>();
  const { service } = route.params;
  const { isDarkMode, bgColor } = useThemeColors();

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View className="bg-brand-500 px-6 pb-6 rounded-b-3xl" style={{ paddingTop: 48, zIndex: 1 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold">My Services</Text>
              <Text className="text-brand-100 text-sm mt-1">Create and manage your service listings</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} className="ml-2">
            <Text className="text-white font-semibold">Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image — pulled up to sit behind the rounded corners of the header */}
      <View className="bg-gray-200 items-center justify-center" style={{ height: 220, marginTop: -24 }}>
        <View className="w-20 h-20 bg-gray-300 rounded-full items-center justify-center">
          <Ionicons name="camera-outline" size={40} color="#9CA3AF" />
        </View>
      </View>

      {/* Service Detail View */}
      <ServiceDetailView
        service={service}
        isDarkMode={isDarkMode}
        showBookButton={true}
        onBookPress={undefined} // Disabled in preview
      />
    </SafeAreaView>
  );
}
