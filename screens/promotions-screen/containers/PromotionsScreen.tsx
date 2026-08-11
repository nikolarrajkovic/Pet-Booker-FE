import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { formatMoney } from '../../../services/currency';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import { PromotionCard } from '../components';
import type { Promotion, PromotionStatus } from '../components';
import { getServices, serviceCurrency } from '../../../services/services';
import { getErrorMessage } from '../../../services/http';
import {
  updateServiceDiscount,
  ServiceDiscountDto,
  DiscountType,
} from '../../../services/service-discounts';

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

// ServiceDiscountDto → Promotion ('offer'). usageCount has no backing (BACKEND-GAP).
// Takes the translate fn so the built title/note follow the active language.
function discountToPromotion(
  t: (key: any, params?: Record<string, string | number>) => string,
  d: ServiceDiscountDto,
  serviceName: string,
  currency?: string | null
): Promotion {
  const isPercent = d.type === DiscountType.Percent;
  // Percent reads from percentAmount (fallback amount); fixed reads the flat amount.
  const value = isPercent ? (d.percentAmount ?? d.amount) : d.amount;
  return {
    id: d.id ?? 0,
    type: 'offer',
    title: isPercent
      ? t('promotions.percentOffTitle', { value, name: serviceName })
      : // A fixed discount is money — the title takes it already formatted, symbol and all.
        t('promotions.fixedOffTitle', { value: formatMoney(value, currency), name: serviceName }),
    description: serviceName,
    dateRange: [fmtDate(d.applyFrom), fmtDate(d.applyTo)].filter(Boolean).join(' - '),
    status: offerStatus(d.isEnabled, d.applyFrom, d.applyTo),
    discountValue: value,
    discountPercent: isPercent ? value : undefined,
    offerNote: isPercent ? t('promotions.percentNote') : t('promotions.fixedNote'),
    usageCount: 0, // BACKEND-GAP: not tracked
    discountId: d.id ?? undefined,
    serviceId: d.serviceId,
    discountType: d.type,
    applyFrom: d.applyFrom,
    applyTo: d.applyTo ?? null,
    currency: currency ?? undefined,
  };
}

/**
 * Where an offer sits in its own date window.
 *
 * `isEnabled` alone can't answer this: an enabled discount that starts next week is not running,
 * and one whose window closed is not either — both used to render a green "Active" badge. The
 * card has always had `scheduled` and `ended` styles + labels; nothing ever produced them.
 *
 * Single source of truth for the badge AND the count tiles, so the two can't contradict each
 * other on the same screen.
 */
function offerStatus(
  isEnabled: boolean,
  applyFrom?: string | null,
  applyTo?: string | null,
  now: number = Date.now()
): PromotionStatus {
  const ms = (iso?: string | null) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
  };
  const to = ms(applyTo);
  const from = ms(applyFrom);

  // An expired window wins over everything — a paused-and-expired offer is simply over.
  if (to != null && to < now) return 'ended';
  if (!isEnabled) return 'paused';
  if (from != null && from > now) return 'scheduled';
  return 'active';
}

/**
 * Performance tiles, counted from the offers already on screen.
 *
 * These used to be four hardcoded figures ("2 Active", "20 Bookings from Promos", "88 Total
 * Spent", "4.38 Cost per Booking") rendered directly above the real list — so a partner with no
 * promotions at all read "2 Active Promotions" sitting on top of "No promotions yet". Invented
 * numbers next to a real empty state are worse than no numbers, and the three spend/attribution
 * ones have nothing behind them (BACKEND_GAPS PR1–PR4: promo-attributed bookings and spend are
 * not tracked anywhere).
 *
 * So the tiles now report only what the loaded discounts actually say — where each offer sits in
 * its own date window — which is the question a partner opens this screen to answer.
 */
function performanceStats(offers: Promotion[]) {
  // Each offer already carries the status `offerStatus` assigned it, so the tiles are just a
  // tally of the badges the user can see — they cannot drift from the cards below.
  const count = (s: PromotionStatus) => offers.filter((p) => p.status === s).length;
  const active = count('active');
  const scheduled = count('scheduled');
  const paused = count('paused');
  const ended = count('ended');

  return [
    {
      icon: 'trending-up',
      iconLib: 'ionicons',
      bg: 'bg-green-100',
      color: '#16A34A',
      value: active,
      labelKey: 'promotions.statActive',
    },
    {
      icon: 'time-outline',
      iconLib: 'ionicons',
      bg: 'bg-blue-100',
      color: '#2563EB',
      value: scheduled,
      labelKey: 'promotions.statScheduled',
    },
    {
      icon: 'pause-circle-outline',
      iconLib: 'ionicons',
      bg: 'bg-orange-100',
      color: '#EA580C',
      value: paused,
      labelKey: 'promotions.statPaused',
    },
    {
      icon: 'checkmark-done-outline',
      iconLib: 'ionicons',
      bg: 'bg-purple-100',
      color: '#9333EA',
      value: ended,
      labelKey: 'promotions.statEnded',
    },
  ];
}

interface PromotionsScreenProps {
  route?: { params?: { viewAll?: boolean } };
}

