import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
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
import { PartnerListHeader, PartnerRow } from '../components/PartnerRow';
import { providerToPartner } from '../providerToPartner';
import type { Partner, PartnerStatus } from '../components';

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
 * Partner management on the web design: every approved provider, a full-width list that pages
 * from the server as the admin scrolls, newest first (re-orderable), searchable by name.
 *
 * The phone design's screen reads every approved provider up front and filters the array on the
 * client; here the name search runs on the server, so it finds a partner on page nine as readily
 * as one on page one.
 *
 * Timeout and ban are still session-only overrides (the backend has no such concept), exactly as
 * on the phone — so those two tabs list the partners overridden this session, and "Active" is
 * the server's list with them taken out.
 */
export default function AdminPartnersWeb() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { goUp } = useAppNavigation();
  const { isDarkMode, subtextColor, hex } = useThemeColors();
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
  const listRef = useNearBottomLoader(activeTab === 'all' || activeTab === 'active', list.loadMore);

  const partners = useMemo(
    () =>
      list.items.map((dto) => {
        // Both counts come exact on the provider row itself. The phone screen tallies them from
        // the first 200 services and reviews in the system instead, which on a newest-first list
        // read "0 services" for nearly every partner on screen.
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

  const isPagedTab = activeTab === 'all' || activeTab === 'active';
  const rows = isPagedTab
    ? partners.filter((p) => activeTab === 'all' || p.status === 'active')
    : overridden.filter((p) => p.status === activeTab && matchesSearch(p));

  const searchField = (
    <View
      className={isDarkMode ? 'bg-[#1a2332]' : 'bg-white'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: hex.border,
        paddingHorizontal: 12,
        height: 42,
        marginTop: 14,
        maxWidth: 420,
      }}>
      <Ionicons name="search-outline" size={18} color={hex.subtext} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('admin.searchPartners')}
        placeholderTextColor={hex.subtext}
        selectionColor={BRAND_GREEN}
        style={{ flex: 1, marginLeft: 8, fontSize: 14, color: hex.text }}
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

  return (
    <ScreenLayout
      showBackButton
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('admin.partners')}
      headerChildren={searchField}
      width="wide">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={16}
        onScroll={(e) => (isPagedTab && isNearBottom(e) ? list.loadMore() : undefined)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 16, zIndex: 20 }}>
          <View style={{ flex: 1 }}>
            <FilterTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} counts={counts} />
          </View>
          {isPagedTab && (
            <SortMenu value={order} options={SUBMISSION_ORDER_OPTIONS} onChange={setOrder} />
          )}
        </View>

        <View ref={listRef} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <ListState
            isLoading={isPagedTab && list.isLoading}
            error={isPagedTab ? list.error : null}
            isEmpty={rows.length === 0}
            emptyIcon="people-outline"
            emptyMessage={t('admin.noPartnersFound')}>
            <PartnerListHeader />
            {rows.map((partner) => (
              <PartnerRow
                key={partner.id}
                partner={partner}
                onPress={() => navigation.navigate('PartnerDetails', { partner })}
              />
            ))}
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
