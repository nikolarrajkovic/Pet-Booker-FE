import React from 'react';
import { SafeAreaView, View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
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
  const { t } = useLocale();

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View className="rounded-b-3xl bg-brand-500 px-6 pb-6" style={{ paddingTop: 48, zIndex: 1 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-white">{t('myServices.title')}</Text>
              <Text className="mt-1 text-sm text-brand-100">{t('myServices.previewSubtitle')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} className="ml-2">
            <Text className="font-semibold text-white">{t('myServices.edit')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image — pulled up to sit behind the rounded corners of the header */}
      <View
        className="items-center justify-center bg-gray-200"
        style={{ height: 220, marginTop: -24 }}>
        <View className="h-20 w-20 items-center justify-center rounded-full bg-gray-300">
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
