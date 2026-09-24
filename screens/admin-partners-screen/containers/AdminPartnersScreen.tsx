import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { Ionicons } from '@expo/vector-icons';
import { useBottomInset } from '../../../hooks/useSafeAreaSpacing';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import ListState from '../../../components/shared/ListState';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PartnerCard } from '../components';
import type { Partner, PartnerStatus } from '../components';
import { getAllServiceProviders, ApprovalStatus } from '../../../services/service-providers';
import { providerToPartner, type ProviderTallies } from '../providerToPartner';
import AdminPartnersWeb from './AdminPartnersWeb';
import { getServices } from '../../../services/services';
import { getReviews } from '../../../services/reviews';
import { getErrorMessage } from '../../../services/http';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import { useResponsive } from '../../../hooks/useResponsive';

type FilterTab = 'all' | PartnerStatus;

// Labels are translation keys, resolved with t() at render.
const TABS: { key: FilterTab; labelKey: string }[] = [
  { key: 'all', labelKey: 'requests.tabAll' },
  { key: 'active', labelKey: 'admin.statusActive' },
  { key: 'timeout', labelKey: 'admin.statusTimeout' },
  { key: 'banned', labelKey: 'admin.statusBanned' },
];

/**
 * Partner management, in whichever of the app's two designs the window calls for: the web design
 * pages a table-like list from the server (`AdminPartnersWeb`), the phone keeps its card list.
 * Separate components rather than branches, so dragging a window across the breakpoint mounts the
 * other design cleanly instead of changing how many hooks one component calls.
 */
export default function AdminPartnersScreen() {
  const { isWebLayout } = useResponsive();
  return isWebLayout ? <AdminPartnersWeb /> : <AdminPartnersMobile />;
}

/** The phone design's list — unchanged: every approved provider read up front. */
function AdminPartnersMobile() {
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const route = useRoute<any>();
  const { isDarkMode, hex } = useThemeColors();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  // The real inset on both platforms. React Native's SafeAreaView pads on iOS only, so this used
  // to be an Android-only branch bolted on beside it — two ways of doing one thing, and only ever
  // right on the platform whose turn it was.
  const bottomInset = useBottomInset();
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
            getAllServiceProviders({ approvalStatus: ApprovalStatus.Approved }),
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
    }, [t])
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
    }, [route.params?.updatedId, route.params?.updatedStatus, navigation])
  );

  // Merge fetched providers with any in-session status overrides
  const partners = useMemo(
    () =>
      providers.map((p) => (statusOverrides[p.id] ? { ...p, status: statusOverrides[p.id] } : p)),
    [providers, statusOverrides]
  );

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

  // The search field rides in the header on both designs: `headerChildren` puts it under the
  // title inside the green slab on the phone, and under the page title on web. It is the one
  // piece of this screen's old hand-rolled header that was not just a re-implementation of
  // what ScreenLayout already draws.
  const searchField = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: inputBg,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 14,
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
        style={{ flex: 1, marginLeft: 8, fontSize: 14, color: isDarkMode ? 'white' : '#111827' }}
      />
      {search.length > 0 && (
        <TouchableOpacity accessibilityRole="button" onPress={() => setSearch('')}>
          <Ionicons
            name="close-circle"
            size={18}
            color={isDarkMode ? 'rgba(255,255,255,0.5)' : '#9CA3AF'}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    // This screen used to draw its own root, its own green slab, its own back affordance and its
    // own width cap on two separate children — all four of which `ScreenLayout` already owns, and
    // each written as an `isWebLayout ?` branch that had to be kept in step with the shared one
    // by hand. It was not, which is why the filter row here was still pinned to the window after
    // the rest of the app had been centred, and why this page scrolled inside its own column
    // instead of against the window edge (the flattening rule keys on ScreenLayout's scroller).
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      // Pops real history when there is any, so arriving here from the notification feed and
      // pressing Back returns to the feed; the admin home is only the FALLBACK, for when this
      // screen was opened directly (tab to tab) and there is nothing to pop. Hardcoding the
      // destination made every arrival behave like the second case.
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.partners')}
      headerChildren={searchField}
      width="wide">
      <View style={{ flex: 1 }}>
        {/* Filter tabs. No width cap of its own: it sits inside ScreenLayout's capped column
            like everything else on the page, which is what keeps it in line with the cards
            below rather than pinned to the window. */}
        <View style={{ height: 60 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: isWebLayout ? 32 : 16,
              paddingVertical: 10,
              gap: 8,
            }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  accessibilityRole="button"
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
        {/* Padding only — ScreenLayout caps and centres the column, and its body container is
            deliberately unpadded so screens keep owning their own gutters. */}
        <ScrollView
          contentContainerStyle={
            isWebLayout
              ? { paddingHorizontal: 32, paddingBottom: 32 }
              : { paddingHorizontal: 16, paddingBottom: 32 + bottomInset }
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
    </ScreenLayout>
  );
}
