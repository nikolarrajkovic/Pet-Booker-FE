import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import FilterTabs, { type FilterTab } from '../../../components/shared/FilterTabs';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import Button from '../../../components/shared/Button';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';
import { usePagedList } from '../../../hooks/usePagedList';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { useResponsive } from '../../../hooks/useResponsive';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useToast } from '../../../context/ToastContext';
import { subscribeResource } from '../../../services/cache';
import { getErrorMessage } from '../../../services/http';
import { showAlert } from '../../../services/alert';
import {
  cancelGroupBookingRequest,
  countGroupBookingRequests,
  getGroupBookingRequestsPage,
  GroupBookingAudience,
  GroupBookingRequestView,
  GroupBookingResponse,
  GroupBookingStatus,
  type GroupBookingRequestDto,
} from '../../../services/group-booking-requests';
import { formatRequestWindow, statusStyle } from '../groupRequestFormat';

type Tab = 'active' | 'past';

const TABS: readonly FilterTab<Tab>[] = [
  {
    key: 'active',
    labelKey: 'groupRequest.tabActive',
    icon: 'time-outline',
    activeColor: '#A16207',
    activeBg: '#FEF9C3',
  },
  {
    key: 'past',
    labelKey: 'groupRequest.tabPast',
    icon: 'archive-outline',
    activeColor: '#374151',
    activeBg: '#E5E7EB',
  },
];

/**
 * The owner's group requests: open ones (still waiting for a provider) and past ones (taken,
 * cancelled or expired). Paged from the server per tab, like every list; a request is never
 * edited, so the only action is Cancel while it is open, and a fulfilled one links to the booking
 * it became.
 */
