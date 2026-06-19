import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { getServices, ServiceDto } from '../../../services/services';
import { getReviews, ReviewDto } from '../../../services/reviews';
import { ApprovalStatus } from '../../../services/service-providers';
import type { ProviderViewModel } from '../../../services/service-providers';

type ProviderDetailRouteParams = {
  provider: ProviderViewModel;
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600';

export default function ProviderDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ProviderDetailRouteParams }, 'params'>>();
  const { provider } = route.params;
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();

  const [services, setServices] = useState<ServiceDto[]>([]);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const [svc, rev] = await Promise.all([
          getServices({ serviceProviderId: provider.id }),
          // Reviews are admin-moderated — only show approved ones publicly
          getReviews({ serviceProviderId: provider.id, approvalStatus: ApprovalStatus.Approved }),
        ]);
        if (!cancelled) {
          setServices(svc);
          setReviews(rev);
        }
      } catch (e) {
        console.warn('[ProviderDetailScreen] Failed to load details', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [provider.id]);

  // Derive real rating + starting price from fetched data when available
  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : provider.rating;
  const reviewCount = reviews.length || provider.reviews;
  // Prefer the effective price (after any applied discount) the API returns
  const servicePrice = (s: ServiceDto) => s.price ?? s.pricing?.basePrice ?? 0;
  const startingPrice = services.length
    ? Math.min(...services.map(servicePrice))
    : provider.price;
  const address = provider.address
    ? [provider.address.line1, provider.address.city, provider.address.state]
        .filter(Boolean)
        .join(', ')
    : null;

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Hero image */}
      <View className="relative">
        <Image
          source={{ uri: provider.image || FALLBACK_IMAGE }}
          className="w-full h-64"
          resizeMode="cover"
        />
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="absolute top-12 left-4 w-10 h-10 bg-white rounded-full items-center justify-center"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header info */}
        <View className="px-6 py-5">
          <Text className={`text-2xl font-bold ${textColor}`}>{provider.name}</Text>
          <Text className="text-brand-600 text-base mt-1">{provider.service}</Text>

          <View className="flex-row items-center mt-3 gap-4">
            {(avgRating > 0 || reviewCount > 0) && (
              <>
                <View className="flex-row items-center bg-brand-50 px-2 py-1 rounded-lg">
                  <Ionicons name="star" size={16} color="#00C870" />
                  <Text className="text-brand-700 font-semibold ml-1">{avgRating || '—'}</Text>
                </View>
                <Text className={subtextColor}>
                  {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </Text>
              </>
            )}
            {provider.verified && (
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color="#00C870" />
                <Text className="text-brand-600 text-sm ml-1">Verified</Text>
              </View>
            )}
          </View>

          {address ? (
            <View className="flex-row items-center mt-3">
              <Ionicons name="location-outline" size={18} color="#6B7280" />
              <Text className={`${subtextColor} ml-1 flex-1`}>{address}</Text>
            </View>
          ) : null}
        </View>

        {/* Pricing summary */}
        <View className={`mx-6 mb-4 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} rounded-2xl p-4`}>
          <Text className={`text-lg font-semibold ${textColor} mb-1`}>Pricing</Text>
          {startingPrice > 0 ? (
            <View className="flex-row items-baseline">
              <Text className="text-3xl font-bold text-brand-600">${startingPrice}</Text>
              <Text className={`${subtextColor} ml-2`}>starting from</Text>
            </View>
          ) : (
            <Text className={subtextColor}>Contact for pricing</Text>
          )}
        </View>

        {/* About — BACKEND-GAP P3: provider DTO has no about/bio field, so this copy is mocked */}
        <View className="px-6 mb-4">
          <Text className={`text-lg font-semibold ${textColor} mb-2`}>About</Text>
          <Text className={`${subtextColor} leading-6`}>
            {provider.name} is a trusted {provider.service.toLowerCase()} provider on PawCare,
            dedicated to giving every pet attentive, loving care.
          </Text>
        </View>

        {/* Location — uses the real provider address when available */}
        <View className="px-6 mb-4">
          <Text className={`text-lg font-semibold ${textColor} mb-3`}>Location</Text>
          <View className={`${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'} rounded-2xl p-4 items-center`}>
            <View className="w-12 h-12 bg-brand-100 rounded-full items-center justify-center mb-2">
              <Ionicons name="location" size={24} color="#00C870" />
            </View>
            <Text className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium text-center`}>
              {address || 'Location available after booking'}
            </Text>
          </View>
        </View>

        {/* Services or loading */}
        {isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator color="#00C870" />
            <Text className={`text-sm ${subtextColor} mt-2`}>Loading services...</Text>
          </View>
        ) : (
          <>
            {/* Services list — tap a service to book that specific service */}
            {services.length > 0 && (
              <View className="px-6 mb-6">
                <Text className={`text-lg font-semibold ${textColor} mb-1`}>Services</Text>
                <Text className={`text-sm ${subtextColor} mb-3`}>Tap a service to book it</Text>
                {services.map((svc, idx) => (
                  <TouchableOpacity
                    key={svc.id ?? idx}
                    onPress={() =>
                      (navigation as any).navigate('BookService', { service: svc })
                    }
                    className={`${cardBg} border ${borderColor} rounded-2xl p-4 mb-3`}
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-3">
                        <Text className={`font-semibold ${textColor}`}>{svc.name ?? 'Service'}</Text>
                        {svc.description || svc.about ? (
                          <Text className={`text-sm ${subtextColor} mt-1`}>{svc.description ?? svc.about}</Text>
                        ) : null}
                        {svc.details?.isPickupProvided && (
                          <Text className="text-xs text-brand-600 mt-1">Pickup available</Text>
                        )}
                        {svc.details?.isPetReturnProvided && (
                          <Text className="text-xs text-brand-600 mt-0.5">Leave-over available</Text>
                        )}
                      </View>
                      <View className="items-end">
                        <Text className="text-brand-600 font-bold text-base">${servicePrice(svc)}</Text>
                        <View className="flex-row items-center mt-2 bg-brand-500 px-4 py-1.5 rounded-full">
                          <Ionicons name="calendar-outline" size={13} color="white" />
                          <Text className="text-white text-xs font-bold ml-1">Book</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Reviews list */}
            {reviews.length > 0 && (
              <View className="px-6 mb-6">
                <Text className={`text-lg font-semibold ${textColor} mb-3`}>
                  Reviews ({reviewCount})
                </Text>
                {reviews.slice(0, 5).map((review, idx) => (
                  <View
                    key={review.id ?? idx}
                    className={`${cardBg} border ${borderColor} rounded-2xl p-4 mb-3`}
                  >
                    <View className="flex-row items-center mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < review.rating ? 'star' : 'star-outline'}
                          size={14}
                          color="#F59E0B"
                        />
                      ))}
                    </View>
                    {review.title ? (
                      <Text className={`font-semibold ${textColor} mb-1`}>{review.title}</Text>
                    ) : null}
                    {review.comment ? (
                      <Text className={`text-sm ${subtextColor}`}>{review.comment}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
