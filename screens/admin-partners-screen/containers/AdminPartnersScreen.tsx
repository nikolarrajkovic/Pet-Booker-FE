import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useBottomInset } from '../../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../../context/LocaleContext';
import { usePagedList } from '../../../hooks/usePagedList';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';
import { SUBMISSION_ORDER_OPTIONS } from '../../../hooks/useModerationQueue';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import FilterTabs, { type FilterTab } from '../../../components/shared/FilterTabs';
import SortMenu from '../../../components/shared/SortMenu';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import {
  ApprovalStatus,
  SubmissionOrder,
  getServiceProvidersPage,
  type ServiceProviderDto,
  type SubmissionOrderValue,
} from '../../../services/service-providers';
import { PartnerCard } from '../components';
import type { Partner, PartnerStatus } from '../components';
import { PartnerListHeader, PartnerRow } from '../components/PartnerRow';
import { providerToPartner } from '../providerToPartner';

type Tab = 'all' | PartnerStatus;

const TABS: readonly FilterTab<Tab>[] = [
  {
    key: 'all',
    labelKey: 'requests.tabAll',
    icon: 'people-outline',
    activeColor: '#047857',
    activeBg: '#D1FAE5',
  },
  {
    key: 'active',
    labelKey: 'admin.statusActive',
    icon: 'checkmark-circle-outline',
    activeColor: '#15803D',
    activeBg: '#DCFCE7',
  },
  {
    key: 'timeout',
    labelKey: 'admin.statusTimeout',
    icon: 'time-outline',
    activeColor: '#A16207',
    activeBg: '#FEF9C3',
  },
  {
    key: 'banned',
    labelKey: 'admin.statusBanned',
    icon: 'ban-outline',
    activeColor: '#B91C1C',
    activeBg: '#FEE2E2',
  },
];

const PAGE_SIZE = 20;

/**
 * Partner management: every approved provider, paging from the server as the admin scrolls,
 * newest first (re-orderable), searchable by name.
 *
 * Both designs share the list; only the item differs. The web design draws a full-width row per
 * partner under a column header (`PartnerRow`), the phone keeps its cards (`PartnerCard`).
 *
 * Both used to read every approved provider up front and filter the array on the client, with the
 * service and review counts tallied from the first 200 of each in the whole system — so a partner
 * whose services sat past row 200 read "0 services". The name search now runs on the server, and
 * both counts come exact on the provider row.
 *
 * Timeout and ban are still session-only overrides (the backend has no such concept): those two
 * tabs list the partners overridden this session, and "Active" is the server's list without them.
 */
