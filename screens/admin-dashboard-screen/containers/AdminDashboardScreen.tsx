import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import TabBar from '../../../components/shared/TabBar';
import {
  getServiceProviders,
  ServiceProviderDto,
  ApprovalStatus,
  providerTypeLabel,
} from '../../../services/service-providers';
import {
  getBookings,
  BookingDto,
  BookingState,
  parseBookingDate,
} from '../../../services/bookings';
import { getErrorMessage } from '../../../services/http';

// ─── Formatting helpers ──────────────────────────────────────────────────────
const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtCount = (n: number) => n.toLocaleString('en-US');
const fmtPct = (p: number | null): string | undefined =>
  p == null ? undefined : `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;

const pctChange = (cur: number, prev: number): number | null =>
  prev <= 0 ? null : ((cur - prev) / prev) * 100;

// Stable color per ServiceProviderType for the revenue breakdown bars.
const TYPE_COLORS: Record<number, string> = {
  0: '#EC4899', // Pet Sitting
  1: '#3B82F6', // Dog Walking
  2: '#F97316', // Boarding
  3: '#10B981', // Pet Hotel
  4: '#8B5CF6', // Grooming
};

type AdminMetrics = {
  totalRevenue: number;
  revenueChangePct: number | null;
  servicesScheduled: number;
  servicesChangePct: number | null;
  newPartners: number;
  newPartnersChangePct: number | null;
  activePartners: number;
  pendingRequests: number;
  revenueByType: { type: number; label: string; value: number; color: string }[];
};

const EMPTY_METRICS: AdminMetrics = {
  totalRevenue: 0,
  revenueChangePct: null,
  servicesScheduled: 0,
  servicesChangePct: null,
  newPartners: 0,
  newPartnersChangePct: null,
  activePartners: 0,
  pendingRequests: 0,
  revenueByType: [],
};

/**
 * Derives the dashboard numbers for the selected period from the raw provider +
 * booking lists. Revenue/services are bucketed by `bookingFrom` (non-cancelled
 * bookings only); new partners by provider `createdAt`; active/pending partners
 * by `approvalStatus`. Period deltas compare against the previous month/year.
 */
function computeAdminMetrics(
  raw: { providers: ServiceProviderDto[]; bookings: BookingDto[] } | null,
  period: 'month' | 'year'
): AdminMetrics {
  if (!raw) return EMPTY_METRICS;
  const { providers, bookings } = raw;
  const now = new Date();

  const curStart =
    period === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), 0, 1);
  const curEnd =
    period === 'month'
      ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
      : new Date(now.getFullYear() + 1, 0, 1);
  const prevStart =
    period === 'month'
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : new Date(now.getFullYear() - 1, 0, 1);
  const prevEnd = curStart;

  const inWindow = (iso: string | null | undefined, start: Date, end: Date, naive: boolean) => {
    if (!iso) return false;
    const d = naive ? parseBookingDate(iso) : new Date(iso);
    return !isNaN(d.getTime()) && d >= start && d < end;
  };

  const activeBookings = bookings.filter((b) => b.state !== BookingState.Cancelled);
  const curBookings = activeBookings.filter((b) => inWindow(b.bookingFrom, curStart, curEnd, true));
  const prevBookings = activeBookings.filter((b) =>
    inWindow(b.bookingFrom, prevStart, prevEnd, true)
  );

  const sum = (arr: BookingDto[]) => arr.reduce((t, b) => t + (b.totalPrice || 0), 0);
  const totalRevenue = sum(curBookings);
  const prevRevenue = sum(prevBookings);

  const newPartners = providers.filter((p) =>
    inWindow(p.createdAt, curStart, curEnd, false)
  ).length;
  const prevNewPartners = providers.filter((p) =>
    inWindow(p.createdAt, prevStart, prevEnd, false)
  ).length;

  const statusOf = (p: ServiceProviderDto) =>
    p.approvalStatus ?? (p.isApproved ? ApprovalStatus.Approved : ApprovalStatus.Pending);
  const activePartners = providers.filter((p) => statusOf(p) === ApprovalStatus.Approved).length;
  const pendingRequests = providers.filter((p) => statusOf(p) === ApprovalStatus.Pending).length;

  // Revenue by service type: map each booking's provider → its type.
  const typeById = new Map<number, number>();
  providers.forEach((p) => {
    if (p.id != null) typeById.set(p.id, p.type);
  });
  const byType = new Map<number, number>();
  curBookings.forEach((b) => {
    const t = typeById.get(b.serviceProviderId);
    if (t == null) return;
    byType.set(t, (byType.get(t) || 0) + (b.totalPrice || 0));
  });
  const revenueByType = [...byType.entries()]
    .map(([type, value]) => ({
      type,
      // English fallback — display localizes via tEnum('serviceProviderType', type).
      label: providerTypeLabel(type),
      value,
      color: TYPE_COLORS[type] ?? '#9CA3AF',
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    totalRevenue,
    revenueChangePct: pctChange(totalRevenue, prevRevenue),
    servicesScheduled: curBookings.length,
    servicesChangePct: pctChange(curBookings.length, prevBookings.length),
    newPartners,
    newPartnersChangePct: pctChange(newPartners, prevNewPartners),
    activePartners,
    pendingRequests,
    revenueByType,
  };
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, hex } = useThemeColors();
  const { showError } = useToast();
  const { t, tEnum } = useLocale();
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  const [raw, setRaw] = useState<{
    providers: ServiceProviderDto[];
    bookings: BookingDto[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          let failure: unknown = null;
          const [providers, bookings] = await Promise.all([
            getServiceProviders({ perPage: 200 }).catch((e) => {
              failure = e;
              return [] as ServiceProviderDto[];
            }),
            getBookings({ perPage: 500 }).catch((e) => {
              failure = e;
              return [] as BookingDto[];
            }),
          ]);
          if (!cancelled) {
            setRaw({ providers, bookings });
            if (failure) {
              showError(getErrorMessage(failure, t('admin.dashboardLoadFailed')));
            }
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const metrics = useMemo(() => computeAdminMetrics(raw, period), [raw, period]);
  const maxRevenue = Math.max(1, ...metrics.revenueByType.map((r) => r.value));
  const val = (s: string) => (loading && !raw ? '—' : s);

  const bgColor = hex.bg;
  const cardBg = hex.card;
  const sectionTitle = hex.text;
  const subText = hex.subtext;
  const borderColor = hex.border;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#00C870' }}>
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: '#00C870',
          paddingHorizontal: 20,
          paddingTop: 48,
          paddingBottom: 36,
        }}>
        <Text style={{ color: 'white', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 }}>
          {t('admin.dashboardTitle')}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 }}>
          {t('admin.dashboardSubtitle')}
        </Text>
      </View>

      {/* ── Main content ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          marginTop: -20,
          overflow: 'hidden',
        }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}>
          {/* ── Period toggle ── */}
          <View
            style={{
              flexDirection: 'row',
              marginHorizontal: 20,
              marginTop: 24,
              marginBottom: 20,
              backgroundColor: cardBg,
              borderRadius: 14,
              padding: 4,
              borderWidth: 1,
              borderColor,
            }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPeriod('month')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: period === 'month' ? '#00C870' : 'transparent',
              }}>
              <Text
                style={{
                  color: period === 'month' ? 'white' : subText,
                  fontWeight: '600',
                  fontSize: 14,
                }}>
                {t('admin.thisMonth')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPeriod('year')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: period === 'year' ? '#00C870' : 'transparent',
              }}>
              <Text
                style={{
                  color: period === 'year' ? 'white' : subText,
                  fontWeight: '600',
                  fontSize: 14,
                }}>
                {t('admin.thisYear')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Stats grid (2x2) ── */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginHorizontal: 16,
              gap: 12,
              marginBottom: 24,
            }}>
            {/* Total Revenue */}
            <StatCard
              iconName="cash-outline"
              iconBg="#E8F5EF"
              iconColor="#00C870"
              change={fmtPct(metrics.revenueChangePct)}
              changeColor="#00C870"
              value={val(fmtMoney(metrics.totalRevenue))}
              label={t('admin.totalRevenue')}
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
            {/* Services Scheduled */}
            <StatCard
              iconName="calendar-outline"
              iconBg="#EEF2FF"
              iconColor="#6366F1"
              change={fmtPct(metrics.servicesChangePct)}
              changeColor="#6366F1"
              value={val(fmtCount(metrics.servicesScheduled))}
              label={t('admin.servicesScheduled')}
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
            {/* New Partners */}
            <StatCard
              iconName="person-add-outline"
              iconBg="#F3E8FF"
              iconColor="#A855F7"
              change={fmtPct(metrics.newPartnersChangePct)}
              changeColor="#A855F7"
              value={val(fmtCount(metrics.newPartners))}
              label={t('admin.newPartners')}
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
            {/* Active Partners */}
            <StatCard
              iconName="people-outline"
              iconBg="#FEF3C7"
              iconColor="#F59E0B"
              change={undefined}
              changeColor="#F59E0B"
              value={val(fmtCount(metrics.activePartners))}
              label={t('admin.activePartners')}
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
          </View>

          {/* ── Revenue by Service Type ── */}
          <View
            style={{
              marginHorizontal: 20,
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor,
              marginBottom: 24,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="bar-chart-outline" size={20} color="#00C870" />
              <Text style={{ color: sectionTitle, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                {t('admin.revenueByType')}
              </Text>
            </View>
            {loading && !raw ? (
              <ActivityIndicator color="#00C870" style={{ paddingVertical: 12 }} />
            ) : metrics.revenueByType.length === 0 ? (
              <Text style={{ color: subText, fontSize: 13, paddingVertical: 8 }}>
                {t('admin.noRevenue')}
              </Text>
            ) : (
              metrics.revenueByType.map((item) => (
                <View key={item.label} style={{ marginBottom: 14 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}>
                    <Text style={{ color: sectionTitle, fontSize: 13, fontWeight: '500' }}>
                      {tEnum('serviceProviderType', item.type, item.label)}
                    </Text>
                    <Text style={{ color: sectionTitle, fontSize: 13, fontWeight: '600' }}>
                      {fmtMoney(item.value)}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 8,
                      backgroundColor: isDarkMode ? '#2d3748' : '#F3F4F6',
                      borderRadius: 4,
                    }}>
                    <View
                      style={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: item.color,
                        width: `${Math.round((item.value / maxRevenue) * 100)}%`,
                      }}
                    />
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ── Quick Actions ── */}
          <View style={{ marginHorizontal: 20 }}>
            <Text
              style={{ color: sectionTitle, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              {t('admin.quickActions')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {/* New Requests */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdminNewRequests')}
                style={{
                  width: '47.5%',
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor,
                  alignItems: 'flex-start',
                }}>
                <View style={{ position: 'relative', marginBottom: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#FEF3C7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="document-text-outline" size={24} color="#F59E0B" />
                  </View>
                  {metrics.pendingRequests > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: '#F97316',
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}>
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
                        {t('admin.nNew', { n: metrics.pendingRequests })}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: sectionTitle, fontSize: 14, fontWeight: '700' }}>
                  {t('admin.newRequests')}
                </Text>
                <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>
                  {t('admin.reviewApplications')}
                </Text>
              </TouchableOpacity>

              {/* Partners */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdminPartners')}
                style={{
                  width: '47.5%',
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor,
                  alignItems: 'flex-start',
                }}>
                <View style={{ position: 'relative', marginBottom: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#E8F5EF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="people-outline" size={24} color="#00C870" />
                  </View>
                  {metrics.activePartners > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: '#00C870',
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}>
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
                        {t('admin.nActive', { n: metrics.activePartners })}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: sectionTitle, fontSize: 14, fontWeight: '700' }}>
                  {t('admin.partners')}
                </Text>
                <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>
                  {t('admin.managePartners')}
                </Text>
              </TouchableOpacity>

              {/* Add New */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdminAddPartner')}
                style={{
                  width: '47.5%',
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor,
                  alignItems: 'flex-start',
                }}>
                <View style={{ marginBottom: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#EEF2FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="person-add-outline" size={24} color="#6366F1" />
                  </View>
                </View>
                <Text style={{ color: sectionTitle, fontSize: 14, fontWeight: '700' }}>
                  {t('admin.addNew')}
                </Text>
                <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>
                  {t('admin.addPartnerManually')}
                </Text>
              </TouchableOpacity>

              {/* Reviews */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdminReviews')}
                style={{
                  width: '47.5%',
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor,
                  alignItems: 'flex-start',
                }}>
                <View style={{ marginBottom: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#FEF3C7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="star-outline" size={24} color="#F59E0B" />
                  </View>
                </View>
                <Text style={{ color: sectionTitle, fontSize: 14, fontWeight: '700' }}>
                  {t('admin.reviews')}
                </Text>
                <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>
                  {t('admin.moderateReviews')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ── Tab bar ── */}
      <TabBar />
    </SafeAreaView>
  );
}

// ─── Stat card sub-component ────────────────────────────────────────────────────
type StatCardProps = {
  iconName: any;
  iconBg: string;
  iconColor: string;
  change?: string;
  changeColor: string;
  value: string;
  label: string;
  cardBg: string;
  sectionTitle: string;
  subText: string;
  borderColor: string;
};

function StatCard({
  iconName,
  iconBg,
  iconColor,
  change,
  changeColor,
  value,
  label,
  cardBg,
  sectionTitle,
  subText,
  borderColor,
}: StatCardProps) {
  const isNegative = !!change && change.startsWith('-');
  const trendColor = isNegative ? '#EF4444' : changeColor;
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        backgroundColor: cardBg,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        {change && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: `${trendColor}18`,
              borderRadius: 8,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}>
            <Ionicons
              name={isNegative ? 'trending-down' : 'trending-up'}
              size={11}
              color={trendColor}
            />
            <Text style={{ color: trendColor, fontSize: 11, fontWeight: '700', marginLeft: 2 }}>
              {change}
            </Text>
          </View>
        )}
      </View>
      <Text style={{ color: sectionTitle, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
