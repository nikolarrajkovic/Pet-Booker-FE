import React, { useCallback, useState } from 'react';
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
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import TabBar from '../../../components/shared/TabBar';
import { getAdminOverviewStats, getAdminRevenueByServiceType } from '../../../services/stats';
import { countServiceProviders, ApprovalStatus } from '../../../services/service-providers';
import { countReviews } from '../../../services/reviews';
import { formatMoney } from '../../../services/currency';
import { getErrorMessage } from '../../../services/http';
import { useResponsive } from '../../../hooks/useResponsive';
import { CONTENT_WIDTHS } from '../../../components/shared/ContentContainer';

// ─── Formatting helpers ──────────────────────────────────────────────────────
const fmtCount = (n: number) => n.toLocaleString('en-US');

// Stable color per ServiceProviderType for the revenue breakdown bars.
const TYPE_COLORS: Record<number, string> = {
  0: '#EC4899', // Sitter
  1: '#3B82F6', // Walker
  2: '#F97316', // Boarder
  3: '#10B981', // Pet Hotel
  4: '#8B5CF6', // Groomer
  5: '#0EA5E9', // Transporter
};

type AdminMetrics = {
  currency: string | null;
  /** All-time gross revenue. */
  totalRevenue: number;
  revenueThisMonth: number;
  servicesScheduled: number;
  newPartnersThisMonth: number;
  activePartners: number;
  /** Provider applications awaiting review (quick-action badge). */
  pendingRequests: number;
  /** Reviews awaiting moderation (quick-action badge). */
  pendingReviews: number;
  revenueByType: { type: number; label: string; value: number; color: string }[];
};

const EMPTY_METRICS: AdminMetrics = {
  currency: null,
  totalRevenue: 0,
  revenueThisMonth: 0,
  servicesScheduled: 0,
  newPartnersThisMonth: 0,
  activePartners: 0,
  pendingRequests: 0,
  pendingReviews: 0,
  revenueByType: [],
};

/**
 * Loads the dashboard numbers from the server-side stats aggregate
 * (GET /api/stats/admin/*), which computes over the FULL dataset. This replaces
 * the previous client-side roll-up, which fetched a capped page of providers +
 * bookings and summed them in JS — silently under-reporting once the platform
 * grew past that page size.
 *
 * The server exposes no period buckets or prior-period baselines, so the screen
 * shows the figures it actually reports (all-time revenue alongside this month's)
 * instead of a month/year toggle with computed ±% deltas.
 */
