import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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
import { formatShortDate } from '../../../i18n/dates';
import { linkTo } from '../../../navigation/links';
import { formatMoney } from '../../../services/currency';
import { parseBookingDate, PaymentType } from '../../../services/bookings';
import { PaymentStatus } from '../../../services/payments';
import {
  getAdminPaymentsPage,
  type AdminPaymentDto,
  type AdminPaymentTotals,
} from '../../../services/admin-payments';
import type { TranslationKey } from '../../../i18n';

type Tab = 'all' | 'paid' | 'refunded' | 'pending' | 'failed';

const TABS: readonly FilterTab<Tab>[] = [
  {
    key: 'all',
    labelKey: 'requests.tabAll',
    icon: 'albums-outline',
    activeColor: '#047857',
    activeBg: '#D1FAE5',
  },
  {
    key: 'paid',
    labelKey: 'adminPayments.tabPaid',
    icon: 'checkmark-circle-outline',
    activeColor: '#15803D',
    activeBg: '#DCFCE7',
  },
  {
    key: 'refunded',
    labelKey: 'adminPayments.tabRefunded',
    icon: 'return-down-back-outline',
    activeColor: '#1D4ED8',
    activeBg: '#DBEAFE',
  },
  {
    key: 'pending',
    labelKey: 'adminPayments.tabPending',
    icon: 'hourglass-outline',
    activeColor: '#B45309',
    activeBg: '#FEF3C7',
  },
  {
    key: 'failed',
    labelKey: 'adminPayments.tabFailed',
    icon: 'alert-circle-outline',
    activeColor: '#B91C1C',
    activeBg: '#FEE2E2',
  },
];

const TAB_STATUS: Record<Tab, number | undefined> = {
  all: undefined,
  paid: PaymentStatus.Successful,
  refunded: PaymentStatus.Refunded,
  pending: PaymentStatus.Pending,
  failed: PaymentStatus.Failed,
};

/** PaymentStatus → its label and colour on a row. */
const STATUS_LOOK: Record<number, { key: TranslationKey; color: string }> = {
  [PaymentStatus.Pending]: { key: 'adminPayments.statusPending', color: '#D97706' },
  [PaymentStatus.Successful]: { key: 'adminPayments.statusPaid', color: BRAND_GREEN },
  [PaymentStatus.PartiallySuccessful]: { key: 'adminPayments.statusPartial', color: '#D97706' },
  [PaymentStatus.Failed]: { key: 'adminPayments.statusFailed', color: '#DC2626' },
  [PaymentStatus.Refunded]: { key: 'adminPayments.statusRefunded', color: '#2563EB' },
};

type TypeFilter = 'any' | 'card' | 'cash';
const TYPE_VALUE: Record<TypeFilter, number | undefined> = {
  any: undefined,
  card: PaymentType.Card,
  cash: PaymentType.Cash,
};

const PAGE_SIZE = 20;

/**
 * Every payment on the platform, newest first, for support (app review 2026-11-13): what was
 * taken, refunded, kept or is still pending, by card or in cash, with the booking, customer and
 * partner it belongs to. There was no way to see payments short of opening each booking. The
 * totals cover everything the search and type match, whatever the status tab. A row opens its
 * booking.
 */
