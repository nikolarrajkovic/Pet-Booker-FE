import React from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

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
  const { t } = useLocale();
  const { textColor, subtextColor, cardBg } = themeColors(isDarkMode);

  const hasImage = service.images && service.images.length > 0;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: showBookButton ? 100 : 20 }}>
      <View className="px-6 py-5">
        {/* Title and Badge */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className={`text-2xl font-bold ${textColor}`}>
              {service.name || t('shared.serviceNameFallback')}
            </Text>
            <Text className="mt-1 text-base text-brand-600">
              {service.type || t('shared.serviceTypeFallback')}
            </Text>
          </View>
          {service.isNew && (
            <View className="rounded-full bg-brand-500 px-3 py-1">
              <Text className="text-xs font-semibold text-white">{t('shared.newBadge')}</Text>
            </View>
          )}
        </View>

        {/* Rating and Distance */}
        {(service.rating || service.distance) && (
          <View className="mt-3 flex-row flex-wrap items-center">
            {service.rating && (
              <>
                <View className="flex-row items-center rounded-lg bg-brand-50 px-2 py-1">
                  <Ionicons name="star" size={16} color="#00C870" />
                  <Text className="ml-1 font-semibold text-brand-700">
                    {service.rating.toFixed(1)}
                  </Text>
                </View>
                <Text className={`${subtextColor} ml-2`}>
                  {t('shared.reviewsCount', { count: service.reviews || 0 })}
                </Text>
              </>
            )}
            {service.distance && (
              <View className="mt-2 flex-row items-center">
                <Ionicons name="location-outline" size={18} color="#6B7280" />
                <Text className={`${subtextColor} ml-1`}>
                  {t('shared.away', { distance: service.distance ?? '' })}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* About */}
        <View className="mt-6">
          <Text className={`text-lg font-semibold ${textColor} mb-2`}>{t('shared.about')}</Text>
          <Text className={`${subtextColor} leading-6`}>
            {service.description || t('shared.defaultServiceDescription')}
          </Text>
        </View>

        {/* Pricing */}
        <View className={`mt-6 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} rounded-2xl p-4`}>
          <Text className={`text-lg font-semibold ${textColor} mb-2`}>{t('shared.pricing')}</Text>
          <View className="flex-row items-baseline">
            <Text className="text-3xl font-bold text-brand-600">${service.price || 0}</Text>
            <Text className={`${subtextColor} ml-2`}>{t('shared.startingFrom')}</Text>
          </View>
        </View>

        {/* Additional Services */}
        {service.additionalServices &&
          Object.values(service.additionalServices).some((v) => v !== undefined && v !== null) && (
            <View className="mt-6">
              <Text className={`text-lg font-semibold ${textColor} mb-3`}>
                {t('shared.additionalServices')}
              </Text>
              <View className="space-y-2">
                {service.additionalServices.pickup !== undefined &&
                  service.additionalServices.pickup !== null && (
                    <View
                      className={`flex-row items-center justify-between rounded-xl p-3 ${isDarkMode ? 'bg-[#243447]' : 'bg-green-50'}`}>
                      <View className="flex-1 flex-row items-center">
                        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                          <Ionicons name="car-outline" size={20} color="#00C870" />
                        </View>
                        <Text className={`font-medium ${textColor}`}>
                          {t('shared.petPickupAvailable')}
                        </Text>
                      </View>
                      <Text className="font-semibold text-brand-600">
                        {service.additionalServices.pickup === 0
                          ? t('shared.includedFree')
                          : `$${service.additionalServices.pickup}`}
                      </Text>
                    </View>
                  )}
                {service.additionalServices.dropOff !== undefined &&
                  service.additionalServices.dropOff !== null && (
                    <View
                      className={`flex-row items-center justify-between rounded-xl p-3 ${isDarkMode ? 'bg-[#243447]' : 'bg-green-50'} mt-2`}>
                      <View className="flex-1 flex-row items-center">
                        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                          <Ionicons name="home-outline" size={20} color="#00C870" />
                        </View>
                        <Text className={`font-medium ${textColor}`}>
                          {t('shared.petDropoffAvailable')}
                        </Text>
                      </View>
                      <Text className="font-semibold text-brand-600">
                        {service.additionalServices.dropOff === 0
                          ? t('shared.includedFree')
                          : `$${service.additionalServices.dropOff}`}
                      </Text>
                    </View>
                  )}
              </View>
            </View>
          )}

        {/* Location */}
        <View className="mt-6">
          <Text className={`text-lg font-semibold ${textColor} mb-3`}>{t('shared.location')}</Text>
          <View
            className={`${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'} items-center rounded-2xl p-4`}>
            <View className="mb-2 h-12 w-12 items-center justify-center rounded-full bg-brand-100">
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
        <View
          className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-100'} px-6 py-4`}>
          <TouchableOpacity
            onPress={onBookPress}
            disabled={!onBookPress}
            className={`${onBookPress ? 'bg-brand-500' : 'bg-gray-300'} items-center rounded-2xl py-4`}
            style={
              onBookPress
                ? {
                    shadowColor: '#00C870',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }
                : {}
            }>
            <Text className="text-lg font-bold text-white">{t('shared.bookNow')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