async function loadAdminMetrics(): Promise<AdminMetrics> {
  const [overview, byType, pendingProviders, pendingReviews] = await Promise.all([
    getAdminOverviewStats(),
    getAdminRevenueByServiceType(),
    // The quick-action badges deliberately do NOT come from /stats/admin/banner:
    // its `newRequests`/`newReviews` are recent-activity counts, not moderation
    // queues (verified live — `newReviews` still counted an already-approved
    // review, and `newRequests` did not match the pending-application count).
    // These screens link to the moderation queues, so the badges use the exact
    // server-side ApprovalStatus filters instead. Counted, not listed: the badge
    // is one integer, and pulling 200 full records (a review carries its user,
    // provider and booking includes) to call `.length` also under-reported any
    // queue longer than the page cap.
    countServiceProviders({ approvalStatus: ApprovalStatus.Pending }),
    countReviews({ approvalStatus: ApprovalStatus.Pending }),
  ]);

  const revenueByType = byType
    // The endpoint returns a row for every provider type, including empty ones.
    .filter((r) => r.amount > 0)
    .map((r) => ({
      type: r.serviceTypeValue,
      // English fallback — display localizes via tEnum('serviceProviderType', type).
      label: r.serviceType,
      value: r.amount,
      color: TYPE_COLORS[r.serviceTypeValue] ?? '#9CA3AF',
    }))
    .sort((a, b) => b.value - a.value);

  return {
    currency: overview.currency,
    totalRevenue: overview.totalRevenue,
    revenueThisMonth: overview.revenueThisMonth,
    servicesScheduled: overview.servicesScheduled,
    newPartnersThisMonth: overview.newPartnersThisMonth,
    activePartners: overview.activePartners,
    pendingRequests: pendingProviders,
    pendingReviews,
    revenueByType,
  };
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, hex } = useThemeColors();
  const { showError } = useToast();
  const { t, tEnum } = useLocale();
  const { isWebLayout } = useResponsive();

  const [metrics, setMetrics] = useState<AdminMetrics>(EMPTY_METRICS);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const next = await loadAdminMetrics();
          if (!cancelled) {
            setMetrics(next);
            setLoaded(true);
          }
        } catch (e) {
          if (!cancelled) {
            showError(getErrorMessage(e, t('admin.dashboardLoadFailed')));
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

  const maxRevenue = Math.max(1, ...metrics.revenueByType.map((r) => r.value));
  const val = (s: string) => (loaded ? s : '—');
  const money = (n: number) => formatMoney(n, metrics.currency);

  const bgColor = hex.bg;
  const cardBg = hex.card;
  const sectionTitle = hex.text;
  const subText = hex.subtext;
  const borderColor = hex.border;

  // Same treatment as the Partner Hub: the green slab, its safe-area padding and the rounded
  // sheet riding up over it are phone chrome. On the web design the sidebar frames the page, so
  // the header is a plain title and the tiles use the width instead of staying two-up.
  const Root: any = isWebLayout ? View : SafeAreaView;

  return (
    <Root style={{ flex: 1, backgroundColor: isWebLayout ? bgColor : BRAND_GREEN }}>
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: isWebLayout ? 'transparent' : BRAND_GREEN,
          paddingHorizontal: isWebLayout ? 40 : 20,
          paddingTop: isWebLayout ? 32 : 48,
          paddingBottom: isWebLayout ? 8 : 36,
          width: '100%',
          maxWidth: isWebLayout ? CONTENT_WIDTHS.wide : undefined,
          alignSelf: 'center',
        }}>
        <Text
          style={{
            color: isWebLayout ? hex.text : 'white',
            fontSize: isWebLayout ? 30 : 26,
            fontWeight: '700',
            letterSpacing: -0.5,
          }}>
          {t('admin.dashboardTitle')}
        </Text>
        <Text
          style={{
            color: isWebLayout ? hex.subtext : 'rgba(255,255,255,0.85)',
            fontSize: 14,
            marginTop: 2,
          }}>
          {t('admin.dashboardSubtitle')}
        </Text>
      </View>

      {/* ── Main content ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderTopLeftRadius: isWebLayout ? 0 : 24,
          borderTopRightRadius: isWebLayout ? 0 : 24,
          marginTop: isWebLayout ? 0 : -20,
          overflow: 'hidden',
        }}>
        <ScrollView
          contentContainerStyle={
            isWebLayout
              ? {
                  paddingBottom: 40,
                  width: '100%',
                  maxWidth: CONTENT_WIDTHS.wide,
                  alignSelf: 'center',
                }
              : { paddingBottom: 100 }
          }
          showsVerticalScrollIndicator={false}>
          {/* ── Stats grid ── */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginHorizontal: 16,
              marginTop: 24,
              gap: 12,
              marginBottom: 24,
            }}>
            {/* Total Revenue (all time) */}
            <StatCard
              iconName="cash-outline"
              iconBg="#E8F5EF"
              iconColor={BRAND_GREEN}
              changeColor={BRAND_GREEN}
              value={val(money(metrics.totalRevenue))}
              label={t('admin.totalRevenue')}
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
            {/* Revenue this month */}
            <StatCard
              iconName="trending-up-outline"
              iconBg="#E8F5EF"
              iconColor={BRAND_GREEN}
              changeColor={BRAND_GREEN}
              value={val(money(metrics.revenueThisMonth))}
              label={t('admin.revenueThisMonth')}
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
              changeColor="#6366F1"
              value={val(fmtCount(metrics.servicesScheduled))}
              label={t('admin.servicesScheduled')}
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
            {/* New Partners (this month) */}
            <StatCard
              iconName="person-add-outline"
              iconBg="#F3E8FF"
              iconColor="#A855F7"
              changeColor="#A855F7"
              value={val(fmtCount(metrics.newPartnersThisMonth))}
              label={t('admin.newPartnersThisMonth')}
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
              <Ionicons name="bar-chart-outline" size={20} color={BRAND_GREEN} />
              <Text style={{ color: sectionTitle, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                {t('admin.revenueByType')}
              </Text>
            </View>
            {loading && !loaded ? (
              <ActivityIndicator color={BRAND_GREEN} style={{ paddingVertical: 12 }} />
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
                      {money(item.value)}
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
                  width: isWebLayout ? '23%' : '47.5%',
                  minWidth: isWebLayout ? 170 : undefined,
                  flexGrow: isWebLayout ? 1 : 0,
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
                  width: isWebLayout ? '23%' : '47.5%',
                  minWidth: isWebLayout ? 170 : undefined,
                  flexGrow: isWebLayout ? 1 : 0,
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
                    <Ionicons name="people-outline" size={24} color={BRAND_GREEN} />
                  </View>
                  {metrics.activePartners > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: BRAND_GREEN,
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
                  width: isWebLayout ? '23%' : '47.5%',
                  minWidth: isWebLayout ? 170 : undefined,
                  flexGrow: isWebLayout ? 1 : 0,
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
                  width: isWebLayout ? '23%' : '47.5%',
                  minWidth: isWebLayout ? 170 : undefined,
                  flexGrow: isWebLayout ? 1 : 0,
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
                    <Ionicons name="star-outline" size={24} color="#F59E0B" />
                  </View>
                  {metrics.pendingReviews > 0 && (
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
                        {t('admin.nNew', { n: metrics.pendingReviews })}
                      </Text>
                    </View>
                  )}
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
    </Root>
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
  const { isWebLayout } = useResponsive();
  return (
    <View
      style={{
        flex: 1,
        // 45% forces two tiles per row, which is right on a phone and leaves five stat cards
        // spread over three near-empty rows on a desktop.
        minWidth: isWebLayout ? 220 : '45%',
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
