import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { PartnerCard } from '../components';
import type { Partner, PartnerStatus } from '../components';
import {
  getServiceProviders,
  providerTypeLabel,
  resolveImageUrl,
  ApprovalStatus,
  type ServiceProviderDto,
} from '../../../services/service-providers';
import { getErrorMessage } from '../../../services/http';

// Maps a raw ServiceProviderDto into the Partner card/detail view shape.
// The backend has no timeout/ban moderation concept, so every provider maps to
// 'active'; the admin can still timeout/ban in-session (kept as local overrides).
// Fields not exposed at the list level (reviews count, total services, phone,
// bio, starting price) default to 0/'' until the API provides them.
function providerToPartner(dto: ServiceProviderDto): Partner {
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
    reviews: 0,
    totalServices: 0,
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

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'timeout', label: 'Timeout' },
  { key: 'banned', label: 'Banned' },
];

export default function AdminPartnersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, hex } = useThemeColors();
  const insets = useSafeAreaInsets();
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
          const dtos = await getServiceProviders({
            approvalStatus: ApprovalStatus.Approved,
            perPage: 200,
          });
          const approved = dtos.filter(
            (d) => (d.approvalStatus ?? (d.isApproved ? ApprovalStatus.Approved : ApprovalStatus.Pending)) ===
              ApprovalStatus.Approved
          );
          if (!cancelled) setProviders(approved.map(providerToPartner));
        } catch (e) {
          if (!cancelled) {
            setProviders([]);
            setLoadError(getErrorMessage(e, 'Could not load partners. Please try again.'));
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#00C870' }}>
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: '#00C870',
          paddingHorizontal: 20,
          paddingTop: insets.top > 0 ? 8 : 16,
          paddingBottom: 16,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'AdminDashboard' })}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>Partners</Text>
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
            placeholder="Search partners..."
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
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          marginTop: -8,
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
                    backgroundColor: isActive ? '#00C870' : cardBg,
                    borderWidth: 1.5,
                    borderColor: isActive ? '#00C870' : borderColor,
                  }}>
                  <Text
                    style={{
                      color: isActive ? 'white' : subTextColor,
                      fontSize: 13,
                      fontWeight: '600',
                    }}>
                    {tab.label}
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <ActivityIndicator size="large" color="#00C870" />
            </View>
          ) : loadError ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Ionicons
                name="alert-circle-outline"
                size={64}
                color={isDarkMode ? '#4B5563' : '#D1D5DB'}
              />
              <Text
                style={{ color: subTextColor, marginTop: 16, fontSize: 15, textAlign: 'center' }}>
                {loadError}
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Ionicons
                name="people-outline"
                size={64}
                color={isDarkMode ? '#4B5563' : '#D1D5DB'}
              />
              <Text
                style={{ color: subTextColor, marginTop: 16, fontSize: 15, textAlign: 'center' }}>
                No partners found
              </Text>
            </View>
          ) : (
            filtered.map((partner) => (
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
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
