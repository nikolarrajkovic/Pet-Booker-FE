import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PromotionCard } from '../components';
import type { Promotion } from '../components';
import { getMyProvider } from '../../../services/service-providers';
import { getServices } from '../../../services/services';
import {
  getServiceDiscounts,
  updateServiceDiscount,
  ServiceDiscountDto,
  DiscountType,
} from '../../../services/service-discounts';

// Mock boost/featured promotions kept for UI completeness — these promotion
// types have NO backend (see BACKEND_GAPS: PR-promotions). Negative ids so they
// never collide with real ServiceDiscount ids.
const MOCK_EXTRAS: Promotion[] = [
  {
    id: -1,
    type: 'boost',
    title: 'Spring Boost - Dog Walking',
    description: 'Premium Dog Walking in Golden Gate Park',
    dateRange: 'Apr 15, 2026 - Apr 30, 2026',
    status: 'active',
    budgetSpent: 87.5,
    budgetTotal: 150,
    views: 3420,
    clicks: 156,
    bookings: 12,
  },
  {
    id: -2,
    type: 'featured',
    title: 'Featured Badge - Pet Sitting',
    description: 'In-Home Pet Sitting & Care',
    dateRange: 'Apr 25, 2026 - May 25, 2026',
    status: 'scheduled',
  },
];

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

// ServiceDiscountDto → Promotion ('offer'). usageCount has no backing (BACKEND-GAP).
function discountToPromotion(d: ServiceDiscountDto, serviceName: string): Promotion {
  const isPercent = d.type === DiscountType.Percent;
  const pct = d.percentAmount ?? d.amount;
  return {
    id: d.id ?? 0,
    type: 'offer',
    title: isPercent ? `${pct}% Off — ${serviceName}` : `$${d.amount} Off — ${serviceName}`,
    description: serviceName,
    dateRange: [fmtDate(d.applyFrom), fmtDate(d.applyTo)].filter(Boolean).join(' - '),
    status: d.isEnabled ? 'active' : 'paused',
    discountPercent: isPercent ? pct : undefined,
    offerNote: isPercent ? 'Percent discount' : `$${d.amount} off`,
    usageCount: 0, // BACKEND-GAP: not tracked
    discountId: d.id ?? undefined,
    serviceId: d.serviceId,
    discountType: d.type,
    applyFrom: d.applyFrom,
    applyTo: d.applyTo ?? null,
  };
}

const PERFORMANCE_STATS = [
  { icon: 'trending-up', iconLib: 'ionicons', bg: 'bg-green-100', color: '#16A34A', value: '2', label: 'Active Promotions' },
  { icon: 'people-outline', iconLib: 'ionicons', bg: 'bg-blue-100', color: '#2563EB', value: '20', label: 'Bookings from Promos' },
  { icon: 'cash-outline', iconLib: 'ionicons', bg: 'bg-purple-100', color: '#9333EA', value: '$88', label: 'Total Spent' },
  { icon: 'bullseye', iconLib: 'material', bg: 'bg-orange-100', color: '#EA580C', value: '$4.38', label: 'Cost per Booking' },
];

interface PromotionsScreenProps {
  route?: { params?: { viewAll?: boolean } };
}

