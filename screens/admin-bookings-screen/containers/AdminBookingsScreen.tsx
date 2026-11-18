import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useBottomInset } from '../../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../../context/LocaleContext';
import { usePagedList } from '../../../hooks/usePagedList';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';
import { usePageGutter } from '../../../hooks/usePageGutter';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import FilterTabs, { type FilterTab } from '../../../components/shared/FilterTabs';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import AdminSearchField from '../../../components/shared/AdminSearchField';
import AdminBookingRow from '../../../components/shared/AdminBookingRow';
import DatePicker from '../../../components/shared/DatePicker';
import { formatWeekdayDayMonth } from '../../../i18n/dates';
import { linkTo } from '../../../navigation/links';
import {
  BookingSortBy,
  BookingState,
  countBookings,
  formatBookingDate,
  getBookingsPage,
  type BookingDto,
} from '../../../services/bookings';

type Tab = 'all' | 'upcoming' | 'accepted' | 'inProgress' | 'completed' | 'cancelled' | 'expired';

const TABS: readonly FilterTab<Tab>[] = [
  {
    key: 'all',
    labelKey: 'requests.tabAll',
    icon: 'albums-outline',
    activeColor: '#047857',
    activeBg: '#D1FAE5',
  },
  {
    key: 'upcoming',
    labelKey: 'adminBookings.tabWaiting',
    icon: 'hourglass-outline',
    activeColor: '#B45309',
    activeBg: '#FEF3C7',
  },
  {
    key: 'accepted',
    labelKey: 'adminBookings.tabConfirmed',
    icon: 'checkmark-circle-outline',
    activeColor: '#1D4ED8',
    activeBg: '#DBEAFE',
  },
  {
    key: 'inProgress',
    labelKey: 'adminBookings.tabInProgress',
    icon: 'walk-outline',
    activeColor: '#6D28D9',
    activeBg: '#EDE9FE',
  },
  {
    key: 'completed',
    labelKey: 'adminBookings.tabCompleted',
    icon: 'ribbon-outline',
    activeColor: '#15803D',
    activeBg: '#DCFCE7',
  },
  {
    key: 'cancelled',
    labelKey: 'adminBookings.tabCancelled',
    icon: 'close-circle-outline',
    activeColor: '#4B5563',
    activeBg: '#F3F4F6',
  },
  {
    key: 'expired',
    labelKey: 'adminBookings.tabExpired',
    icon: 'time-outline',
    activeColor: '#6B7280',
    activeBg: '#F3F4F6',
  },
];

const TAB_STATE: Record<Tab, number | undefined> = {
  all: undefined,
  upcoming: BookingState.Upcoming,
  accepted: BookingState.Accepted,
  inProgress: BookingState.InProgress,
  completed: BookingState.Completed,
  cancelled: BookingState.Cancelled,
  expired: BookingState.Expired,
};

const PAGE_SIZE = 20;

/**
 * Every booking on the platform, newest first, for support (app review 2026-11-13, finding 41):
 * searched by booking number, customer, partner, service or pet, and narrowed by where it stands.
 * A row opens the booking, where an admin can settle it (finding 40).
 */
export default function AdminBookingsScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { subtextColor, hex, isDarkMode } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const bottomInset = useBottomInset();
  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 300);
  const [counts, setCounts] = useState<Record<Tab, number>>({
    all: 0,
    upcoming: 0,
    accepted: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    expired: 0,
  });

  // One day, when chosen: the bookings that take place on it.
  const [day, setDay] = useState<Date | null>(null);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const dayFrom = day
    ? formatBookingDate(new Date(day.getFullYear(), day.getMonth(), day.getDate()))
    : undefined;
  const dayTo = day
    ? formatBookingDate(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1))
    : undefined;
  const state = TAB_STATE[activeTab];
  const fetchPage = useCallback(
    (page: number) =>
      getBookingsPage(
        {
          query: query || undefined,
          state,
          bookingFrom: dayFrom,
          bookingTo: dayTo,
          sortBy: BookingSortBy.NewestFirst,
          perPage: PAGE_SIZE,
        },
        page
      ),
    [query, state, dayFrom, dayTo]
  );
  const list = usePagedList<BookingDto>(fetchPage, {
    errorFallback: t('adminBookings.loadFailed'),
    resource: 'bookings',
  });
  const listRef = useNearBottomLoader(true, list.loadMore);

  // One count per tab (a one-row read each), for the badges; refreshed on focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const tabs = Object.keys(TAB_STATE) as Tab[];
      Promise.all(
        tabs.map((tab) =>
          countBookings({
            query: query || undefined,
            state: TAB_STATE[tab],
            bookingFrom: dayFrom,
            bookingTo: dayTo,
          }).catch(() => 0)
        )
      ).then((values) => {
        if (cancelled) return;
        setCounts(
          Object.fromEntries(tabs.map((tab, i) => [tab, values[i]])) as Record<Tab, number>
        );
      });
      return () => {
        cancelled = true;
      };
    }, [query, dayFrom, dayTo])
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('adminBookings.title')}
      headerChildren={
        <AdminSearchField
          testID="admin-bookings-search"
          value={search}
          onChange={setSearch}
          placeholder={t('adminBookings.searchPlaceholder')}
        />
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 + (isWebLayout ? 0 : bottomInset) }}
        showsVerticalScrollIndicator={isWebLayout}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? list.loadMore() : undefined)}>
        <FilterTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} counts={counts} />
        <View style={{ paddingHorizontal: gutter.value, paddingTop: 4, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              testID="admin-bookings-day"
              accessibilityRole="button"
              onPress={() => setDayPickerOpen((open) => !open)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: day ? BRAND_GREEN : hex.border,
                backgroundColor: hex.card,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}>
              <Ionicons name="calendar-outline" size={14} color={day ? BRAND_GREEN : hex.subtext} />
              <Text style={{ marginLeft: 6, fontSize: 13, color: day ? BRAND_GREEN : hex.text }}>
                {day ? formatWeekdayDayMonth(day) : t('adminBookings.anyDay')}
              </Text>
            </TouchableOpacity>
            {day ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('shared.clear')}
                onPress={() => setDay(null)}
                style={{ marginLeft: 6, padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={hex.subtext} />
              </TouchableOpacity>
            ) : null}
          </View>
          {dayPickerOpen ? (
            <View style={{ marginTop: 8, maxWidth: 420 }}>
              <DatePicker
                value={day ?? new Date()}
                isDarkMode={isDarkMode}
                onChange={(picked) => {
                  setDay(picked);
                  setDayPickerOpen(false);
                }}
                onClose={() => setDayPickerOpen(false)}
              />
            </View>
          ) : null}
        </View>
        <View ref={listRef} style={{ paddingHorizontal: gutter.value, paddingTop: 4 }}>
          <ListState
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={list.items.length === 0}
            emptyIcon="calendar-outline"
            emptyMessage={t('adminBookings.empty')}>
            {list.items.map((booking) => (
              <AdminBookingRow
                key={booking.id}
                booking={booking}
                link={linkTo(navigation, 'BookingDetails', { bookingId: booking.id })}
              />
            ))}
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
          {list.items.length > 0 && !list.hasMore && !list.isLoadingMore && (
            <Text className={`pt-4 text-center text-xs ${subtextColor}`}>
              {t('admin.endOfList', { count: list.totalItems })}
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
