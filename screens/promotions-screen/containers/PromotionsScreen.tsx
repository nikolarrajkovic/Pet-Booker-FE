import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PromotionCard } from '../components';
import type { Promotion } from '../components';
import { getServices } from '../../../services/services';
import { getErrorMessage } from '../../../services/http';
import {
  getServiceDiscounts,
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
function discountToPromotion(d: ServiceDiscountDto, serviceName: string): Promotion {
  const isPercent = d.type === DiscountType.Percent;
  // Percent reads from percentAmount (fallback amount); fixed reads the flat amount.
  const value = isPercent ? (d.percentAmount ?? d.amount) : d.amount;
  return {
    id: d.id ?? 0,
    type: 'offer',
    title: isPercent ? `${value}% Off — ${serviceName}` : `$${value} Off — ${serviceName}`,
    description: serviceName,
    dateRange: [fmtDate(d.applyFrom), fmtDate(d.applyTo)].filter(Boolean).join(' - '),
    status: d.isEnabled ? 'active' : 'paused',
    discountValue: value,
    discountPercent: isPercent ? value : undefined,
    offerNote: isPercent ? 'Percent discount' : 'Fixed amount off',
    usageCount: 0, // BACKEND-GAP: not tracked
    discountId: d.id ?? undefined,
    serviceId: d.serviceId,
    discountType: d.type,
    applyFrom: d.applyFrom,
    applyTo: d.applyTo ?? null,
  };
}

const PERFORMANCE_STATS = [
  {
    icon: 'trending-up',
    iconLib: 'ionicons',
    bg: 'bg-green-100',
    color: '#16A34A',
    value: '2',
    label: 'Active Promotions',
  },
  {
    icon: 'people-outline',
    iconLib: 'ionicons',
    bg: 'bg-blue-100',
    color: '#2563EB',
    value: '20',
    label: 'Bookings from Promos',
  },
  {
    icon: 'cash-outline',
    iconLib: 'ionicons',
    bg: 'bg-purple-100',
    color: '#9333EA',
    value: '$88',
    label: 'Total Spent',
  },
  {
    icon: 'bullseye',
    iconLib: 'material',
    bg: 'bg-orange-100',
    color: '#EA580C',
    value: '$4.38',
    label: 'Cost per Booking',
  },
];

interface PromotionsScreenProps {
  route?: { params?: { viewAll?: boolean } };
}

export default function PromotionsScreen({ route }: PromotionsScreenProps) {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { showError } = useToast();
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
      const services = await getServices({ serviceProviderId: providerId });
      const nameById = new Map(services.map((s) => [s.id, s.name ?? 'Service']));
      const lists = await Promise.all(
        services.map((s) =>
          s.id != null ? getServiceDiscounts({ serviceId: s.id }) : Promise.resolve([])
        )
      );
      const mapped = lists
        .flat()
        .map((d) => discountToPromotion(d, nameById.get(d.serviceId) ?? 'Service'));
      setOffers(mapped);
    } catch (e) {
      showError(getErrorMessage(e, 'Could not load your promotions. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, currentUser?.serviceProviderId]);

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
      showError(getErrorMessage(e, 'Could not update the promotion. Please try again.'));
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
      headerTitle="Promotions"
      headerSubtitle="Boost your visibility and attract more clients"
      contentBg={contentBg}
      rightAction={
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('CreatePromotion')}
          activeOpacity={0.8}
          className="flex-row items-center rounded-full bg-white px-4 py-2">
          <Ionicons name="add" size={16} color="#00C870" />
          <Text className="ml-1 text-sm font-semibold text-brand-600">New</Text>
        </TouchableOpacity>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {/* Performance Overview — hidden when viewAll */}
        {!viewAll && (
          <View className="mb-6">
            <Text className={`text-base font-bold ${textColor} mb-3`}>Performance Overview</Text>
            <View className="flex-row flex-wrap gap-3">
              {PERFORMANCE_STATS.map((stat) => (
                <View
                  key={stat.label}
                  className={`${cardBg} rounded-2xl border p-4 ${borderColor} flex-1`}
                  style={{ minWidth: '45%' }}>
                  <View
                    className={`h-9 w-9 rounded-xl ${stat.bg} mb-3 items-center justify-center`}>
                    {stat.iconLib === 'ionicons' ? (
                      <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                    ) : (
                      <MaterialCommunityIcons
                        name={stat.icon as any}
                        size={18}
                        color={stat.color}
                      />
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
        <View className="mb-3 flex-row items-center justify-between">
          <Text className={`text-base font-bold ${textColor}`}>Your Promotions</Text>
          {!viewAll && (
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('Promotions', { viewAll: true })}
              activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-brand-600">View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color="#00C870" />
          </View>
        ) : offers.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Ionicons
              name="megaphone-outline"
              size={64}
              color={isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
            <Text className={`${subtextColor} mt-4 text-center text-base`}>No promotions yet</Text>
          </View>
        ) : (
          offers.map((promo) => (
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
          <View
            className={`${isDarkMode ? 'bg-[#1a2332]' : 'bg-green-50'} mt-2 flex-row items-center rounded-2xl p-5`}>
            <View className="mr-4 h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
              <Ionicons name="trending-up" size={20} color="#00C870" />
            </View>
            <View className="flex-1">
              <Text className={`text-sm font-bold ${textColor} mb-0.5`}>Boost Your Earnings</Text>
              <Text className={`text-xs ${subtextColor} leading-4`}>
                Partners who run promotions see 3x more bookings on average
              </Text>
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('CreatePromotion')}
                activeOpacity={0.8}
                className="mt-3 self-start rounded-xl bg-brand-500 px-4 py-2.5">
                <Text className="text-sm font-semibold text-white">Start Promoting</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
