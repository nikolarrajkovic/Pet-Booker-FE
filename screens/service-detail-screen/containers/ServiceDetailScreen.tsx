import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { getService, ServiceDto } from '../../../services/services';
import { getReviews, ReviewDto } from '../../../services/reviews';
import {
  getServiceProvider,
  resolveImageUrl,
  providerTypeLabel,
  ApprovalStatus,
  ServiceProviderDto,
} from '../../../services/service-providers';
import { getEnabledServiceAddons } from '../../../services/service-addons';
import { schedulesToWorkingHours } from '../../my-services-screen/serviceModel';
import { PetSpecies } from '../../../services/pets';

// The booker reads everything about ONE specific service here, then taps
// "Book Now" to proceed. The service arrives as a route param (carrying
// serviceProviderId) from Home/Search; both list endpoints return a leaner
// ServiceDto, so we re-fetch the full record on mount for the full picture.
type ServiceDetailRouteParams = { service: ServiceDto };

// Prefer the effective price (after any applied discount) the API returns.
const servicePrice = (s: ServiceDto) => s.price ?? s.pricing?.basePrice ?? 0;

// Map an acceptedSpecies FLAGS value into friendly labels (63 = All → []).
const speciesLabels = (flags?: number): string[] => {
  if (flags == null || flags === PetSpecies.All) return [];
  const out: string[] = [];
  if (flags & PetSpecies.Dog) out.push('Dogs');
  if (flags & PetSpecies.Cat) out.push('Cats');
  if (flags & PetSpecies.Parrot) out.push('Parrots');
  if (flags & PetSpecies.Turtle) out.push('Turtles');
  if (flags & PetSpecies.Fish) out.push('Fish');
  if (flags & PetSpecies.Snake) out.push('Snakes');
  return out;
};