export default function AdminPaymentsScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { subtextColor, hex } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const bottomInset = useBottomInset();
  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('any');
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 300);
  const [totals, setTotals] = useState<AdminPaymentTotals | null>(null);

  const status = TAB_STATUS[activeTab];
  const type = TYPE_VALUE[typeFilter];
  const fetchPage = useCallback(
    async (page: number) => {
      const result = await getAdminPaymentsPage({ status, type, query, perPage: PAGE_SIZE }, page);
      if (page === 1) setTotals(result.totals);
      return result;
    },
    [status, type, query]
  );
  const list = usePagedList<AdminPaymentDto>(fetchPage, {
    errorFallback: t('adminPayments.loadFailed'),
    resource: 'payments',
  });
  const listRef = useNearBottomLoader(true, list.loadMore);

  const counts: Record<Tab, number> = {
    all: totals?.count ?? 0,
    paid: totals?.successful ?? 0,
    refunded: totals?.refundedCount ?? 0,
    pending: totals?.pending ?? 0,
    failed: totals?.failed ?? 0,
  };
  const money = (amount: number) => formatMoney(amount, totals?.currency);

  const tile = (testID: string, label: string, value: string, color: string) => (
    <View
      testID={testID}
      style={{
        flexGrow: 1,
        flexBasis: isWebLayout ? 0 : '45%',
        minWidth: 140,
        backgroundColor: hex.card,
        borderWidth: 1,
        borderColor: hex.border,
        borderRadius: 12,
        padding: 12,
      }}>
      <Text style={{ color: hex.subtext, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontSize: 17, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );

  const typePill = (key: TypeFilter, label: string) => {
    const active = typeFilter === key;
    return (
      <TouchableOpacity
        key={key}
        testID={`admin-payments-type-${key}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        onPress={() => setTypeFilter(key)}
        style={{
          borderWidth: 1,
          borderColor: active ? BRAND_GREEN : hex.border,
          backgroundColor: active ? 'rgba(0,168,90,0.1)' : hex.card,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
          marginRight: 8,
        }}>
        <Text style={{ fontSize: 13, color: active ? BRAND_GREEN : hex.text }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('adminPayments.title')}
      headerChildren={
        <AdminSearchField
          testID="admin-payments-search"
          value={search}
          onChange={setSearch}
          placeholder={t('adminPayments.searchPlaceholder')}
        />
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 + (isWebLayout ? 0 : bottomInset) }}
        showsVerticalScrollIndicator={isWebLayout}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? list.loadMore() : undefined)}>
        {totals ? (
          <View
            style={{
              paddingHorizontal: gutter.value,
              paddingTop: 12,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
            }}>
            {tile(
              'admin-payments-captured',
              t('adminPayments.captured'),
              money(totals.captured),
              BRAND_GREEN
            )}
            {tile(
              'admin-payments-refunded',
              t('adminPayments.refunded'),
              money(totals.refunded),
              '#2563EB'
            )}
            {tile(
              'admin-payments-card',
              t('adminPayments.byCard'),
              money(totals.cardCaptured),
              hex.text
            )}
            {tile(
              'admin-payments-cash',
              t('adminPayments.inCash'),
              money(totals.cashCaptured),
              hex.text
            )}
          </View>
        ) : null}
        <View style={{ paddingTop: 8 }}>
          <FilterTabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} counts={counts} />
        </View>
        <View
          style={{
            paddingHorizontal: gutter.value,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          {typePill('any', t('adminPayments.anyType'))}
          {typePill('card', t('adminPayments.card'))}
          {typePill('cash', t('adminPayments.cash'))}
        </View>
        <View ref={listRef} style={{ paddingHorizontal: gutter.value, paddingTop: 4 }}>
          <ListState
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={list.items.length === 0}
            emptyIcon="card-outline"
            emptyMessage={t('adminPayments.empty')}>
            {list.items.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                link={linkTo(navigation, 'BookingDetails', { bookingId: payment.bookingId })}
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

/** One payment: when and how much, how it was paid and where it stands, and for what booking. */
function PaymentRow({
  payment,
  link,
}: {
  payment: AdminPaymentDto;
  link: ReturnType<typeof linkTo>;
}) {
  const { hex } = useThemeColors();
  const { t } = useLocale();
  const look = STATUS_LOOK[payment.status] ?? {
    key: 'adminPayments.statusPending',
    color: hex.subtext,
  };
  const paidAt = new Date(payment.paidAt);
  const when = parseBookingDate(payment.bookingFrom);
  const refundedAt = payment.refundedAt ? new Date(payment.refundedAt) : null;
  const how =
    payment.type === PaymentType.Cash
      ? t('adminPayments.cash')
      : [
          t('adminPayments.card'),
          payment.cardBrand,
          payment.cardLast4 ? `•••• ${payment.cardLast4}` : null,
        ]
          .filter(Boolean)
          .join(' ');
  const date = (d: Date) => (Number.isNaN(d.getTime()) ? '' : formatShortDate(d));
  return (
    <TouchableOpacity
      {...(link as object)}
      testID={`admin-payment-${payment.id}`}
      accessibilityRole="link"
      activeOpacity={0.85}
      style={{
        backgroundColor: hex.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: hex.border,
      }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}>
        <Text
          style={{ color: hex.subtext, fontSize: 11, flex: 1, marginRight: 8 }}
          numberOfLines={1}>
          {t('adminPayments.rowRef', { id: payment.id, booking: payment.bookingId })} •{' '}
          {date(paidAt)}
        </Text>
        <Text style={{ color: hex.text, fontSize: 14, fontWeight: '700' }}>
          {formatMoney(payment.amount, payment.currency)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: hex.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
            {[payment.customerName, payment.providerName].filter(Boolean).join(' → ') || '—'}
          </Text>
          <Text style={{ color: hex.subtext, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
            {[payment.serviceName, date(when)].filter(Boolean).join(' · ')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons
              name={payment.type === PaymentType.Cash ? 'cash-outline' : 'card-outline'}
              size={13}
              color={hex.subtext}
            />
            <Text style={{ color: hex.subtext, fontSize: 12, marginLeft: 4 }} numberOfLines={1}>
              {how}
              {refundedAt ? ` · ${t('adminPayments.refundedOn', { date: date(refundedAt) })}` : ''}
            </Text>
          </View>
        </View>
        <Text style={{ color: look.color, fontSize: 13, fontWeight: '600' }}>{t(look.key)}</Text>
      </View>
    </TouchableOpacity>
  );
}