export default function MyGroupRequestsScreen() {
  const navigation = useNavigation<any>();
  const gutter = usePageGutter();
  const { isWebLayout } = useResponsive();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t, tEnum } = useLocale();
  const { showError, showSuccess } = useToast();
  const [tab, setTab] = useState<Tab>('active');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<Tab, number>>({ active: 0, past: 0 });

  const fetchPage = useCallback(
    (page: number) =>
      getGroupBookingRequestsPage({
        view: GroupBookingRequestView.Mine,
        isActive: tab === 'active',
        page,
        perPage: 20,
      }),
    [tab]
  );
  const list = usePagedList<GroupBookingRequestDto>(fetchPage, {
    errorFallback: t('groupRequest.loadFailed'),
    resource: 'group-booking-requests',
  });
  const listRef = useNearBottomLoader(true, list.loadMore);

  const refreshCounts = useCallback(() => {
    Promise.all([
      countGroupBookingRequests({ view: GroupBookingRequestView.Mine, isActive: true }),
      countGroupBookingRequests({ view: GroupBookingRequestView.Mine, isActive: false }),
    ])
      .then(([active, past]) => setCounts({ active, past }))
      // A badge is a hint; the list reports its own errors.
      .catch(() => {});
  }, []);
  useFocusEffect(refreshCounts);
  useEffect(() => subscribeResource('group-booking-requests', refreshCounts), [refreshCounts]);

  const cancel = (request: GroupBookingRequestDto) => {
    showAlert(t('groupRequest.cancelTitle'), t('groupRequest.cancelMessage'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('groupRequest.cancelConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(request.id);
          try {
            await cancelGroupBookingRequest(request.id);
            // It moves from Active to Past; the write's invalidation re-reads both.
            list.setItems((rows) => rows.filter((r) => r.id !== request.id));
            showSuccess(t('groupRequest.cancelled'));
          } catch (e) {
            showError(getErrorMessage(e, t('groupRequest.cancelFailed')));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const audienceText = (r: GroupBookingRequestDto) =>
    r.audience === GroupBookingAudience.AnyEligible
      ? (r.excluded?.length ?? 0) > 0
        ? t('groupRequest.audienceAnyExcept', {
            names: (r.excluded ?? []).map((x) => x.serviceProviderName ?? '').join(', '),
          })
        : t('groupRequest.audienceAny')
      : t('groupRequest.audienceSelected', { count: r.invitedCount });

  const card = (r: GroupBookingRequestDto) => {
    const status = statusStyle(t, r.status);
    const isOpen = r.status === GroupBookingStatus.Open;
    return (
      <View key={r.id} className={`mb-3 rounded-2xl border p-4 ${borderColor} ${cardBg}`}>
        <View className="flex-row items-start justify-between">
          <View className="mr-3 flex-1">
            <Text className={`text-base font-semibold ${textColor}`}>
              {tEnum('serviceProviderType', r.serviceType)}
              {r.petName ? (
                <Text className={`font-normal ${subtextColor}`}>
                  {' '}
                  {t('bookService.forPet', { name: r.petName })}
                </Text>
              ) : null}
            </Text>
            <Text className={`mt-1 text-sm ${subtextColor}`}>
              {formatRequestWindow(t, r.bookingFrom, r.bookingTo)}
            </Text>
          </View>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: status.bg }}>
            <Text className="text-xs font-semibold" style={{ color: status.fg }}>
              {status.label}
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center">
          <Ionicons name="people-outline" size={15} color={BRAND_GREEN} />
          <Text className={`ml-2 flex-1 text-xs ${subtextColor}`}>
            {audienceText(r)}
            {r.declinedCount > 0
              ? ` · ${t('groupRequest.declinedCount', { count: r.declinedCount })}`
              : ''}
          </Text>
        </View>

        {/* Named providers and where each stands. */}
        {r.audience === GroupBookingAudience.SelectedProviders && r.recipients.length > 0 && (
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {r.recipients.map((x) => (
              <View
                key={x.serviceProviderId}
                className={`rounded-full border px-2.5 py-1 ${borderColor}`}>
                <Text
                  className={`text-[11px] ${
                    x.response === GroupBookingResponse.Declined
                      ? 'text-red-500 line-through'
                      : x.response === GroupBookingResponse.Accepted
                        ? 'font-semibold text-brand-600'
                        : subtextColor
                  }`}>
                  {x.serviceProviderName ?? '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {r.status === GroupBookingStatus.Fulfilled && (
          <Text className={`mt-3 text-sm ${textColor}`}>
            {t('groupRequest.takenBy', { name: r.acceptedServiceProviderName ?? '—' })}
          </Text>
        )}
        {r.status === GroupBookingStatus.Cancelled && r.cancelReason ? (
          <Text className={`mt-3 text-xs italic ${subtextColor}`}>{r.cancelReason}</Text>
        ) : null}

        {(isOpen || r.bookingId) && (
          <View className="mt-4 flex-row justify-end gap-2">
            {r.bookingId ? (
              <Button
                text={t('groupRequest.viewBooking')}
                variant="primary"
                onPress={() => navigation.navigate('BookingDetails', { bookingId: r.bookingId })}
              />
            ) : null}
            {isOpen ? (
              <Button
                text={t('groupRequest.cancelRequest')}
                variant="outline"
                disabled={busyId === r.id}
                onPress={() => cancel(r)}
              />
            ) : null}
          </View>
        )}
      </View>
    );
  };

  const newButton = (
    <Button
      text={t('groupRequest.newRequest')}
      icon={<Ionicons name="add" size={18} color="white" />}
      onPress={() => navigation.navigate('CreateGroupRequest')}
    />
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('groupRequest.myTitle')}
      headerSubtitle={t('groupRequest.mySubtitle')}
      contentBg={isWebLayout ? undefined : isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]'}
      webHeaderRight={newButton}
      width="wide">
      <FilterTabs tabs={TABS} activeKey={tab} onChange={setTab} counts={counts} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? list.loadMore() : undefined)}>
        {!isWebLayout && <View className={`${gutter.px} pt-3`}>{newButton}</View>}
        <View ref={listRef} style={{ paddingHorizontal: gutter.value, paddingTop: 12 }}>
          <ListState
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={list.items.length === 0}
            emptyIcon="people-outline"
            emptyMessage={tab === 'active' ? t('groupRequest.noActive') : t('groupRequest.noPast')}>
            <ResponsiveGrid columns={{ mobile: 1, tablet: 1, desktop: 2 }} gap={12} rowGap={0}>
              {list.items.map(card)}
            </ResponsiveGrid>
          </ListState>
          {list.items.length > 0 && (
            <LoadMoreFooter
              loaded={list.items.length}
              total={list.totalItems}
              hasMore={list.hasMore}
              isLoadingMore={list.isLoadingMore}
              onLoadMore={list.loadMore}
            />
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
