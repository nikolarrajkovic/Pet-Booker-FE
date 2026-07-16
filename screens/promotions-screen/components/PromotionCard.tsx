import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocale } from '../../../context/LocaleContext';

export type PromotionStatus = 'active' | 'paused' | 'scheduled' | 'ended';
export type PromotionType = 'boost' | 'featured' | 'offer' | 'ad';

export interface Promotion {
  id: number;
  type: PromotionType;
  title: string;
  description: string;
  dateRange: string;
  status: PromotionStatus;
  // boost specific
  budgetSpent?: number;
  budgetTotal?: number;
  views?: number;
  clicks?: number;
  bookings?: number;
  // offer specific
  discountValue?: number; // generic discount value — percent points OR dollars, per discountType
  discountPercent?: number; // legacy: percent value (kept for back-compat; mirrors discountValue when Percent)
  usageCount?: number;
  offerNote?: string;
  // API linkage — present for real 'offer' promotions backed by a ServiceDiscount
  discountId?: number;
  serviceId?: number;
  discountType?: number; // DiscountType: 0=Percent, 1=Fixed
  applyFrom?: string; // ISO
  applyTo?: string | null; // ISO
}

// DiscountType: 0=Percent, 1=Fixed (mirrors services/service-discounts DiscountType).
// Renders an offer's headline — "$10 OFF" for fixed, "20% OFF" for percent.
export function formatOfferAmount(
  discountType: number | undefined,
  value: number | undefined
): string {
  const v = value ?? 0;
  return discountType === 1 ? `$${v} OFF` : `${v}% OFF`;
}

interface PromotionCardProps {
  promotion: Promotion;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  onPause: (id: number) => void;
  onStart: (id: number) => void;
}

