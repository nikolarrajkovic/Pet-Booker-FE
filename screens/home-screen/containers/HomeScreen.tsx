import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import TabBar from '../../../components/shared/TabBar';
import ServiceCard from '../../../components/shared/ServiceCard';
import SeeMoreCard from '../../../components/shared/SeeMoreCard';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import Rail from '../../../components/shared/Rail';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useLocation } from '../../../hooks/useLocation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useTabBarSpacing } from '../../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../../context/LocaleContext';
import { resolveImageUrl } from '../../../services/service-providers';
import { getErrorMessage } from '../../../services/http';
import { ServiceDto, serviceCurrency } from '../../../services/services';
import { getMostPopular, getOnSale, getRecentlyBooked, getNearMe } from '../../../services/home';
import { useNotifications } from '../../../context/NotificationsContext';
import { useMessages } from '../../../context/MessagesContext';
import { DiscountType } from '../../../services/service-discounts';
import { formatOfferAmount } from '../../../screens/promotions-screen/components';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600';

// Service type pills — `label` is the serviceProviderType enum `displayName`
// (Sitter/Walker/Boarder/Pet Hotel/Groomer/Transporter), passed to Search so its
// reverse lookup (providerTypeValue) resolves the tapped pill back to its enum
// value. Keep in sync with PROVIDER_TYPE_LABELS in services/service-providers.ts
// — a type missing here is simply unreachable from Home.
// The DISPLAYED text is localized via tEnum(value); the nav key stays English.
const SERVICE_TYPES = [
  { id: 'pet-sitting', label: 'Sitter', value: 0, icon: 'bed' },
  { id: 'dog-walking', label: 'Walker', value: 1, icon: 'walk' },
  { id: 'boarding', label: 'Boarder', value: 2, icon: 'home' },
  { id: 'pet-hotel', label: 'Pet Hotel', value: 3, icon: 'business' },
  { id: 'grooming', label: 'Groomer', value: 4, icon: 'cut' },
  { id: 'transport', label: 'Transporter', value: 5, icon: 'car' },
];

/**
 * The category pills: a sideways scroller on a phone, a wrapping row on the web design.
 *
 * Same children either way — only the container differs, which is what keeps the pills' own
 * markup (colours, labels, accessibility) in one place rather than duplicated per design.
 */
function PillRow({ isWebLayout, children }: { isWebLayout: boolean; children: React.ReactNode }) {
  if (isWebLayout) {
    return <View className="-mx-2 flex-row flex-wrap">{children}</View>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2 flex-row">
      {children}
    </ScrollView>
  );
}

/** A service flattened for ServiceCard. Booking targets the service itself. */
type ServiceItem = {
  id: number;
  name: string;
  subtitle: string;
  rating: number;
  reviews: number;
  price: number;
  image: string;
  dealAmount?: string; // formatted discount (e.g. "3% OFF") for Special Deals cards
  dto: ServiceDto; // the real service record — carries serviceProviderId for booking
};

/**
 * "25% OFF" / "€5 OFF" for a service's currently-active promotion.
 *
 * The server resolves which of a service's discounts is live (window + enabled) and reports the
 * outcome as `appliedDiscountType`/`appliedDiscountAmount`, so the rail row already says what the
 * badge should read. This used to be worked out client-side from a separate fetch of the whole
 * discount table — which was both an extra request per Home load and quietly wrong, because that
 * fetch was capped at one page: once the system held more than 100 discounts, services whose row
 * fell off page one silently lost their badge.
 */
function dealLabel(svc: ServiceDto): string | undefined {
  const amount = svc.appliedDiscountAmount;
  if (amount == null) return undefined;
  // formatOfferAmount takes percentAmount separately so it can win over a mislabelled row; for a
  // percent promotion the applied amount IS the percentage.
  const isPercent = svc.appliedDiscountType === DiscountType.Percent;
  return formatOfferAmount(
    svc.appliedDiscountType ?? undefined,
    amount,
    serviceCurrency(svc),
    isPercent ? amount : undefined
  );
}

/** Flattens a ServiceDto from a home endpoint into a card item. */
function toServiceItem(svc: ServiceDto): ServiceItem | null {
  if (svc.id == null) return null;
  const photoSrc = svc.imageUrl ?? (svc.photos?.find((p) => p.isSelected) ?? svc.photos?.[0])?.src;
  return {
    id: svc.id,
    name: svc.name ?? svc.basicServiceName ?? 'Service',
    // Backend free-text name if present; else the (localized-at-render) type label.
    subtitle: svc.basicServiceName ?? '',
    rating: svc.rating ?? 0,
    reviews: svc.totalRatingNumber ?? 0,
    price: svc.price ?? svc.pricing?.basePrice ?? 0,
    image: resolveImageUrl(photoSrc) || FALLBACK_IMAGE,
    dto: svc,
  };
}

