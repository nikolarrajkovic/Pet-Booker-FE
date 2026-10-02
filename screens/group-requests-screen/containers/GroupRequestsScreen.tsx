import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import ResponsiveGrid from '../../../components/shared/ResponsiveGrid';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import FilterTabs, { type FilterTab } from '../../../components/shared/FilterTabs';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';
import { usePagedList } from '../../../hooks/usePagedList';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { useResponsive } from '../../../hooks/useResponsive';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useToast } from '../../../context/ToastContext';
import { subscribeResource } from '../../../services/cache';
import { getErrorMessage } from '../../../services/http';
import {
  acceptGroupBookingRequest,
  countGroupBookingRequests,
  declineGroupBookingRequest,
  getGroupBookingRequestsPage,
  GroupBookingRequestView,
  GroupBookingResponse,
  type GetGroupBookingRequestsParams,
  type GroupBookingRequestDto,
} from '../../../services/group-booking-requests';
import GroupRequestCard from '../components/GroupRequestCard';
import AcceptGroupRequestDialog from '../components/AcceptGroupRequestDialog';

type Tab = 'open' | 'accepted' | 'declined';

// The same three-way shape as the approval queues: waiting, said yes, said no.
const TABS: readonly FilterTab<Tab>[] = [
  {
    key: 'open',
    labelKey: 'groupRequest.tabOpen',
    icon: 'time-outline',
    activeColor: '#A16207',
    activeBg: '#FEF9C3',
  },
  {
    key: 'accepted',
    labelKey: 'groupRequest.tabAccepted',
    icon: 'checkmark-circle-outline',
    activeColor: '#15803D',
    activeBg: '#DCFCE7',
  },
  {
    key: 'declined',
    labelKey: 'groupRequest.tabDeclined',
    icon: 'close-circle-outline',
    activeColor: '#B91C1C',
    activeBg: '#FEE2E2',
  },
];

const TAB_QUERY: Record<Tab, Omit<GetGroupBookingRequestsParams, 'page' | 'perPage'>> = {
  open: { view: GroupBookingRequestView.Inbox },
  accepted: { view: GroupBookingRequestView.Answered, response: GroupBookingResponse.Accepted },
  declined: { view: GroupBookingRequestView.Answered, response: GroupBookingResponse.Declined },
};

/**
 * The provider's Group requests: requests sent to several providers at once that they can take.
 * Open is the inbox — requests that name them, plus open ones whose filters their services match
 * — and it is first come, first served: accepting creates a confirmed booking and removes the
 * request from every other provider's inbox. Accepted / Declined are their history. Each tab
 * pages from the server, like the approval queues this screen is modelled on.
 */