// Status labels are translation keys, resolved with t() at render.
const STATUS_STYLES: Record<PromotionStatus, { bg: string; text: string; labelKey: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700', labelKey: 'promotions.statusActive' },
  paused: { bg: 'bg-gray-100', text: 'text-gray-600', labelKey: 'promotions.statusPaused' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', labelKey: 'promotions.statusScheduled' },
  ended: { bg: 'bg-red-100', text: 'text-red-600', labelKey: 'promotions.statusEnded' },
};

const TYPE_ICON: Record<PromotionType, { bg: string; icon: React.ReactNode }> = {
  boost: { bg: 'bg-blue-100', icon: <Ionicons name="trending-up" size={20} color="#00C870" /> },
  featured: { bg: 'bg-purple-100', icon: <Ionicons name="flash" size={20} color="#9333EA" /> },
  offer: {
    bg: 'bg-green-100',
    icon: <MaterialCommunityIcons name="gift-outline" size={20} color="#16A34A" />,
  },
  ad: {
    bg: 'bg-orange-100',
    icon: <MaterialCommunityIcons name="bullseye" size={20} color="#EA580C" />,
  },
};

export default function PromotionCard({
  promotion,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  onPause,
  onStart,
}: PromotionCardProps) {
  const navigation = useNavigation();
  const { t } = useLocale();
  const status = STATUS_STYLES[promotion.status];
  const typeIcon = TYPE_ICON[promotion.type];
  const isActive = promotion.status === 'active';
  const isScheduled = promotion.status === 'scheduled';

  const budgetPercent =
    promotion.budgetTotal && promotion.budgetSpent !== undefined
      ? Math.min((promotion.budgetSpent / promotion.budgetTotal) * 100, 100)
      : 0;

  return (
    <View className={`${cardBg} mb-4 rounded-2xl border ${borderColor} overflow-hidden`}>
      {/* Header row */}
      <View className="flex-row items-start p-4">
        <View
          className={`h-10 w-10 rounded-xl ${typeIcon.bg} mr-3 mt-0.5 items-center justify-center`}>
          {typeIcon.icon}
        </View>
        <View className="flex-1">
          <Text className={`text-base font-bold ${textColor} leading-5`}>{promotion.title}</Text>
          <Text className={`text-xs ${subtextColor} mt-0.5`}>{promotion.description}</Text>
          <View className="mt-1.5 flex-row items-center">
            <Ionicons
              name="calendar-outline"
              size={12}
              color="#9CA3AF"
              style={{ marginRight: 4 }}
            />
            <Text className={`text-xs ${subtextColor}`}>{promotion.dateRange}</Text>
          </View>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${status.bg} ml-2`}>
          <Text className={`text-xs font-semibold ${status.text}`}>
            {t(status.labelKey as any)}
          </Text>
        </View>
      </View>

      {/* Boost Listing — budget + stats */}
      {promotion.type === 'boost' && promotion.budgetTotal !== undefined && (
        <View className="px-4 pb-3">
          <View className="mb-1 flex-row justify-between">
            <Text className={`text-xs font-medium ${subtextColor}`}>{t('promotions.budget')}</Text>
            <Text className={`text-xs font-semibold ${textColor}`}>
              ${promotion.budgetSpent?.toFixed(2)} / ${promotion.budgetTotal}
            </Text>
          </View>
          <View
            className={`h-2 rounded-full ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'} overflow-hidden`}>
            <View
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${budgetPercent}%` }}
            />
          </View>
          <View className="mt-3 flex-row justify-between">
            {[
              {
                icon: 'eye-outline',
                value: promotion.views?.toLocaleString() ?? '0',
                label: t('promotions.views'),
              },
              {
                icon: 'hand-left-outline',
                value: String(promotion.clicks ?? 0),
                label: t('promotions.clicks'),
              },
              {
                icon: 'heart-outline',
                value: String(promotion.bookings ?? 0),
                label: t('promotions.bookings'),
              },
            ].map((stat) => (
              <View key={stat.label} className="flex-1 items-center">
                <Ionicons name={stat.icon as any} size={16} color="#9CA3AF" />
                <Text className={`text-sm font-bold ${textColor} mt-0.5`}>{stat.value}</Text>
                <Text className={`text-xs ${subtextColor}`}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Special Offer — discount info */}
      {promotion.type === 'offer' && (
        <View
          className={`mx-4 mb-3 ${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'} flex-row items-center justify-between rounded-xl p-3`}>
          <View>
            <Text className="text-xl font-bold text-green-600">
              {formatOfferAmount(
                promotion.discountType,
                promotion.discountValue ?? promotion.discountPercent
              )}
            </Text>
            <Text className={`text-xs ${subtextColor} mt-0.5`}>
              {promotion.offerNote ?? t('promotions.forNewClients')}
            </Text>
          </View>
          <View className="items-end">
            <Text className={`text-base font-bold ${textColor}`}>
              {t('promotions.uses', { n: promotion.usageCount ?? 0 })}
            </Text>
          </View>
        </View>
      )}

      {/* Featured Badge — badge active box */}
      {promotion.type === 'featured' && (
        <View
          className={`mx-4 mb-3 ${isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50'} items-center rounded-xl p-4`}>
          <Ionicons name="flash" size={28} color="#9333EA" />
          <Text className="mt-1.5 font-semibold text-purple-600">
            {t('promotions.featuredBadgeActive')}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View className={`flex-row border-t ${borderColor} gap-2 px-4 py-3`}>
        {isScheduled ? (
          <TouchableOpacity
            onPress={() => onStart(promotion.id)}
            activeOpacity={0.7}
            className="flex-1 flex-row items-center justify-center rounded-xl bg-brand-500 py-2.5">
            <Ionicons name="play" size={14} color="white" style={{ marginRight: 6 }} />
            <Text className="text-sm font-semibold text-white">{t('promotions.startNow')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => onPause(promotion.id)}
            activeOpacity={0.7}
            className={`flex-1 flex-row items-center justify-center rounded-xl border py-2.5 ${borderColor} ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'}`}>
            <Ionicons
              name={isActive ? 'pause' : 'play'}
              size={14}
              color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              style={{ marginRight: 6 }}
            />
            <Text className={`text-sm font-semibold ${subtextColor}`}>
              {isActive ? t('promotions.pause') : t('promotions.resume')}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            (navigation as any).navigate('PromotionAnalytics', {
              promotion,
              promotionTitle: promotion.title,
              promotionDescription: promotion.description,
            })
          }
          className={`flex-1 flex-row items-center justify-center rounded-xl border py-2.5 ${borderColor} ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'}`}>
          <Ionicons
            name="bar-chart-outline"
            size={14}
            color={isDarkMode ? '#9CA3AF' : '#6B7280'}
            style={{ marginRight: 6 }}
          />
          <Text className={`text-sm font-semibold ${subtextColor}`}>
            {t('promotions.analytics')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => (navigation as any).navigate('EditPromotion', { promotion })}
          className={`w-10 items-center justify-center rounded-xl border ${borderColor} ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'}`}>
          <Ionicons name="pencil-outline" size={16} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