export default function PromotionsScreen({ route }: PromotionsScreenProps) {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const viewAll = route?.params?.viewAll ?? false;

  const [offers, setOffers] = useState<Promotion[]>([]);
  const [extras, setExtras] = useState<Promotion[]>(MOCK_EXTRAS);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser?.id) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const provider = await getMyProvider(currentUser.id);
      if (!provider?.id) { setOffers([]); return; }
      const services = await getServices({ serviceProviderId: provider.id });
      const nameById = new Map(services.map((s) => [s.id, s.name ?? 'Service']));
      const lists = await Promise.all(
        services.map((s) => (s.id != null ? getServiceDiscounts({ serviceId: s.id }) : Promise.resolve([]))),
      );
      const mapped = lists.flat().map((d) => discountToPromotion(d, nameById.get(d.serviceId) ?? 'Service'));
      setOffers(mapped);
    } catch (e) {
      console.warn('[Promotions] load failed', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => { if (!cancelled) await load(); })();
      return () => { cancelled = true; };
    }, [load])
  );

  const promotions = useMemo(() => [...offers, ...extras], [offers, extras]);
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';

  // Toggle enabled state. Real offers persist via the discounts API; mock
  // boost/featured toggle locally only.
  const togglePromotion = async (id: number, makeActive: boolean) => {
    const promo = promotions.find((p) => p.id === id);
    if (!promo) return;
    if (promo.discountId && promo.serviceId != null) {
      try {
        await updateServiceDiscount(promo.discountId, {
          id: promo.discountId,
          serviceId: promo.serviceId,
          type: promo.discountType ?? DiscountType.Percent,
          amount: promo.discountPercent ?? 0,
          percentAmount: (promo.discountType ?? DiscountType.Percent) === DiscountType.Percent ? (promo.discountPercent ?? 0) : null,
          applyFrom: promo.applyFrom ?? new Date().toISOString(),
          applyTo: promo.applyTo ?? null,
          isEnabled: makeActive,
        });
        await load();
      } catch (e: any) {
        Alert.alert('Update failed', e?.message ?? 'Please try again.');
      }
    } else {
      setExtras((prev) => prev.map((p) => (p.id === id ? { ...p, status: makeActive ? 'active' : 'paused' } : p)));
    }
  };

  const handlePause = (id: number) => {
    const promo = promotions.find((p) => p.id === id);
    togglePromotion(id, promo?.status !== 'active');
  };
  const handleStart = (id: number) => togglePromotion(id, true);

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Promotions"
      headerSubtitle="Boost your visibility and attract more clients"
      contentBg={contentBg}
      rightAction={
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('CreatePromotion')}
          activeOpacity={0.8}
          className="flex-row items-center bg-white rounded-full px-4 py-2"
        >
          <Ionicons name="add" size={16} color="#00C870" />
          <Text className="text-brand-600 font-semibold text-sm ml-1">New</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Performance Overview — hidden when viewAll */}
        {!viewAll && (
          <View className="mb-6">
            <Text className={`text-base font-bold ${textColor} mb-3`}>Performance Overview</Text>
            <View className="flex-row flex-wrap gap-3">
              {PERFORMANCE_STATS.map((stat) => (
                <View
                  key={stat.label}
                  className={`${cardBg} rounded-2xl p-4 border ${borderColor} flex-1`}
                  style={{ minWidth: '45%' }}
                >
                  <View className={`w-9 h-9 rounded-xl ${stat.bg} items-center justify-center mb-3`}>
                    {stat.iconLib === 'ionicons' ? (
                      <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                    ) : (
                      <MaterialCommunityIcons name={stat.icon as any} size={18} color={stat.color} />
                    )}
                  </View>
                  <Text className={`text-xl font-bold ${textColor}`}>{stat.value}</Text>
                  <Text className={`text-xs ${subtextColor} mt-0.5`}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Your Promotions header */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className={`text-base font-bold ${textColor}`}>Your Promotions</Text>
          {!viewAll && (
            <TouchableOpacity onPress={() => (navigation as any).navigate('Promotions', { viewAll: true })} activeOpacity={0.7}>
              <Text className="text-brand-600 text-sm font-semibold">View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#00C870" />
          </View>
        ) : promotions.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Ionicons name="megaphone-outline" size={64} color={isDarkMode ? '#4B5563' : '#D1D5DB'} />
            <Text className={`${subtextColor} text-center mt-4 text-base`}>No promotions yet</Text>
          </View>
        ) : (
          promotions.map((promo) => (
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
          ))
        )}

        {/* Boost Your Earnings banner — only on main view */}
        {!viewAll && (
          <View className={`${isDarkMode ? 'bg-[#1a2332]' : 'bg-green-50'} rounded-2xl p-5 mt-2 flex-row items-center`}>
            <View className="w-10 h-10 rounded-xl bg-brand-100 items-center justify-center mr-4">
              <Ionicons name="trending-up" size={20} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-sm font-bold ${textColor} mb-0.5`}>Boost Your Earnings</Text>
              <Text className={`text-xs ${subtextColor} leading-4`}>Partners who run promotions see 3x more bookings on average</Text>
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('CreatePromotion')}
                activeOpacity={0.8}
                className="bg-brand-500 rounded-xl py-2.5 px-4 mt-3 self-start"
              >
                <Text className="text-white text-sm font-semibold">Start Promoting</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
