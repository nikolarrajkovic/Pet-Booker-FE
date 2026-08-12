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
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useCurrency } from '../../../hooks/useCurrency';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import {
  getService,
  ServiceDto,
  effectiveOptionPrice,
  serviceCurrency,
} from '../../../services/services';
import { ReviewDto } from '../../../services/reviews';
import {
  resolveImageUrl,
  ApprovalStatus,
  getServiceProvider,
  ServiceProviderDto,
} from '../../../services/service-providers';
import {
  getEnabledServiceAddons,
  addonPriceLabel,
  isPerDistance,
} from '../../../services/service-addons';
import {
  schedulesToWorkingHours,
  durationDisplayLabel,
} from '../../my-services-screen/serviceModel';
import { PetSpecies } from '../../../services/pets';

// The booker reads everything about ONE specific service here, then taps
// "Book Now" to proceed.
//
// Two ways in, because this screen is also the app's one deep-linkable page:
//   * from Home/Search, carrying the whole `service` — renders immediately, then
//     re-fetches for the parts a list read leaves out (the service's own reviews).
//   * from the URL `/services/:serviceId`, carrying only an id — nothing to render
//     until the fetch lands, so it shows a spinner first.
// Either way the mount fetch is the same call, so the id-only path costs nothing extra.
type ServiceDetailRouteParams = { service?: ServiceDto; serviceId?: number };

// Prefer the effective price (after any applied discount) the API returns.
const servicePrice = (s: ServiceDto) => s.price ?? s.pricing?.basePrice ?? 0;

/**
 * Whether a day's window covers the whole day. The backend stores an all-day schedule as
 * `00:00:00`–`23:59:59`, which surfaces as midnight to "24:00" — a range readers parse as a bug
 * rather than as "always open", so the caller swaps in a phrase instead.
 */
const isAllDay = (start: string, end: string) =>
  start.startsWith('00:00') && (end.startsWith('24:00') || end.startsWith('23:59'));

// Map an acceptedSpecies FLAGS value into species.* translation keys (63 = All → []).
const speciesKeys = (flags?: number): string[] => {
  if (flags == null || flags === PetSpecies.All) return [];
  const out: string[] = [];
  if (flags & PetSpecies.Dog) out.push('species.dogs');
  if (flags & PetSpecies.Cat) out.push('species.cats');
  if (flags & PetSpecies.Parrot) out.push('species.parrots');
  if (flags & PetSpecies.Turtle) out.push('species.turtles');
  if (flags & PetSpecies.Fish) out.push('species.fish');
  if (flags & PetSpecies.Snake) out.push('species.snakes');
  return out;
};