const toItems = (dtos: ServiceDto[]): ServiceItem[] =>
  dtos.map(toServiceItem).filter((i): i is ServiceItem => i !== null);

export default function HomeScreen() {
  const navigation = useNavigation();
  const location = useLocation();
  const { isDarkMode, textColor, subtextColor } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const tabBarSpacing = useTabBarSpacing();
  const { t, tEnum } = useLocale();

  const [nearYou, setNearYou] = useState<ServiceItem[]>([]);
  const [mostPopular, setMostPopular] = useState<ServiceItem[]>([]);
  const [recentlyBooked, setRecentlyBooked] = useState<ServiceItem[]>([]);
  const [specialDeals, setSpecialDeals] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Near You answers on its own clock, so it settles separately. Both flags gate the single
  // placeholder this screen still draws, which may only appear once every row has answered.
  const [nearYouLoading, setNearYouLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nearYouFailed, setNearYouFailed] = useState(false);
  const [reloads, setReloads] = useState(0);
  // Live badge counts — kept current by the SignalR pushes in the two providers.
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const { unreadCount: unreadMessages, refreshUnreadCount: refreshUnreadMessages } = useMessages();

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const subtitleColor = isDarkMode ? 'text-gray-400' : 'text-brand-100';

  const { latitude, longitude, loading: locating } = location;

  // The three rails that are the same wherever the phone is. Deliberately NOT keyed on the
  // device position: they used to share an effect with Near You, so the moment the GPS fix
  // replaced useLocation's placeholder every rail on the page refetched — eight requests to
  // render four rows, three of them for identical results.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setIsLoading(true);
        setLoadError(null);
        // Each Home row is its own backend endpoint. Settle each independently so one failing
        // section doesn't blank the whole page — a row that answers with nothing is simply not
        // drawn. Each rail row already carries its own applied discount, rating, image and
        // post-discount price, so there is nothing else to fetch to render a card.
        const val = <T,>(r: PromiseSettledResult<T[]>): T[] =>
          r.status === 'fulfilled' ? r.value : [];
        const results = await Promise.allSettled([
          getMostPopular(),
          getOnSale(),
          getRecentlyBooked(),
        ]);
        if (cancelled) return;
        const [popularR, saleR, recentR] = results;
        const deals = toItems(val(saleR)).map((item) => {
          const amount = dealLabel(item.dto);
          return amount ? { ...item, dealAmount: amount } : item;
        });
        setMostPopular(toItems(val(popularR)));
        setSpecialDeals(deals);
        setRecentlyBooked(toItems(val(recentR)));

        // A row that failed draws nothing, exactly like a row that came back empty, so the only
        // place left to report a failure is the all-rows-empty placeholder — which is why any one
        // rejection is enough to record a message for it.
        const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        setLoadError(firstError ? getErrorMessage(firstError.reason, t('home.loadError')) : null);
        setIsLoading(false);
      };

      load();
      return () => {
        cancelled = true;
      };
      // `t` is stable for a given language and re-running on a language change would refetch
      // rows the server returns identically — the labels around them re-render on their own.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloads])
  );

  // Near You, on its own clock. Waits for a real fix rather than firing against the Belgrade
  // placeholder: that answer is for the wrong city and is thrown away seconds later anyway.
  // `locating` settles on denial and failure too, so a user who refuses location still gets
  // the rail, ranked from the default position.
  useFocusEffect(
    useCallback(() => {
      if (locating) return;
      let cancelled = false;
      setNearYouFailed(false);
      setNearYouLoading(true);
      getNearMe({ lat: latitude, lng: longitude })
        .then((rows) => {
          if (cancelled) return;
          setNearYou(toItems(rows));
          setNearYouLoading(false);
        })
        .catch(() => {
          // A dead request and an empty neighbourhood both draw no row; this flag only decides
          // which message the all-rows-empty placeholder carries.
          if (cancelled) return;
          setNearYou([]);
          setNearYouFailed(true);
          setNearYouLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [locating, latitude, longitude, reloads])
  );

  // Unread badges on the bell and the chat icon — pushed live over SignalR; the focus
  // refresh re-seeds both from REST (covers rows read while this screen was blurred).
  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
      refreshUnreadMessages();
    }, [refreshUnreadCount, refreshUnreadMessages])
  );

  const handleServicePress = (item: ServiceItem) => {
    // Open the service detail screen first — the booker reads everything about
    // the service there, then proceeds to BookService from its "Book Now" CTA.
    (navigation as any).navigate('ServiceDetail', { service: item.dto });
  };

  const handleServiceTypePress = (serviceType: string) => {
    (navigation as any).navigate('Search', { serviceType, category: undefined });
  };

  const handleSeeAll = (category: string) => {
    (navigation as any).navigate('Search', { category, serviceType: undefined });
  };

  const renderSection = (
    title: string,
    icon: string,
    items: ServiceItem[],
    category: string,
    badge?: 'popular' | 'deal',
    empty?: React.ReactNode,
    /** Which clock this row is on. Near You has its own; the other three share the page's. */
    loading = isLoading
  ) => {
    // A row that loaded nothing is not drawn at all — no heading, no explanatory card. A browse
    // screen is better off showing what it has than narrating what it hasn't. The one exception
    // is the row that passes `empty`: Near You, and only when the whole page came back empty.
    if (!loading && items.length === 0 && !empty) return null;

    // Skeletons match the real cards' shape, so the row does not resize when the data lands.
    const cards = loading
      ? Array.from({ length: isWebLayout ? 3 : 3 }).map((_, i) => (
          <View
            key={`skeleton-${i}`}
            className={`overflow-hidden rounded-2xl ${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'}`}
            style={{ width: isWebLayout ? '100%' : 200, height: isWebLayout ? 220 : 160 }}>
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={BRAND_GREEN} />
            </View>
          </View>
        ))
      : items.map((item) => (
          <ServiceCard
            key={item.id}
            image={item.image}
            name={item.name}
            service={
              item.subtitle ||
              (item.dto.type != null ? tEnum('serviceProviderType', item.dto.type) : '')
            }
            rating={item.rating}
            reviews={item.reviews}
            price={item.price}
            currency={serviceCurrency(item.dto)}
            badge={badge}
            dealAmount={item.dealAmount}
            // Fills its grid cell on the web design; keeps the 200px rail width on a phone.
            fill={isWebLayout}
            onPress={() => handleServicePress(item)}
          />
        ));

    return (
      <Rail
        title={title}
        icon={icon as any}
        onSeeAll={() => handleSeeAll(category)}
        mobileTrailing={
          !loading ? (
            // Named after the row it ends — every rail has one of these, and four identical
            // "See more" buttons on a screen are indistinguishable without it.
            <SeeMoreCard
              onPress={() => handleSeeAll(category)}
              accessibilityLabel={`${t('common.seeMore')}: ${title}`}
            />
          ) : undefined
        }
        empty={empty}>
        {cards}
      </Rail>
    );
  };

  /**
   * The one placeholder left on this screen: what the Near You rail shows when the page as a
   * whole came back empty. Deliberately quiet — a card the row's own width rather than a
   * full-screen illustration — because it stands in for the content, it is not an announcement.
   */
  const emptyRow = (icon: string, title: string, sub: string, action?: () => void) => (
    <View
      className={`items-center rounded-2xl px-6 py-8 ${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'}`}>
      <Ionicons name={icon as any} size={28} color="#9CA3AF" />
      <Text className={`mt-3 text-center text-base font-semibold ${textColor}`}>{title}</Text>
      <Text
        className={`mt-1 text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {sub}
      </Text>
      {action && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={action}
          className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5">
          <Text className="font-semibold text-white">{t('common.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // An empty row hides itself, so a page whose every row is empty would otherwise be nothing but
  // category pills. That — and only that — is when a placeholder is drawn, in the Near You rail.
  // It waits on both clocks: calling the page empty while Near You is still in flight would flash
  // a wrong message at everyone whose location takes a moment to resolve.
  const nothingLoaded =
    !isLoading &&
    !nearYouLoading &&
    nearYou.length === 0 &&
    mostPopular.length === 0 &&
    recentlyBooked.length === 0 &&
    specialDeals.length === 0;

  // A failure and an empty catalogue are both "no cards", but only one of them is worth retrying,
  // so the placeholder says which it is. Any one row failing is enough: with the others drawing
  // nothing either, this card is the only place a failure can still be reported.
  const nothingLoadedRow =
    loadError || nearYouFailed
      ? emptyRow(
          'cloud-offline-outline',
          t('home.couldntLoad'),
          loadError ?? t('home.loadError'),
          () => setReloads((n) => n + 1)
        )
      : emptyRow('location-outline', t('home.nothingNearby'), t('home.nothingNearbySub'));

  return (
    <ScreenLayout
      headerVariant="large"
      contentBg={contentBg}
      footer={<TabBar />}
      width="wide"
      // The greeting, tagline and location now live in the WelcomeBanner card inside the content,
      // rather than as a page title, a subtitle and a stray row beneath them.
      headerChildren={
        isWebLayout ? undefined : (
          <>
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                <Ionicons name="location-outline" size={18} color="#ffffff" />
                {location.loading ? (
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginLeft: 8 }} />
                ) : (
                  <Text className="ml-2 text-sm text-white" numberOfLines={1}>
                    {location.address}
                  </Text>
                )}
              </View>
              {/* Messages sits beside notifications: a chat message is only pushed to the feed
                once per thread (the rest is carried by this badge), so without an entry point
                here an ongoing conversation would be invisible from the home screen. */}
              <TouchableOpacity
                className="p-2"
                accessibilityRole="button"
                accessibilityLabel={
                  unreadMessages > 0
                    ? t('home.a11yMessagesUnread', { count: unreadMessages })
                    : t('home.a11yMessages')
                }
                accessible
                onPress={() => (navigation as any).navigate('Messages')}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="white" />
                {unreadMessages > 0 && (
                  <View className="absolute right-0.5 top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border border-brand-500 bg-red-500 px-1">
                    <Text className="text-[10px] font-bold text-white">
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="p-2"
                // Icon-only, and the unread count is rendered as a bare badge — without this the
                // control announces as an unnamed button and the count is never read at all.
                accessibilityRole="button"
                accessibilityLabel={
                  unreadCount > 0
                    ? t('home.a11yNotificationsUnread', { count: unreadCount })
                    : t('home.a11yNotifications')
                }
                accessible
                onPress={() => (navigation as any).navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={22} color="white" />
                {unreadCount > 0 && (
                  <View className="absolute right-0.5 top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border border-brand-500 bg-red-500 px-1">
                    <Text className="text-[10px] font-bold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View className="mb-2 flex-row items-center">
              <MaterialCommunityIcons name="paw" size={24} color="white" />
              <Text className="ml-2 text-2xl font-bold text-white">{t('login.appName')}</Text>
            </View>
            <Text className={`${subtitleColor} mb-8 text-sm`}>{t('home.tagline')}</Text>
          </>
        )
      }>
      <ScrollView
        className="flex-1"
        // The tall bottom padding exists to clear the pinned tab bar; the web design has no bar
        // across the bottom, so there is nothing to clear. The number is derived from the bar's
        // real height rather than hardcoded — it grows with the system navigation bar and with
        // the user's text-size setting.
        contentContainerStyle={{ paddingBottom: isWebLayout ? 40 : tabBarSpacing }}>
        {/*
          Where the rails are ranked from. The phone design already prints it in the green header,
          so this is the web design's only copy of it — one line, and no greeting card around it.
        */}
        {isWebLayout && (
          <View className="flex-row items-center px-6 pt-4">
            <Ionicons name="location-outline" size={16} color={BRAND_GREEN} />
            {location.loading ? (
              <ActivityIndicator size="small" color={BRAND_GREEN} style={{ marginLeft: 8 }} />
            ) : (
              <Text className={`ml-2 text-sm ${subtextColor}`} numberOfLines={1}>
                {location.address}
              </Text>
            )}
          </View>
        )}

        {/* Service Type Pills */}
        <View className="px-6 pb-4 pt-4">
          {/*
            Six pills fit comfortably across a desktop column, so they wrap into place instead of
            hiding behind a horizontal scrollbar — a sideways scroller is a phone affordance, and
            on a mouse it is the one gesture people do not think to try.
          */}
          <PillRow isWebLayout={isWebLayout}>
            {SERVICE_TYPES.map((service, index) => {
              const typeLabel = tEnum('serviceProviderType', service.value, service.label);
              return (
                <TouchableOpacity
                  key={service.id}
                  onPress={() => handleServiceTypePress(service.label)}
                  // The pill reads as a category name but acts as a filter, so the label says
                  // what tapping it does; `accessible` folds the icon and caption into one control.
                  accessibilityRole="button"
                  accessibilityLabel={t('home.a11yBrowseCategory', { category: typeLabel })}
                  accessible
                  // `my-1` is what keeps the rows apart once they wrap on the web design; in the
                  // phone's single-row scroller it is 4px of harmless breathing room.
                  className={`mx-2 my-1 flex-row items-center rounded-full px-6 py-3 ${
                    index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-purple-500' : 'bg-brand-500'
                  }`}>
                  <Ionicons name={service.icon as any} size={18} color="white" />
                  <Text className="ml-2 font-semibold text-white">{typeLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </PillRow>
        </View>

        {renderSection(t('home.recentlyBooked'), 'time-outline', recentlyBooked, 'recently-booked')}
        {renderSection(
          t('home.nearYou'),
          'location-outline',
          nearYou,
          'near-you',
          undefined,
          nothingLoaded ? nothingLoadedRow : undefined,
          nearYouLoading
        )}
        {renderSection(
          t('home.mostPopular'),
          'trending-up-outline',
          mostPopular,
          'most-popular',
          'popular'
        )}
        {renderSection(
          t('home.specialDeals'),
          'pricetag-outline',
          specialDeals,
          'special-deals',
          'deal'
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