export default function AdminPartnersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { goUp } = useAppNavigation();
  const { isDarkMode, subtextColor, hex } = useThemeColors();
  const { isWebLayout } = useResponsive();
  // The real inset on both platforms — this screen has no footer to own it.
  const bottomInset = useBottomInset();
  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const name = useDebouncedValue(search.trim(), 300);
  const [order, setOrder] = useState<SubmissionOrderValue>(SubmissionOrder.NewestFirst);
  /** Partners put on timeout or banned this session, as they were when it happened. */
  const [overrides, setOverrides] = useState<Record<string, Partner>>({});

  const fetchPage = useCallback(
    (page: number) =>
      getServiceProvidersPage({
        approvalStatus: ApprovalStatus.Approved,
        name: name || undefined,
        order,
        page,
        perPage: PAGE_SIZE,
      }),
    [name, order]
  );
  const list = usePagedList<ServiceProviderDto>(fetchPage, {
    errorFallback: t('admin.partnersLoadFailed'),
    resource: 'service-providers',
  });
  const isPagedTab = activeTab === 'all' || activeTab === 'active';
  const listRef = useNearBottomLoader(isPagedTab, list.loadMore);

  const partners = useMemo(
    () =>
      list.items.map((dto) => {
        const partner = providerToPartner(dto, {
          services: dto.serviceCount ?? 0,
          reviews: dto.reviewCount ?? 0,
        });
        return overrides[partner.id] ?? partner;
      }),
    [list.items, overrides]
  );
  const partnersRef = useRef(partners);
  partnersRef.current = partners;

  // A timeout or ban set on the details screen comes back as route params (local-only moderation).
  useFocusEffect(
    useCallback(() => {
      const updatedId: string | undefined = route.params?.updatedId;
      const updatedStatus = route.params?.updatedStatus as PartnerStatus | undefined;
      if (!updatedId || !updatedStatus) return;
      setOverrides((prev) => {
        const next = { ...prev };
        if (updatedStatus === 'active') {
          delete next[updatedId];
        } else {
          const base = prev[updatedId] ?? partnersRef.current.find((p) => p.id === updatedId);
          if (base) next[updatedId] = { ...base, status: updatedStatus };
        }
        return next;
      });
      navigation.setParams({ updatedId: undefined, updatedStatus: undefined });
    }, [route.params?.updatedId, route.params?.updatedStatus, navigation])
  );

  const overridden = Object.values(overrides);
  const matchesSearch = (p: Partner) => !name || p.name.toLowerCase().includes(name.toLowerCase());
  const timeoutCount = overridden.filter((p) => p.status === 'timeout').length;
  const bannedCount = overridden.filter((p) => p.status === 'banned').length;
  const counts: Record<Tab, number> = {
    all: list.totalItems,
    active: Math.max(0, list.totalItems - timeoutCount - bannedCount),
    timeout: timeoutCount,
    banned: bannedCount,
  };

  const rows = isPagedTab
    ? partners.filter((p) => activeTab === 'all' || p.status === 'active')
    : overridden.filter((p) => p.status === activeTab && matchesSearch(p));

  // The search field rides in the header on both designs — under the title inside the green slab
  // on the phone (translucent, on green), under the page title on web (a plain bordered field).
  const searchField = (
    <View
      className={isWebLayout ? (isDarkMode ? 'bg-[#1a2332]' : 'bg-white') : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginTop: 14,
        ...(isWebLayout
          ? { borderWidth: 1, borderColor: hex.border, height: 42, maxWidth: 420 }
          : {
              paddingVertical: 10,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
            }),
      }}>
      <Ionicons
        name="search-outline"
        size={18}
        color={isWebLayout ? hex.subtext : isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280'}
      />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('admin.searchPartners')}
        placeholderTextColor={
          isWebLayout ? hex.subtext : isDarkMode ? 'rgba(255,255,255,0.5)' : '#9CA3AF'
        }
        selectionColor={BRAND_GREEN}
        style={{
          flex: 1,
          marginLeft: 8,
          fontSize: 14,
          color: isWebLayout ? hex.text : isDarkMode ? 'white' : '#111827',
        }}
      />
      {search.length > 0 && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('shared.clear')}
          onPress={() => setSearch('')}>
          <Ionicons name="close-circle" size={18} color={hex.subtext} />
        </TouchableOpacity>
      )}
    </View>
  );

  const sort = isPagedTab ? (
    <SortMenu value={order} options={SUBMISSION_ORDER_OPTIONS} onChange={setOrder} />
  ) : null;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      // Pops real history when there is any, so arriving here from the notification feed and
      // pressing Back returns to the feed; the admin home is only the FALLBACK, for when this
      // screen was opened directly (tab to tab) and there is nothing to pop.
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.partners')}
      headerChildren={searchField}
      width="wide">
      {/* On the phone the tabs stay put above the scrolling list, as they always have: four
          pills do not fit 390px, hence their own horizontal scroller. */}
      {!isWebLayout && <PhoneTabs activeTab={activeTab} onChange={setActiveTab} counts={counts} />}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 + (isWebLayout ? 0 : bottomInset) }}
        showsVerticalScrollIndicator={isWebLayout}
        scrollEventThrottle={16}
        onScroll={(e) => (isPagedTab && isNearBottom(e) ? list.loadMore() : undefined)}>
        {/* The order control out-ranks the rows in paint order, so its panel opens over them. */}
        {isWebLayout ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16, zIndex: 20 }}>
            <View style={{ flex: 1 }}>
              <FilterTabs
                tabs={TABS}
                activeKey={activeTab}
                onChange={setActiveTab}
                counts={counts}
              />
            </View>
            {sort}
          </View>
        ) : (
          sort && (
            <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, zIndex: 20 }}>
              {sort}
            </View>
          )
        )}

        <View
          ref={listRef}
          style={{ paddingHorizontal: 16, paddingTop: isWebLayout || !sort ? 4 : 12 }}>
          <ListState
            isLoading={isPagedTab && list.isLoading}
            error={isPagedTab ? list.error : null}
            isEmpty={rows.length === 0}
            emptyIcon="people-outline"
            emptyMessage={t('admin.noPartnersFound')}>
            {isWebLayout ? (
              <>
                <PartnerListHeader />
                {rows.map((partner) => (
                  <PartnerRow
                    key={partner.id}
                    partner={partner}
                    onPress={() => navigation.navigate('PartnerDetails', { partner })}
                  />
                ))}
              </>
            ) : (
              rows.map((partner) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  isDarkMode={isDarkMode}
                  cardBg={hex.card}
                  textColor={hex.text}
                  subTextColor={hex.subtext}
                  borderColor={hex.border}
                  onPress={() => navigation.navigate('PartnerDetails', { partner })}
                />
              ))
            )}
          </ListState>

          {isPagedTab && rows.length > 0 && (
            <LoadMoreFooter
              loaded={list.items.length}
              total={list.totalItems}
              hasMore={list.hasMore}
              isLoadingMore={list.isLoadingMore}
              onLoadMore={list.loadMore}
            />
          )}
          {isPagedTab && rows.length > 0 && !list.hasMore && !list.isLoadingMore && (
            <Text className={`pt-4 text-center text-xs ${subtextColor}`}>
              {t('admin.endOfList', { count: list.totalItems })}
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

/** The phone's partner tabs: green-filled pills with a count, scrolling sideways. */
function PhoneTabs({
  activeTab,
  onChange,
  counts,
}: {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
  counts: Record<Tab, number>;
}) {
  const { isDarkMode, hex } = useThemeColors();
  const { t } = useLocale();

  return (
    <View style={{ height: 60 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={tab.key}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: isActive ? BRAND_GREEN : hex.card,
                borderWidth: 1.5,
                borderColor: isActive ? BRAND_GREEN : hex.border,
              }}>
              <Text
                style={{
                  color: isActive ? 'white' : hex.subtext,
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
                    color: isActive ? 'white' : hex.subtext,
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
  );
}