export default function PromotionsScreen({ route }: PromotionsScreenProps) {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  const viewAll = route?.params?.viewAll ?? false;

  const [offers, setOffers] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const providerId = currentUser.serviceProviderId || null;
      if (!providerId) {
        setOffers([]);
        return;
      }
      // One request, not 1 + N. Each service in the list already carries its own `discounts[]`,
      // so fanning out a fetch per service was re-asking for data already in hand — and it grew
      // linearly with a partner's catalogue.
      const services = await getServices({ serviceProviderId: providerId });
      const nameById = new Map(services.map((s) => [s.id, s.name ?? t('promotions.service')]));
      const currencyById = new Map(services.map((s) => [s.id, serviceCurrency(s)]));
      const mapped = services
        .flatMap((s) => s.discounts ?? [])
        .map((d) =>
          discountToPromotion(
            t,
            d,
            nameById.get(d.serviceId) ?? t('promotions.service'),
            currencyById.get(d.serviceId)
          )
        );
      setOffers(mapped);
    } catch (e) {
      showError(getErrorMessage(e, t('promotions.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.serviceProviderId, t]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';

  // Toggle enabled state — real offers persist via the discounts API.
  const togglePromotion = async (id: number, makeActive: boolean) => {
    const promo = offers.find((p) => p.id === id);
    if (!promo || !promo.discountId || promo.serviceId == null) return;
    try {
      const type = promo.discountType ?? DiscountType.Percent;
      const value = promo.discountValue ?? promo.discountPercent ?? 0;
      await updateServiceDiscount(promo.discountId, {
        id: promo.discountId,
        serviceId: promo.serviceId,
        type,
        amount: value,
        percentAmount: type === DiscountType.Percent ? value : null,
        applyFrom: promo.applyFrom ?? new Date().toISOString(),
        applyTo: promo.applyTo ?? null,
        isEnabled: makeActive,
      });
      await load();
    } catch (e) {
      showError(getErrorMessage(e, t('promotions.updateFailed')));
    }
  };

  const handlePause = (id: number) => {
    const promo = offers.find((p) => p.id === id);
    togglePromotion(id, promo?.status !== 'active');
  };
  const handleStart = (id: number) => togglePromotion(id, true);

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('promotions.title')}
      headerSubtitle={t('promotions.subtitle')}
      contentBg={contentBg}
      rightAction={
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('CreatePromotion')}
          activeOpacity={0.8}
          className="flex-row items-center rounded-full bg-white px-4 py-2">
          <Ionicons name="add" size={16} color={BRAND_GREEN} />
          <Text className="ml-1 text-sm font-semibold text-brand-600">
            {t('promotions.newButton')}
          </Text>
        </TouchableOpacity>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {/* Performance Overview — hidden when viewAll */}
        {!viewAll && (
          <View className="mb-6">
            <Text className={`text-base font-bold ${textColor} mb-3`}>
              {t('promotions.performanceOverview')}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {performanceStats(offers).map((stat) => (
                <View
                  key={stat.labelKey}
                  className={`${cardBg} rounded-2xl border p-4 ${borderColor} flex-1`}
                  style={{ minWidth: '45%' }}>
                  <View
                    className={`h-9 w-9 rounded-xl ${stat.bg} mb-3 items-center justify-center`}>
                    <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                  </View>
                  <Text className={`text-xl font-bold ${textColor}`}>{stat.value}</Text>
                  <Text className={`text-xs ${subtextColor} mt-0.5`}>
                    {t(stat.labelKey as any)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Your Promotions header */}
        <View className="mb-3 flex-row items-center justify-between">
          <Text className={`text-base font-bold ${textColor}`}>
            {t('promotions.yourPromotions')}
          </Text>
          {!viewAll && (
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('Promotions', { viewAll: true })}
              activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-brand-600">
                {t('promotions.viewAll')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ListState
          isLoading={isLoading}
          isEmpty={offers.length === 0}
          emptyIcon="megaphone-outline"
          emptyMessage={t('promotions.noPromotions')}>
          {offers.map((promo) => (
            <PromotionCard
              key={promo.id}
              promotion={promo}
              isDarkMode={isDarkMode}
              cardBg={cardBg}
              textColor={textColor}
              subtextColor={subtextColor}
              borderColor={borderColor}
              onPause={handlePause}
              onStart={handleStart}
            />
          ))}
        </ListState>

        {/* Boost Your Earnings banner — only on main view */}
        {!viewAll && (
          <View
            className={`${isDarkMode ? 'bg-[#1a2332]' : 'bg-green-50'} mt-2 flex-row items-center rounded-2xl p-5`}>
            <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
              <Ionicons name="trending-up" size={20} color={BRAND_GREEN} />
            </View>
            <View className="flex-1">
              <Text className={`text-sm font-bold ${textColor} mb-0.5`}>
                {t('promotions.boostEarnings')}
              </Text>
              <Text className={`text-xs ${subtextColor} leading-4`}>
                {t('promotions.boostEarningsText')}
              </Text>
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('CreatePromotion')}
                activeOpacity={0.8}
                className="mt-3 self-start rounded-xl bg-brand-500 px-4 py-2.5">
                <Text className="text-sm font-semibold text-white">
                  {t('promotions.startPromoting')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