export default function GroupRequestsScreen() {
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const gutter = usePageGutter();
  const { isWebLayout } = useResponsive();
  const {
    isDarkMode,
    cardBg,
    textColor,
    subtextColor,
    borderColor,
    inputBg,
    inputText,
    placeholderColor,
  } = useThemeColors();
  const { t } = useLocale();
  const { showError, showSuccess } = useToast();
  const [tab, setTab] = useState<Tab>('open');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<GroupBookingRequestDto | null>(null);
  const [declineTarget, setDeclineTarget] = useState<GroupBookingRequestDto | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [counts, setCounts] = useState<Record<Tab, number>>({ open: 0, accepted: 0, declined: 0 });

  const fetchPage = useCallback(
    (page: number) => getGroupBookingRequestsPage({ ...TAB_QUERY[tab], page, perPage: 20 }),
    [tab]
  );
  const list = usePagedList<GroupBookingRequestDto>(fetchPage, {
    errorFallback: t('groupRequest.loadFailed'),
    resource: 'group-booking-requests',
  });
  const listRef = useNearBottomLoader(true, list.loadMore);

  const refreshCounts = useCallback(() => {
    Promise.all([
      countGroupBookingRequests(TAB_QUERY.open),
      countGroupBookingRequests(TAB_QUERY.accepted),
      countGroupBookingRequests(TAB_QUERY.declined),
    ])
      .then(([open, accepted, declined]) => setCounts({ open, accepted, declined }))
      .catch(() => {});
  }, []);
  useFocusEffect(refreshCounts);
  // A new request pushed to this provider, or an answer from anywhere, moves the counts.
  useEffect(() => subscribeResource('group-booking-requests', refreshCounts), [refreshCounts]);

  const dropRow = (id: number) => list.setItems((rows) => rows.filter((r) => r.id !== id));

  const accept = async (serviceId: number, pricingOptionId: number | null) => {
    const target = acceptTarget;
    if (!target) return;
    setAcceptTarget(null);
    setBusyId(target.id);
    try {
      const result = await acceptGroupBookingRequest(target.id, serviceId, pricingOptionId);
      dropRow(target.id);
      showSuccess(t('groupRequest.accepted'));
      if (result.bookingId) navigation.navigate('BookingDetails', { bookingId: result.bookingId });
    } catch (e) {
      // Most often: another provider was faster. The list refresh removes the stale row.
      showError(getErrorMessage(e, t('groupRequest.acceptFailed')));
      list.reload();
    } finally {
      setBusyId(null);
    }
  };

  const confirmDecline = async () => {
    const target = declineTarget;
    if (!target) return;
    setDeclineTarget(null);
    setBusyId(target.id);
    try {
      await declineGroupBookingRequest(target.id, declineReason);
      dropRow(target.id);
    } catch (e) {
      showError(getErrorMessage(e, t('groupRequest.declineFailed')));
    } finally {
      setBusyId(null);
    }
  };

  const emptyMessage =
    tab === 'open'
      ? t('groupRequest.noOpen')
      : tab === 'accepted'
        ? t('groupRequest.noAccepted')
        : t('groupRequest.noDeclined');

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={() => goUp('PartnerHub')}
      headerTitle={t('groupRequest.inboxTitle')}
      headerSubtitle={t('groupRequest.inboxSubtitle')}
      contentBg={isWebLayout ? undefined : isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]'}
      showNotificationButton
      width="wide">
      <FilterTabs tabs={TABS} activeKey={tab} onChange={setTab} counts={counts} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={isWebLayout}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? list.loadMore() : undefined)}>
        <View ref={listRef} style={{ paddingHorizontal: gutter.value, paddingTop: 12 }}>
          {tab === 'open' && (
            <Text className={`mb-3 text-xs ${subtextColor}`}>
              {t('groupRequest.firstToAcceptProvider')}
            </Text>
          )}
          <ListState
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={list.items.length === 0}
            emptyIcon="people-outline"
            emptyMessage={emptyMessage}>
            <ResponsiveGrid columns={{ mobile: 1, tablet: 1, desktop: 2 }} gap={12} rowGap={0}>
              {list.items.map((r) => (
                <GroupRequestCard
                  key={r.id}
                  request={r}
                  busy={busyId === r.id}
                  onAccept={tab === 'open' ? setAcceptTarget : undefined}
                  onDecline={
                    tab === 'open'
                      ? (target) => {
                          setDeclineReason('');
                          setDeclineTarget(target);
                        }
                      : undefined
                  }
                  onOpenBooking={(bookingId) =>
                    navigation.navigate('BookingDetails', { bookingId })
                  }
                />
              ))}
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

      <AcceptGroupRequestDialog
        request={acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onConfirm={accept}
      />

      {/* Decline: the reason is optional here (unlike a booking's) — it is only shown to the owner. */}
      <ResponsiveModal
        visible={declineTarget !== null}
        onClose={() => setDeclineTarget(null)}
        mobilePresentation="centered"
        dialogWidth={480}>
        <View className={`${cardBg} p-5`}>
          <Text className={`mb-1 text-lg font-bold ${textColor}`}>
            {t('groupRequest.declineTitle')}
          </Text>
          <Text className={`mb-4 text-sm ${subtextColor}`}>
            {t('groupRequest.declineSubtitle')}
          </Text>
          <TextInput
            value={declineReason}
            onChangeText={setDeclineReason}
            placeholder={t('groupRequest.declinePlaceholder')}
            placeholderTextColor={placeholderColor}
            multiline
            maxLength={500}
            numberOfLines={3}
            textAlignVertical="top"
            className={`${inputBg} mb-4 rounded-xl px-4 py-3 ${inputText}`}
            style={{ minHeight: 80 }}
            selectionColor={BRAND_GREEN}
          />
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setDeclineTarget(null)}
              className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
              <Text className={`font-semibold ${textColor}`}>{t('requests.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={confirmDecline}
              className="flex-1 items-center rounded-xl bg-red-500 py-3">
              <Text className="font-semibold text-white">{t('requests.decline')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ResponsiveModal>
    </ScreenLayout>
  );
}