export default function ServiceDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ServiceDetailRouteParams }, 'params'>>();
  const { service } = route.params;
  const { width: screenWidth } = useWindowDimensions();
  const {
    isDarkMode,
    bgColor: contentBg,
    cardBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();

  const [selectedService, setSelectedService] = useState<ServiceDto>(service);
  const [provider, setProvider] = useState<ServiceProviderDto | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        // Full service (with details/schedules/pricing) + the provider + the
        // provider's approved reviews, in parallel. Each fails soft so one
        // missing piece doesn't blank the screen.
        const [fullService, prov, rev] = await Promise.all([
          service.id != null ? getService(service.id).catch(() => null) : Promise.resolve(null),
          getServiceProvider(service.serviceProviderId).catch(() => null),
          getReviews({
            serviceProviderId: service.serviceProviderId,
            approvalStatus: ApprovalStatus.Approved,
          }).catch(() => [] as ReviewDto[]),
        ]);
        if (cancelled) return;
        if (fullService) setSelectedService(fullService);
        setProvider(prov);
        setReviews(rev);
      } catch (e) {
        console.warn('[ServiceDetailScreen] load failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [service.id, service.serviceProviderId]);

  const svc = selectedService;
  // All service photos for the gallery, profile photo (isSelected) first, then
  // the rest in order. Falls back to the precomputed imageUrl when there are no
  // photo records.
  const photoUris = (() => {
    const photos = svc.photos ?? [];
    const profile = photos.find((p) => p.isSelected) ?? photos[0];
    const ordered = profile ? [profile, ...photos.filter((p) => p !== profile)] : photos;
    const uris = ordered.map((p) => resolveImageUrl(p.src)).filter(Boolean);
    if (uris.length === 0) {
      const fallback = resolveImageUrl(svc.imageUrl);
      return fallback ? [fallback] : [];
    }
    return uris;
  })();
  const serviceTypeLabel =
    svc.basicServiceName ?? (svc.type != null ? providerTypeLabel(svc.type) : '');

  // Service-level rating (falls back to the provider average / fetched reviews).
  const rating =
    svc.rating ??
    provider?.ratingAvg ??
    (reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0);
  const reviewCount = svc.totalRatingNumber ?? reviews.length;

  const base = svc.pricing?.basePrice ?? 0;
  const effective = servicePrice(svc);
  const hasDiscount = base > 0 && effective < base;

  const addons = getEnabledServiceAddons(svc);
  const workingHours = schedulesToWorkingHours(svc.schedules);
  const openDays = Object.entries(workingHours).filter(([, h]) => h.enabled);
  const species = speciesLabels(svc.details?.acceptedSpecies);

  const address = provider?.address
    ? [provider.address.line1, provider.address.city, provider.address.state]
        .filter(Boolean)
        .join(', ')
    : null;

  // Extra facts worth surfacing before booking (only the ones the service sets).
  const facts: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [];
  const d = svc.details;
  if (d?.minDurationMinutes || d?.maxDurationMinutes) {
    const min = d.minDurationMinutes ?? 0;
    const max = d.maxDurationMinutes ?? 0;
    facts.push({
      icon: 'time-outline',
      label: min && max ? `${min}–${max} min sessions` : `${min || max} min ${min ? 'min' : 'max'}`,
    });
  }
  if (d?.minWeightKg || d?.maxWeightKg) {
    const min = d.minWeightKg ?? 0;
    const max = d.maxWeightKg ?? 0;
    facts.push({
      icon: 'barbell-outline',
      label: min && max ? `${min}–${max} kg pets` : `${min ? `${min}+` : `up to ${max}`} kg pets`,
    });
  }
  if (d?.supportsLiveTracking) facts.push({ icon: 'navigate-outline', label: 'Live tracking' });
  if (d?.leadTimeHours)
    facts.push({ icon: 'hourglass-outline', label: `Book ${d.leadTimeHours}h ahead` });

  const onBook = () => {
    (navigation as any).navigate('BookService', { service: selectedService });
  };

  // Render helper (not a nested component) so subtrees don't remount each render.
  const section = (title: string, content: React.ReactNode) => (
    <View className={`border-t px-6 py-5 ${borderColor}`}>
      <Text className={`text-lg font-semibold ${textColor} mb-3`}>{title}</Text>
      {content}
    </View>
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      contentBg={contentBg}
      contentRounded={false}
      headerChildren={
        <View className="flex-1">
          <Text className="text-xl font-bold text-white">Service Details</Text>
          <Text className={`${isDarkMode ? 'text-gray-300' : 'text-brand-100'} text-sm`}>
            Review before booking
          </Text>
        </View>
      }>
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#00C870" />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 110 }}>
          {/* Photo gallery — profile photo first, swipe through the rest */}
          {photoUris.length > 0 ? (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
                  setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / screenWidth))
                }>
                {photoUris.map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={{ width: screenWidth, height: 224 }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {photoUris.length > 1 && (
                <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
                  {photoUris.map((_, i) => (
                    <View
                      key={i}
                      className={`h-2 rounded-full ${i === activePhoto ? 'w-5 bg-white' : 'w-2 bg-white/60'}`}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View
              className={`h-56 w-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
              <Ionicons name="paw" size={48} color="#9CA3AF" />
            </View>
          )}

          {/* Title / type / rating / price */}
          <View className="px-6 py-5">
            <Text className={`text-2xl font-bold ${textColor}`}>{svc.name ?? 'Service'}</Text>
            {serviceTypeLabel ? (
              <Text className="mt-1 text-base text-brand-600">{serviceTypeLabel}</Text>
            ) : null}

            <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-2">
              {rating > 0 && (
                <View className="flex-row items-center">
                  <View className="flex-row items-center rounded-lg bg-brand-50 px-2 py-1">
                    <Ionicons name="star" size={16} color="#00C870" />
                    <Text className="ml-1 font-semibold text-brand-700">{rating.toFixed(1)}</Text>
                  </View>
                  <Text className={`${subtextColor} ml-2`}>
                    {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
              )}
              {provider?.isApproved && (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={16} color="#00C870" />
                  <Text className="ml-1 text-sm text-brand-600">Verified provider</Text>
                </View>
              )}
            </View>

            <View className="mt-4 flex-row items-baseline">
              <Text className="text-3xl font-bold text-brand-600">${effective}</Text>
              {hasDiscount ? (
                <Text className={`${subtextColor} ml-2 line-through`}>${base}</Text>
              ) : null}
              <Text className={`${subtextColor} ml-2`}>starting from</Text>
            </View>
          </View>

          {/* About */}
          {(svc.description || svc.about) &&
            section(
              'About',
              <Text className={`${subtextColor} leading-6`}>{svc.description ?? svc.about}</Text>
            )}

          {/* Provider */}
          {provider?.name &&
            section(
              'Provider',
              <View className="flex-row items-center">
                {provider.photos?.[0]?.src ? (
                  <Image
                    source={{ uri: resolveImageUrl(provider.photos[0].src) }}
                    className="mr-3 h-12 w-12 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                    <Ionicons name="business-outline" size={22} color="#00C870" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className={`font-semibold ${textColor}`}>{provider.name}</Text>
                  {address ? (
                    <View className="mt-0.5 flex-row items-center">
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text className={`${subtextColor} ml-1 flex-1 text-sm`}>{address}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

          {/* Additional services (add-ons) */}
          {addons.length > 0 &&
            section(
              'Additional Services',
              addons.map((addon) => (
                <View
                  key={addon.id}
                  className={`mb-2 flex-row items-center justify-between rounded-2xl p-3 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`}>
                  <View className="mr-3 flex-1 flex-row items-center">
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                      <Ionicons
                        name={
                          addon.id === 'pickup'
                            ? 'car-outline'
                            : addon.id === 'dropoff'
                              ? 'home-outline'
                              : 'heart-outline'
                        }
                        size={20}
                        color="#00C870"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className={`font-medium ${textColor}`}>{addon.name}</Text>
                      <Text className={`text-xs ${subtextColor} mt-0.5`}>{addon.description}</Text>
                    </View>
                  </View>
                  <Text className="font-semibold text-brand-600">
                    {addon.price > 0 ? `+$${addon.price}` : 'Included'}
                  </Text>
                </View>
              ))
            )}

          {/* Accepted pets */}
          {section(
            'Accepted Pets',
            species.length === 0 ? (
              <Text className={subtextColor}>All pets welcome</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {species.map((s) => (
                  <View
                    key={s}
                    className={`rounded-full px-3 py-1.5 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
                    <Text className={`text-sm ${textColor}`}>{s}</Text>
                  </View>
                ))}
              </View>
            )
          )}

          {/* Extra facts */}
          {facts.length > 0 &&
            section(
              'Good to Know',
              <View className="flex-row flex-wrap gap-2">
                {facts.map((f) => (
                  <View
                    key={f.label}
                    className={`flex-row items-center rounded-xl px-3 py-2 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
                    <Ionicons name={f.icon} size={16} color="#00C870" />
                    <Text className={`text-sm ${textColor} ml-2`}>{f.label}</Text>
                  </View>
                ))}
              </View>
            )}

          {/* Working hours */}
          {openDays.length > 0 &&
            section(
              'Working Hours',
              openDays.map(([day, h]) => (
                <View key={day} className="flex-row items-center justify-between py-1.5">
                  <Text className={`${textColor}`}>{day}</Text>
                  <Text className={subtextColor}>
                    {h.startTime} – {h.endTime}
                  </Text>
                </View>
              ))
            )}

          {/* Reviews */}
          {reviews.length > 0 &&
            section(
              `Reviews (${reviewCount})`,
              reviews.slice(0, 5).map((review, idx) => (
                <View
                  key={review.id ?? idx}
                  className={`${cardBg} border ${borderColor} mb-3 rounded-2xl p-4`}>
                  <View className="mb-2 flex-row items-center">
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
              ))
            )}
        </ScrollView>
      )}

      {/* Sticky Book Now — the only way forward into the booking flow */}
      <View
        className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={onBook}
          disabled={isLoading}
          className={`items-center rounded-2xl py-4 ${isLoading ? 'bg-gray-300' : 'bg-brand-500'}`}
          style={
            isLoading
              ? {}
              : {
                  shadowColor: '#00C870',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }
          }>
          <Text className="text-lg font-bold text-white">Book Now</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