export default function ServiceDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ServiceDetailRouteParams }, 'params'>>();
  const { service, serviceId } = route.params ?? {};
  // The id is what identifies the screen; a passed `service` is just a head start on rendering.
  const id = service?.id ?? serviceId ?? null;
  const { width: screenWidth } = useWindowDimensions();
  const {
    isDarkMode,
    bgColor: contentBg,
    cardBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();
  const { t, tEnum } = useLocale();

  const [selectedService, setSelectedService] = useState<ServiceDto | null>(service ?? null);
  const [provider, setProvider] = useState<ServiceProviderDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        // The service GET carries details/schedules/pricing/photos/discounts and the
        // service's own reviews. Fails soft when we were handed a service — the lean
        // route-param one still renders (without reviews).
        const fullService = id != null ? await getService(id).catch(() => null) : null;
        if (cancelled) return;
        if (fullService) setSelectedService(fullService);
        // Arrived by URL with nothing to fall back on: an unknown or unapproved id
        // is a dead link, so say so rather than rendering an empty page.
        else if (!service) {
          setLoadFailed(true);
          return;
        }

        // Who runs it is a SECOND call: a service read carries only `serviceProviderId`,
        // never the provider record (there is no embed — the booking and review reads are
        // the ones that carry a slim provider). Fail-soft, because the provider card and
        // the verified badge are the only things that depend on it — the rest of the page
        // is the service itself.
        const providerId = fullService?.serviceProviderId ?? service?.serviceProviderId;
        if (providerId != null) {
          const dto = await getServiceProvider(providerId).catch(() => null);
          if (!cancelled && dto) setProvider(dto);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Prices belong to the service's provider, so they render in the service's currency.
  // Resolved before the early return below — a hook cannot sit behind one.
  const { money } = useCurrency(serviceCurrency(selectedService));

  // Deep-linked and still fetching: there is genuinely nothing to draw yet.
  if (!selectedService) {
    return (
      <ScreenLayout>
        <View className="flex-1 items-center justify-center p-8">
          {isLoading && !loadFailed ? (
            <ActivityIndicator size="large" color="#00A85A" />
          ) : (
            <Text className={`text-center ${subtextColor}`}>{t('serviceDetail.notFound')}</Text>
          )}
        </View>
      </ScreenLayout>
    );
  }

  const svc = selectedService;
  // Embedded reviews are service-level and carry every moderation status —
  // this is a public screen, so show only the approved ones.
  const reviews: ReviewDto[] = (svc.reviews ?? []).filter(
    (r) => r.approvalStatus === ApprovalStatus.Approved
  );
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
    svc.basicServiceName ?? (svc.type != null ? tEnum('serviceProviderType', svc.type) : '');

  // Provider profile photo — same rule as everywhere else: the selected one, else the first.
  const providerAvatar = (() => {
    const photos = provider?.photos ?? [];
    const chosen = photos.find((p) => p.isSelected) ?? photos[0];
    return chosen?.src ? resolveImageUrl(chosen.src) : '';
  })();

  // Service-level rating (falls back to the provider average / fetched reviews).
  const rating =
    svc.rating ??
    provider?.ratingAvg ??
    (reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0);
  // Count the reviews this page actually lists. `totalRatingNumber` is the PROVIDER's tally
  // across all their services, so a service with 2 approved reviews advertised "4 reviews" in
  // the header while the section below it read "Reviews (2)" — the same page disagreeing with
  // itself. Fall back to the provider tally only when the embed gave us nothing to show.
  const reviewCount = reviews.length || (svc.totalRatingNumber ?? 0);

  // Pricing options (duration/price variants): the header shows "from" the
  // cheapest option's effective price; the full list gets its own section and
  // the booker picks one on the Book Service screen. Option-less services keep
  // the classic single base/effective price.
  const pricingOptions = svc.pricingOptions ?? [];
  const hasOptions = pricingOptions.length > 0;
  const cheapestOption = hasOptions
    ? pricingOptions.reduce((min, o) =>
        effectiveOptionPrice(svc, o) < effectiveOptionPrice(svc, min) ? o : min
      )
    : null;
  const base = cheapestOption ? cheapestOption.price : (svc.pricing?.basePrice ?? 0);
  const effective = cheapestOption ? effectiveOptionPrice(svc, cheapestOption) : servicePrice(svc);
  const hasDiscount = base > 0 && effective < base;

  const addons = getEnabledServiceAddons(svc);
  const workingHours = schedulesToWorkingHours(svc.schedules);
  const openDays = Object.entries(workingHours).filter(([, h]) => h.enabled);
  const species = speciesKeys(svc.details?.acceptedSpecies);

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
      label:
        min && max
          ? t('serviceDetail.sessionsRange', { min, max })
          : min
            ? t('serviceDetail.sessionsMin', { min })
            : t('serviceDetail.sessionsMax', { max }),
    });
  }
  if (d?.minWeightKg || d?.maxWeightKg) {
    const min = d.minWeightKg ?? 0;
    const max = d.maxWeightKg ?? 0;
    facts.push({
      icon: 'barbell-outline',
      label:
        min && max
          ? t('serviceDetail.kgRange', { min, max })
          : min
            ? t('serviceDetail.kgMin', { min })
            : t('serviceDetail.kgMax', { max }),
    });
  }
  if (d?.supportsLiveTracking)
    facts.push({ icon: 'navigate-outline', label: t('serviceDetail.liveTracking') });
  if (d?.leadTimeHours)
    facts.push({
      icon: 'hourglass-outline',
      label: t('serviceDetail.bookAhead', { hours: d.leadTimeHours }),
    });

  const onBook = () => {
    (navigation as any).navigate('BookService', { service: selectedService });
  };

  // Opens (or reuses) the thread with this provider. The service is passed along so the
  // provider sees what the question is about; ChatScreen does the get-or-create.
  const onMessage = () => {
    if (!svc.serviceProviderId) return;
    (navigation as any).navigate('Chat', {
      serviceProviderId: svc.serviceProviderId,
      serviceId: svc.id ?? null,
      providerName: provider?.name ?? undefined,
      providerAvatar: resolveImageUrl(
        provider?.photos?.find((p) => p.isSelected)?.src ?? provider?.photos?.[0]?.src
      ),
      subtitle: svc.name ?? undefined,
    });
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
          <Text className="text-xl font-bold text-white">{t('serviceDetail.title')}</Text>
          <Text className={`${isDarkMode ? 'text-gray-300' : 'text-brand-100'} text-sm`}>
            {t('serviceDetail.subtitle')}
          </Text>
        </View>
      }>
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={BRAND_GREEN} />
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
                    <Ionicons name="star" size={16} color={BRAND_GREEN} />
                    <Text className="ml-1 font-semibold text-brand-700">{rating.toFixed(1)}</Text>
                  </View>
                  <Text className={`${subtextColor} ml-2`}>
                    {reviewCount}{' '}
                    {reviewCount === 1
                      ? t('serviceDetail.reviewSingular')
                      : t('serviceDetail.reviewPlural')}
                  </Text>
                </View>
              )}
              {provider?.isApproved && (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={16} color={BRAND_GREEN} />
                  <Text className="ml-1 text-sm text-brand-600">
                    {t('serviceDetail.verifiedProvider')}
                  </Text>
                </View>
              )}
            </View>

            <View className="mt-4 flex-row items-baseline">
              <Text className="text-3xl font-bold text-brand-600">{money(effective)}</Text>
              {hasDiscount ? (
                <Text className={`${subtextColor} ml-2 line-through`}>{money(base)}</Text>
              ) : null}
              <Text className={`${subtextColor} ml-2`}>{t('serviceDetail.startingFrom')}</Text>
            </View>
          </View>

          {/* About */}
          {(svc.description || svc.about) &&
            section(
              t('serviceDetail.about'),
              <Text className={`${subtextColor} leading-6`}>{svc.description ?? svc.about}</Text>
            )}

          {/* Provider */}
          {provider?.name &&
            section(
              t('serviceDetail.provider'),
              <View className="flex-row items-center">
                {providerAvatar ? (
                  <Image
                    source={{ uri: providerAvatar }}
                    className="mr-3 h-12 w-12 rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                    <Ionicons name="business-outline" size={22} color={BRAND_GREEN} />
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

          {/* Pricing options (duration/price variants) — the booker picks one
              on the Book Service screen */}
          {hasOptions &&
            section(
              t('serviceDetail.pricingOptions'),
              pricingOptions.map((option, idx) => {
                const optionEffective = effectiveOptionPrice(svc, option);
                return (
                  <View
                    key={option.id ?? idx}
                    className={`mb-2 flex-row items-center justify-between rounded-2xl p-3 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`}>
                    <View className="mr-3 flex-1 flex-row items-center">
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                        <Ionicons name="time-outline" size={20} color={BRAND_GREEN} />
                      </View>
                      <View className="flex-1">
                        <Text className={`font-medium ${textColor}`}>
                          {durationDisplayLabel(t, option.name)}
                        </Text>
                        <Text className={`text-xs ${subtextColor} mt-0.5`}>
                          {t('durations.nMin', { n: option.durationMinutes })}
                          {option.description ? ` • ${option.description}` : ''}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      {optionEffective < option.price && (
                        <Text className={`text-xs ${subtextColor} line-through`}>
                          {money(option.price)}
                        </Text>
                      )}
                      <Text className="font-semibold text-brand-600">{money(optionEffective)}</Text>
                    </View>
                  </View>
                );
              })
            )}

          {/* Additional services (add-ons) */}
          {addons.length > 0 &&
            section(
              t('serviceDetail.additionalServices'),
              addons.map((addon) => (
                <View
                  key={addon.id ?? addon.name}
                  className={`mb-2 flex-row items-center justify-between rounded-2xl p-3 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`}>
                  <View className="mr-3 flex-1 flex-row items-center">
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                      {/* Extras are provider-named now, so the icon comes from HOW it bills
                          rather than from a known name: a trip vs a flat service. */}
                      <Ionicons
                        name={isPerDistance(addon) ? 'car-outline' : 'heart-outline'}
                        size={20}
                        color={BRAND_GREEN}
                      />
                    </View>
                    <View className="flex-1">
                      {/* Provider-authored text — shown verbatim, nothing to translate. */}
                      <Text className={`font-medium ${textColor}`}>{addon.name}</Text>
                      {addon.description ? (
                        <Text className={`text-xs ${subtextColor} mt-0.5`}>
                          {addon.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text className="font-semibold text-brand-600">
                    {addonPriceLabel(t, addon, serviceCurrency(svc))
                      ? `+${addonPriceLabel(t, addon, serviceCurrency(svc))}`
                      : t('addons.included')}
                  </Text>
                </View>
              ))
            )}

          {/* Accepted pets */}
          {section(
            t('serviceDetail.acceptedPets'),
            species.length === 0 ? (
              <Text className={subtextColor}>{t('serviceDetail.allPetsWelcome')}</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {species.map((s) => (
                  <View
                    key={s}
                    className={`rounded-full px-3 py-1.5 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
                    <Text className={`text-sm ${textColor}`}>{t(s as any)}</Text>
                  </View>
                ))}
              </View>
            )
          )}

          {/* Extra facts */}
          {facts.length > 0 &&
            section(
              t('serviceDetail.goodToKnow'),
              <View className="flex-row flex-wrap gap-2">
                {facts.map((f) => (
                  <View
                    key={f.label}
                    className={`flex-row items-center rounded-xl px-3 py-2 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
                    <Ionicons name={f.icon} size={16} color={BRAND_GREEN} />
                    <Text className={`text-sm ${textColor} ml-2`}>{f.label}</Text>
                  </View>
                ))}
              </View>
            )}

          {/* Working hours */}
          {openDays.length > 0 &&
            section(
              t('serviceDetail.workingHours'),
              openDays.map(([day, h]) => (
                <View key={day} className="flex-row items-center justify-between py-1.5">
                  <Text className={`${textColor}`}>{t(`days.${day.toLowerCase()}` as any)}</Text>
                  <Text className={subtextColor}>
                    {/* A full-day window renders as a phrase, not "00:00 – 24:00" — which reads
                        like a data glitch rather than "we're open all day". */}
                    {isAllDay(h.startTime, h.endTime)
                      ? t('serviceDetail.openAllDay')
                      : `${h.startTime} – ${h.endTime}`}
                  </Text>
                </View>
              ))
            )}

          {/* Reviews */}
          {reviews.length > 0 &&
            section(
              t('serviceDetail.reviewsCount', { count: reviews.length }),
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

      {/* Sticky footer: ask a question, or book. The chat button sits alongside Book Now
          because the question that stops someone booking ("do you take reactive dogs?")
          occurs to them right here, before any booking exists to hang a thread off. */}
      <View
        className={`absolute bottom-0 left-0 right-0 flex-row items-center ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={onMessage}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('messages.messageProvider')}
          className={`mr-3 h-14 w-14 items-center justify-center rounded-2xl border ${borderColor} ${
            isLoading ? 'opacity-50' : ''
          }`}>
          <Ionicons name="chatbubble-outline" size={22} color={BRAND_GREEN} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBook}
          disabled={isLoading}
          className={`flex-1 items-center rounded-2xl py-4 ${isLoading ? 'bg-gray-300' : 'bg-brand-500'}`}
          style={
            isLoading
              ? {}
              : {
                  shadowColor: BRAND_GREEN,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }
          }>
          <Text className="text-lg font-bold text-white">{t('serviceDetail.bookNow')}</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
