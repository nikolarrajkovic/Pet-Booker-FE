import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TabBar from '../../../components/shared/TabBar';
import ServiceCard from '../../../components/shared/ServiceCard';
import SeeMoreCard from '../../../components/shared/SeeMoreCard';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useLocation } from '../../../hooks/useLocation';
import { useThemeColors } from '../../../hooks/useThemeColors';

// Service types for the pill buttons
const SERVICE_TYPES = [
  { id: 'dog-walking', label: 'Dog Walking', icon: 'walk' },
  { id: 'grooming', label: 'Grooming', icon: 'cut' },
  { id: 'boarding', label: 'Boarding', icon: 'home' },
  { id: 'training', label: 'Training', icon: 'school' },
  { id: 'veterinary', label: 'Veterinary', icon: 'medical' },
  { id: 'pet-sitting', label: 'Pet Sitting', icon: 'bed' },
];

// Mock data for services - this would come from your API
// Using the same structure as search screen providers
const MOCK_SERVICES = {
  recentlyBooked: [
    { id: 1, name: 'Happy Paws Care', service: 'Dog Walking', rating: 4.9, reviews: 128, distance: '0.5 mi', price: 25, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300', verified: true },
    { id: 2, name: 'Pampere Grooming', service: 'Grooming', rating: 4.8, reviews: 95, distance: '0.8 mi', price: 35, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300', verified: true },
    { id: 3, name: 'Wagging Tails', service: 'Dog Walking', rating: 4.7, reviews: 112, distance: '1.2 mi', price: 22, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300', verified: true },
    { id: 4, name: 'Furry Friends Spa', service: 'Grooming', rating: 4.9, reviews: 156, distance: '0.9 mi', price: 40, image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300', verified: true },
    { id: 5, name: 'Paws on the Go', service: 'Dog Walking', rating: 4.6, reviews: 89, distance: '1.5 mi', price: 20, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300', verified: false },
    { id: 6, name: 'Luxury Pet Care', service: 'Grooming', rating: 4.8, reviews: 134, distance: '2.1 mi', price: 45, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300', verified: true },
    { id: 7, name: 'Daily Dog Walks', service: 'Dog Walking', rating: 4.7, reviews: 98, distance: '0.6 mi', price: 23, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300', verified: true },
    { id: 8, name: 'Pampered Paws', service: 'Grooming', rating: 4.9, reviews: 145, distance: '1.8 mi', price: 38, image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300', verified: true },
  ],
  nearYou: [
    { id: 9, name: 'Paws Around Corner', service: 'Dog Walking', rating: 4.8, reviews: 156, distance: '0.2 mi', price: 20, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300', verified: true },
    { id: 10, name: 'Local Pet Grooming', service: 'Grooming', rating: 4.7, reviews: 89, distance: '0.3 mi', price: 30, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300', verified: true },
    { id: 11, name: 'Nearby Pet Care', service: 'Pet Sitting', rating: 4.9, reviews: 201, distance: '0.4 mi', price: 28, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300', verified: true },
    { id: 12, name: 'Corner Vet Clinic', service: 'Veterinary', rating: 4.8, reviews: 178, distance: '0.5 mi', price: 50, image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300', verified: true },
    { id: 13, name: 'Quick Walk Service', service: 'Dog Walking', rating: 4.6, reviews: 92, distance: '0.3 mi', price: 18, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300', verified: false },
    { id: 14, name: 'Express Grooming', service: 'Grooming', rating: 4.7, reviews: 115, distance: '0.4 mi', price: 32, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300', verified: true },
    { id: 15, name: 'Close By Boarding', service: 'Boarding', rating: 4.8, reviews: 167, distance: '0.6 mi', price: 45, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300', verified: true },
    { id: 16, name: 'Next Door Pets', service: 'Pet Sitting', rating: 4.9, reviews: 143, distance: '0.2 mi', price: 25, image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300', verified: true },
  ],
  mostPopular: [
    { id: 17, name: 'Luxury Pet Grooming', service: 'Grooming', rating: 5.0, reviews: 267, distance: '1.5 mi', price: 55, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300', verified: true, badge: 'popular' as const },
    { id: 18, name: 'Happy Paws Elite', service: 'Dog Walking', rating: 4.9, reviews: 328, distance: '0.5 mi', price: 30, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300', verified: true, badge: 'popular' as const },
    { id: 19, name: 'Premium Pet Hotel', service: 'Boarding', rating: 4.9, reviews: 289, distance: '2.1 mi', price: 60, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300', verified: true, badge: 'popular' as const },
    { id: 20, name: 'Top Rated Sitting', service: 'Pet Sitting', rating: 5.0, reviews: 245, distance: '1.2 mi', price: 35, image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300', verified: true, badge: 'popular' as const },
    { id: 21, name: 'Best Training Hub', service: 'Training', rating: 4.9, reviews: 312, distance: '1.8 mi', price: 40, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300', verified: true, badge: 'popular' as const },
    { id: 22, name: 'Elite Vet Care', service: 'Veterinary', rating: 5.0, reviews: 398, distance: '2.3 mi', price: 75, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300', verified: true, badge: 'popular' as const },
    { id: 23, name: 'Star Grooming Salon', service: 'Grooming', rating: 4.9, reviews: 276, distance: '1.6 mi', price: 48, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300', verified: true, badge: 'popular' as const },
    { id: 24, name: 'Premier Dog Walks', service: 'Dog Walking', rating: 4.8, reviews: 234, distance: '0.9 mi', price: 28, image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300', verified: true, badge: 'popular' as const },
  ],
  specialDeals: [
    { id: 25, name: 'Budget Dog Walking', service: 'Dog Walking', rating: 4.7, reviews: 145, distance: '0.9 mi', price: 15, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300', verified: true, badge: 'deal' as const },
    { id: 26, name: 'Discount Grooming', service: 'Grooming', rating: 4.6, reviews: 78, distance: '1.2 mi', price: 22, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300', verified: false, badge: 'deal' as const },
    { id: 27, name: 'Affordable Boarding', service: 'Boarding', rating: 4.8, reviews: 193, distance: '1.5 mi', price: 32, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300', verified: true, badge: 'deal' as const },
    { id: 28, name: 'Value Pet Sitting', service: 'Pet Sitting', rating: 4.7, reviews: 167, distance: '0.8 mi', price: 20, image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300', verified: true, badge: 'deal' as const },
    { id: 29, name: 'Save on Training', service: 'Training', rating: 4.5, reviews: 89, distance: '2.1 mi', price: 25, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300', verified: false, badge: 'deal' as const },
    { id: 30, name: 'Promo Vet Visit', service: 'Veterinary', rating: 4.6, reviews: 112, distance: '1.8 mi', price: 35, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300', verified: true, badge: 'deal' as const },
    { id: 31, name: 'Special Walk Rates', service: 'Dog Walking', rating: 4.8, reviews: 156, distance: '1.1 mi', price: 18, image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300', verified: true, badge: 'deal' as const },
    { id: 32, name: 'Deal Grooming Pro', service: 'Grooming', rating: 4.7, reviews: 134, distance: '1.4 mi', price: 28, image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300', verified: true, badge: 'deal' as const },
  ],
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const location = useLocation();
  const { isDarkMode, textColor } = useThemeColors();

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const sectionTitleColor = textColor;
  const subtitleColor = isDarkMode ? 'text-gray-400' : 'text-brand-100';

  const handleServicePress = (provider: any) => {
    // Navigate to provider detail screen with the provider object
    (navigation as any).navigate('ProviderDetail', { provider });
  };

  const handleServiceTypePress = (serviceType: string) => {
    // Navigate to search screen with service type filter
    (navigation as any).navigate('Search', { serviceType });
  };

  const handleSeeAll = (category: string) => {
    // Navigate to search screen with category filter
    (navigation as any).navigate('Search', { category });
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

        {/* Recently Booked Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center px-6 mb-3">
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={20} color={isDarkMode ? '#10B981' : '#10B981'} />
              <Text className={`font-semibold text-base ml-2 ${sectionTitleColor}`}>Recently Booked</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
            <View className="flex-row gap-3">
              {MOCK_SERVICES.recentlyBooked.map((service) => (
                <ServiceCard
                  key={service.id}
                  image={service.image}
                  name={service.name}
                  service={service.service}
                  rating={service.rating}
                  reviews={service.reviews}
                  distance={service.distance}
                  price={service.price}
                  onPress={() => handleServicePress(service)}
                />
              ))}
              <SeeMoreCard onPress={() => handleSeeAll('recently-booked')} />
            </View>
          </ScrollView>
        </View>

        {/* Near You Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center px-6 mb-3">
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={20} color={isDarkMode ? '#10B981' : '#10B981'} />
              <Text className={`font-semibold text-base ml-2 ${sectionTitleColor}`}>Near You</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
            <View className="flex-row gap-3">
              {MOCK_SERVICES.nearYou.map((service) => (
                <ServiceCard
                  key={service.id}
                  image={service.image}
                  name={service.name}
                  service={service.service}
                  rating={service.rating}
                  reviews={service.reviews}
                  distance={service.distance}
                  price={service.price}
                  onPress={() => handleServicePress(service)}
                />
              ))}
              <SeeMoreCard onPress={() => handleSeeAll('near-you')} />
            </View>
          </ScrollView>
        </View>

        {/* Most Popular Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center px-6 mb-3">
            <View className="flex-row items-center">
              <Ionicons name="trending-up-outline" size={20} color={isDarkMode ? '#10B981' : '#10B981'} />
              <Text className={`font-semibold text-base ml-2 ${sectionTitleColor}`}>Most Popular</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
            <View className="flex-row gap-3">
              {MOCK_SERVICES.mostPopular.map((service) => (
                <ServiceCard
                  key={service.id}
                  image={service.image}
                  name={service.name}
                  service={service.service}
                  rating={service.rating}
                  reviews={service.reviews}
                  distance={service.distance}
                  price={service.price}
                  badge={service.badge}
                  onPress={() => handleServicePress(service)}
                />
              ))}
              <SeeMoreCard onPress={() => handleSeeAll('most-popular')} />
            </View>
          </ScrollView>
        </View>

        {/* Special Deals Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center px-6 mb-3">
            <View className="flex-row items-center">
              <Ionicons name="pricetag-outline" size={20} color={isDarkMode ? '#10B981' : '#10B981'} />
              <Text className={`font-semibold text-base ml-2 ${sectionTitleColor}`}>Special Deals</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6">
            <View className="flex-row gap-3">
              {MOCK_SERVICES.specialDeals.map((service) => (
                <ServiceCard
                  key={service.id}
                  image={service.image}
                  name={service.name}
                  service={service.service}
                  rating={service.rating}
                  reviews={service.reviews}
                  distance={service.distance}
                  price={service.price}
                  badge={service.badge}
                  onPress={() => handleServicePress(service)}
                />
              ))}
              <SeeMoreCard onPress={() => handleSeeAll('special-deals')} />
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
