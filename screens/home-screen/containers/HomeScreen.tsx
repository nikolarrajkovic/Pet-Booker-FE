import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import TabBar from '../../../components/shared/TabBar';
import ServiceCard from '../../../components/shared/ServiceCard';
import SeeMoreCard from '../../../components/shared/SeeMoreCard';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocation } from '../../../hooks/useLocation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { getServiceProviders, providerToViewModel, ProviderViewModel } from '../../../services/service-providers';

// Service type pills — used to navigate to SearchScreen with a pre-set filter
const SERVICE_TYPES = [
  { id: 'dog-walking', label: 'Dog Walking', icon: 'walk' },
  { id: 'grooming', label: 'Grooming', icon: 'cut' },
  { id: 'boarding', label: 'Boarding', icon: 'home' },
  { id: 'training', label: 'Training', icon: 'school' },
  { id: 'veterinary', label: 'Veterinary', icon: 'medical' },
  { id: 'pet-sitting', label: 'Pet Sitting', icon: 'bed' },
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const location = useLocation();
  const { isDarkMode, textColor } = useThemeColors();

  const [providers, setProviders] = useState<ProviderViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const sectionTitleColor = textColor;
  const subtitleColor = isDarkMode ? 'text-gray-400' : 'text-brand-100';

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setIsLoading(true);
        try {
          const dtos = await getServiceProviders({ perPage: 40 });
          if (!cancelled) setProviders(dtos.map(providerToViewModel));
        } catch (e) {
          if (!cancelled) console.warn('[HomeScreen] Failed to load providers', e);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };

      load();
      return () => { cancelled = true; };
    }, [])
  );

  // Distribute providers across sections.
  // Phase 2: recentlyBooked → real booking history; specialDeals → providers with active discounts.
  const nearYou = providers.slice(0, 8);
  const mostPopular = [...providers].reverse().slice(0, 8);
  const recentlyBooked = providers.slice(0, 8);
  const specialDeals = providers.filter((_, i) => i % 3 === 0).slice(0, 8);

  const handleServicePress = (provider: ProviderViewModel) => {
    (navigation as any).navigate('ProviderDetail', { provider });
  };

  const handleServiceTypePress = (serviceType: string) => {
    (navigation as any).navigate('Search', { serviceType });
  };

  const handleSeeAll = (category: string) => {
    (navigation as any).navigate('Search', { category });
  };

  const renderSection = (
    title: string,
    icon: string,
    items: ProviderViewModel[],
    category: string,
    badge?: 'popular' | 'deal',
  ) => {
    if (!isLoading && items.length === 0) return null;
    return (
      <View className="mb-6">
        <View className="flex-row justify-between items-center px-6 mb-3">
          <View className="flex-row items-center">
            <Ionicons name={icon as any} size={20} color="#10B981" />
            <Text className={`font-semibold text-base ml-2 ${sectionTitleColor}`}>{title}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
          <View className="flex-row gap-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <View
                    key={i}
                    className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'}`}
                    style={{ width: 200, height: 160 }}
                  >
                    <View className={`flex-1 items-center justify-center`}>
                      <ActivityIndicator color="#00C870" />
                    </View>
                  </View>
                ))
              : items.map((provider) => (
                  <ServiceCard
                    key={provider.id}
                    image={provider.image}
                    name={provider.name}
                    service={provider.service}
                    rating={provider.rating}
                    reviews={provider.reviews}
                    distance={provider.distance || undefined}
                    price={provider.price}
                    badge={badge}
                    onPress={() => handleServicePress(provider)}
                  />
                ))}
            {!isLoading && <SeeMoreCard onPress={() => handleSeeAll(category)} />}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <ScreenLayout
      headerVariant="large"
      contentBg={contentBg}
      footer={<TabBar />}
      headerChildren={
        <>
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center flex-1">
              <Ionicons name="location-outline" size={18} color="#ffffff" />
              {location.loading ? (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginLeft: 8 }} />
              ) : (
                <Text className="text-white ml-2 text-sm" numberOfLines={1}>{location.address}</Text>
              )}
            </View>
            <TouchableOpacity className="p-2" onPress={() => (navigation as any).navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color="white" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="paw" size={24} color="white" />
            <Text className="text-white text-2xl font-bold ml-2">PawCare</Text>
          </View>
          <Text className={`${subtitleColor} text-sm mb-8`}>Find the perfect care for your pet</Text>
        </>
      }
    >

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Service Type Pills */}
        <View className="px-6 py-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-2">
            {SERVICE_TYPES.map((service, index) => (
              <TouchableOpacity
                key={service.id}
                onPress={() => handleServiceTypePress(service.label)}
                className={`rounded-full px-6 py-3 flex-row items-center mx-2 ${
                  index === 0
                    ? 'bg-blue-500'
                    : index === 1
                    ? 'bg-purple-500'
                    : 'bg-brand-500'
                }`}
              >
                <Ionicons name={service.icon as any} size={18} color="white" />
                <Text className="text-white font-semibold ml-2">{service.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {renderSection('Recently Booked', 'time-outline', recentlyBooked, 'recently-booked')}
        {renderSection('Near You', 'location-outline', nearYou, 'near-you')}
        {renderSection('Most Popular', 'trending-up-outline', mostPopular, 'most-popular', 'popular')}
        {renderSection('Special Deals', 'pricetag-outline', specialDeals, 'special-deals', 'deal')}

        {!isLoading && providers.length === 0 && (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <Ionicons name="paw-outline" size={48} color="#9CA3AF" />
            <Text className={`text-lg font-semibold ${sectionTitleColor} mt-4 text-center`}>No providers found</Text>
            <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2 text-center`}>
              Check back soon — new partners are joining every day.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
