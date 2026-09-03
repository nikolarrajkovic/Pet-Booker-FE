import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import ListState from '../../../components/shared/ListState';
import { PartnerCard } from '../components';
import type { Partner, PartnerStatus } from '../components';
import {
  getServiceProviders,
  providerTypeLabel,
  resolveImageUrl,
  ApprovalStatus,
  type ServiceProviderDto,
} from '../../../services/service-providers';
import { getServices } from '../../../services/services';
import { getReviews } from '../../../services/reviews';
import { getErrorMessage } from '../../../services/http';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import { useResponsive } from '../../../hooks/useResponsive';
import { CONTENT_WIDTHS } from '../../../components/shared/ContentContainer';

// Maps a raw ServiceProviderDto into the Partner card/detail view shape.
// The backend has no timeout/ban moderation concept, so every provider maps to
// 'active'; the admin can still timeout/ban in-session (kept as local overrides).
// Fields not exposed at the list level (reviews count, total services, phone,
// bio, starting price) default to 0/'' until the API provides them.
/** Per-provider tallies the provider list itself doesn't carry. */
type ProviderTallies = { services: number; reviews: number };

function providerToPartner(dto: ServiceProviderDto, tallies?: ProviderTallies): Partner {
  const photos = dto.photos ?? [];
  const profilePhoto = photos.find((p) => p.isSelected) ?? photos[0];
  const created = dto.createdAt ? new Date(dto.createdAt) : null;
  const addr = dto.address;
  const address = addr
    ? [addr.line1, addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')
    : '';
  const rating = dto.ratingAvg ?? 0;

  return {
    id: String(dto.id ?? 0),
    name: dto.name ?? 'Unknown Provider',
    image: resolveImageUrl(profilePhoto?.src),
    status: 'active',
    rating,
    // Counted from the catalogue/review lists fetched alongside the providers. Both used to be
    // hardcoded 0, so every partner in this list read "0 services · (0)" no matter how many they
    // actually had — next to a real star rating, which made the rating look broken too.
    reviews: tallies?.reviews ?? 0,
    totalServices: tallies?.services ?? 0,
    services: [providerTypeLabel(dto.type)],
    distance: addr?.city ?? '',
    joinedDate: created
      ? created.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : '',
    email: dto.contactEmail ?? '',
    phone: '',
    address,
    bio: '',
    startingPrice: 0,
    currency: dto.currency,
    avgRating: rating,
    documents: {
      profilePhoto: !!profilePhoto?.src,
      governmentId: (dto.governmentIdPhotos ?? []).some((p) => p.src),
      insuranceCertificate: (dto.certificates ?? []).some((c) => (c.files ?? []).length > 0),
    },
    serviceHistory: [],
  };
}

type FilterTab = 'all' | PartnerStatus;

// Labels are translation keys, resolved with t() at render.
const TABS: { key: FilterTab; labelKey: string }[] = [
  { key: 'all', labelKey: 'requests.tabAll' },
  { key: 'active', labelKey: 'admin.statusActive' },
  { key: 'timeout', labelKey: 'admin.statusTimeout' },
  { key: 'banned', labelKey: 'admin.statusBanned' },
];

export default function AdminPartnersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, hex } = useThemeColors();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  const insets = useSafeAreaInsets();

  // React Native's own SafeAreaView insets on iOS only. Android has drawn edge-to-edge since Expo
  // SDK 54, so nothing there keeps content clear of the status bar and camera cutout — the header
  // has to pad for it itself, or the title sits under the front camera.
  const headerTopInset = Platform.OS === 'android' ? insets.top : 0;
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [providers, setProviders] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // In-session timeout/ban overrides (no backend concept) keyed by partner id.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, PartnerStatus>>({});

  // Fetch all service providers on focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
          // Only approved providers are managed here — pending/declined
          // applications live in AdminNewRequests. (Filter server-side, then
          // guard client-side so a declined provider can never show as "active".)
          // Three list calls, not one-per-partner: the service and review counts are grouped
          // by provider id client-side, so the cost stays flat however many partners there are.
          // Both tallies are fail-soft — a partner still renders if either list call fails.
          const [dtos, services, reviews] = await Promise.all([
            getServiceProviders({ approvalStatus: ApprovalStatus.Approved, perPage: 200 }),
            getServices({ perPage: 200 }).catch(() => []),
            getReviews({ approvalStatus: ApprovalStatus.Approved, perPage: 200 }).catch(() => []),
          ]);

          const tallies = new Map<number, ProviderTallies>();
          const bump = (id: number | undefined, key: keyof ProviderTallies) => {
            if (id == null) return;
            const row = tallies.get(id) ?? { services: 0, reviews: 0 };
            row[key] += 1;
            tallies.set(id, row);
          };
          for (const s of services) bump(s.serviceProviderId, 'services');
          for (const r of reviews) bump(r.serviceProviderId, 'reviews');

          const approved = dtos.filter(
            (d) =>
              (d.approvalStatus ??
                (d.isApproved ? ApprovalStatus.Approved : ApprovalStatus.Pending)) ===
              ApprovalStatus.Approved
          );
          if (!cancelled) {
            setProviders(approved.map((d) => providerToPartner(d, tallies.get(d.id ?? -1))));
          }
        } catch (e) {
          if (!cancelled) {
            setProviders([]);
            setLoadError(getErrorMessage(e, t('admin.partnersLoadFailed')));
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Receive status update back from PartnerDetailsScreen (local-only moderation)
  useFocusEffect(
    useCallback(() => {
      const updatedId = route.params?.updatedId;
      const updatedStatus = route.params?.updatedStatus as PartnerStatus | undefined;
      if (updatedId && updatedStatus) {
        setStatusOverrides((prev) => ({ ...prev, [updatedId]: updatedStatus }));
        navigation.setParams({ updatedId: undefined, updatedStatus: undefined });
      }
    }, [route.params?.updatedId, route.params?.updatedStatus])
  );

  // Merge fetched providers with any in-session status overrides
  const partners = useMemo(
    () =>
      providers.map((p) => (statusOverrides[p.id] ? { ...p, status: statusOverrides[p.id] } : p)),
    [providers, statusOverrides]
  );

  const bgColor = hex.bg;
  const cardBg = hex.card;
  const textColor = hex.text;
  const subTextColor = hex.subtext;
  const borderColor = hex.border;
  const inputBg = isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)';

  const counts: Record<FilterTab, number> = {
    all: partners.length,
    active: partners.filter((p) => p.status === 'active').length,
    timeout: partners.filter((p) => p.status === 'timeout').length,
    banned: partners.filter((p) => p.status === 'banned').length,
  };

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      const matchesTab = activeTab === 'all' || p.status === activeTab;
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [partners, activeTab, search]);

  // Same treatment as the Partner Hub and Admin Dashboard: the green slab and the sheet riding up
  // over it are phone chrome, and the sidebar frames the page on the web design instead.
  const Root: any = isWebLayout ? View : SafeAreaView;

  return (
    <Root style={{ flex: 1, backgroundColor: isWebLayout ? bgColor : BRAND_GREEN }}>
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: isWebLayout ? 'transparent' : BRAND_GREEN,
          paddingHorizontal: isWebLayout ? 32 : 20,
          paddingTop: isWebLayout ? 32 : headerTopInset + (insets.top > 0 ? 8 : 16),
          paddingBottom: 16,
          width: '100%',
          maxWidth: isWebLayout ? CONTENT_WIDTHS.wide : undefined,
          alignSelf: 'center',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'AdminDashboard' })}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isWebLayout ? hex.card : 'rgba(255,255,255,0.25)',
              borderWidth: isWebLayout ? 1 : 0,
              borderColor: hex.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
            <Ionicons name="arrow-back" size={20} color={isWebLayout ? hex.subtext : 'white'} />
          </TouchableOpacity>
          <Text
            style={{
              color: isWebLayout ? hex.text : 'white',
              fontSize: isWebLayout ? 28 : 20,
              fontWeight: '700',
            }}>
            {t('admin.partners')}
          </Text>
        </View>

        {/* Search bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: inputBg,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}>
          <Ionicons
            name="search-outline"
            size={18}
            color={isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280'}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('admin.searchPartners')}
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : '#9CA3AF'}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: isDarkMode ? 'white' : '#111827',
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons
                name="close-circle"
                size={18}
                color={isDarkMode ? 'rgba(255,255,255,0.5)' : '#9CA3AF'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderTopLeftRadius: isWebLayout ? 0 : 24,
          borderTopRightRadius: isWebLayout ? 0 : 24,
          marginTop: isWebLayout ? 0 : -8,
        }}>
        {/* Filter tabs */}
        <View style={{ height: 60 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isActive ? BRAND_GREEN : cardBg,
                    borderWidth: 1.5,
                    borderColor: isActive ? BRAND_GREEN : borderColor,
                  }}>
                  <Text
                    style={{
                      color: isActive ? 'white' : subTextColor,
                      fontSize: 13,
                      fontWeight: '600',
                    }}>
                    {t(tab.labelKey as any)}
                  </Text>
                  <View
                    style={{
                      marginLeft: 6,
                      backgroundColor: isActive
                        ? 'rgba(255,255,255,0.3)'
                        : isDarkMode
                          ? '#374151'
                          : '#E5E7EB',
                      borderRadius: 8,
                      minWidth: 20,
                      height: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}>
                    <Text
                      style={{
                        color: isActive ? 'white' : subTextColor,
                        fontSize: 11,
                        fontWeight: '700',
                      }}>
                      {counts[tab.key]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <ScrollView
          contentContainerStyle={
            isWebLayout
              ? {
                  paddingHorizontal: 32,
                  paddingBottom: 32,
                  width: '100%',
                  maxWidth: CONTENT_WIDTHS.wide,
                  alignSelf: 'center',
                }
              : { paddingHorizontal: 16, paddingBottom: 32 }
          }
          showsVerticalScrollIndicator={false}>
          <ListState
            isLoading={isLoading}
            error={loadError}
            isEmpty={filtered.length === 0}
            emptyIcon="people-outline"
            emptyMessage={t('admin.noPartnersFound')}>
            {/* Partner cards carry their own bottom margin, so the grid adds columns only. */}
            <ResponsiveGrid columns={{ mobile: 1, tablet: 1, desktop: 2 }} gap={12} rowGap={0}>
              {filtered.map((partner) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  isDarkMode={isDarkMode}
                  cardBg={cardBg}
                  textColor={textColor}
                  subTextColor={subTextColor}
                  borderColor={borderColor}
                  onPress={() => navigation.navigate('PartnerDetails', { partner })}
                />
              ))}
            </ResponsiveGrid>
          </ListState>
        </ScrollView>
      </View>
    </Root>
  );
}
