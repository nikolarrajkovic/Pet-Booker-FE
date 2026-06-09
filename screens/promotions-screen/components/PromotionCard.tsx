import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

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
  discountPercent?: number;
  usageCount?: number;
  offerNote?: string;
  // API linkage — present for real 'offer' promotions backed by a ServiceDiscount
  discountId?: number;
  serviceId?: number;
  discountType?: number;   // DiscountType: 0=Percent, 1=Fixed
  applyFrom?: string;      // ISO
  applyTo?: string | null; // ISO
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

const STATUS_STYLES: Record<PromotionStatus, { bg: string; text: string; label: string }> = {
  active:    { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  paused:    { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'Paused' },
  scheduled: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Scheduled' },
  ended:     { bg: 'bg-red-100',   text: 'text-red-600',   label: 'Ended' },
};

const TYPE_ICON: Record<PromotionType, { bg: string; icon: React.ReactNode }> = {
  boost:    { bg: 'bg-blue-100',   icon: <Ionicons name="trending-up" size={20} color="#00C870" /> },
  featured: { bg: 'bg-purple-100', icon: <Ionicons name="flash" size={20} color="#9333EA" /> },
  offer:    { bg: 'bg-green-100',  icon: <MaterialCommunityIcons name="gift-outline" size={20} color="#16A34A" /> },
  ad:       { bg: 'bg-orange-100', icon: <MaterialCommunityIcons name="bullseye" size={20} color="#EA580C" /> },
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
  const status = STATUS_STYLES[promotion.status];
  const typeIcon = TYPE_ICON[promotion.type];
  const isActive = promotion.status === 'active';
  const isScheduled = promotion.status === 'scheduled';

  const budgetPercent =
    promotion.budgetTotal && promotion.budgetSpent !== undefined
      ? Math.min((promotion.budgetSpent / promotion.budgetTotal) * 100, 100)
      : 0;

  return (
    <View className={`${cardBg} rounded-2xl mb-4 border ${borderColor} overflow-hidden`}>
      {/* Header row */}
      <View className="p-4 flex-row items-start">
        <View className={`w-10 h-10 rounded-xl ${typeIcon.bg} items-center justify-center mr-3 mt-0.5`}>
          {typeIcon.icon}
        </View>
        <View className="flex-1">
          <Text className={`text-base font-bold ${textColor} leading-5`}>{promotion.title}</Text>
          <Text className={`text-xs ${subtextColor} mt-0.5`}>{promotion.description}</Text>
          <View className="flex-row items-center mt-1.5">
            <Ionicons name="calendar-outline" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
            <Text className={`text-xs ${subtextColor}`}>{promotion.dateRange}</Text>
          </View>
        </View>
        <View className={`px-2.5 py-1 rounded-full ${status.bg} ml-2`}>
          <Text className={`text-xs font-semibold ${status.text}`}>{status.label}</Text>
        </View>
      </View>

      {/* Boost Listing — budget + stats */}
      {promotion.type === 'boost' && promotion.budgetTotal !== undefined && (
        <View className="px-4 pb-3">
          <View className="flex-row justify-between mb-1">
            <Text className={`text-xs font-medium ${subtextColor}`}>Budget</Text>
            <Text className={`text-xs font-semibold ${textColor}`}>
              ${promotion.budgetSpent?.toFixed(2)} / ${promotion.budgetTotal}
            </Text>
          </View>
          <View className={`h-2 rounded-full ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'} overflow-hidden`}>
            <View className="h-full rounded-full bg-brand-500" style={{ width: `${budgetPercent}%` }} />
          </View>
          <View className="flex-row justify-between mt-3">
            {[
              { icon: 'eye-outline', value: promotion.views?.toLocaleString() ?? '0', label: 'Views' },
              { icon: 'hand-left-outline', value: String(promotion.clicks ?? 0), label: 'Clicks' },
              { icon: 'heart-outline', value: String(promotion.bookings ?? 0), label: 'Bookings' },
            ].map((stat) => (
              <View key={stat.label} className="items-center flex-1">
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
        <View className={`mx-4 mb-3 ${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'} rounded-xl p-3 flex-row items-center justify-between`}>
          <View>
            <Text className="text-green-600 text-xl font-bold">{promotion.discountPercent}% OFF</Text>
            <Text className={`text-xs ${subtextColor} mt-0.5`}>{promotion.offerNote ?? 'For new clients only'}</Text>
          </View>
          <View className="items-end">
            <Text className={`text-base font-bold ${textColor}`}>{promotion.usageCount ?? 0} uses</Text>
          </View>
        </View>
      )}

      {/* Featured Badge — badge active box */}
      {promotion.type === 'featured' && (
        <View className={`mx-4 mb-3 ${isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50'} rounded-xl p-4 items-center`}>
          <Ionicons name="flash" size={28} color="#9333EA" />
          <Text className="text-purple-600 font-semibold mt-1.5">Featured Badge Active</Text>
        </View>
      )}

      {/* Action buttons */}
      <View className={`flex-row border-t ${borderColor} px-4 py-3 gap-2`}>
        {isScheduled ? (
          <TouchableOpacity
            onPress={() => onStart(promotion.id)}
            activeOpacity={0.7}
            className="flex-1 bg-brand-500 rounded-xl py-2.5 flex-row items-center justify-center"
          >
            <Ionicons name="play" size={14} color="white" style={{ marginRight: 6 }} />
            <Text className="text-white text-sm font-semibold">Start Now</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => onPause(promotion.id)}
            activeOpacity={0.7}
            className={`flex-1 rounded-xl py-2.5 flex-row items-center justify-center border ${borderColor} ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'}`}
          >
            <Ionicons name={isActive ? 'pause' : 'play'} size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 6 }} />
            <Text className={`text-sm font-semibold ${subtextColor}`}>{isActive ? 'Pause' : 'Resume'}</Text>
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
          className={`flex-1 rounded-xl py-2.5 flex-row items-center justify-center border ${borderColor} ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'}`}
        >
          <Ionicons name="bar-chart-outline" size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 6 }} />
          <Text className={`text-sm font-semibold ${subtextColor}`}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => (navigation as any).navigate('EditPromotion', { promotion })}
          className={`w-10 rounded-xl items-center justify-center border ${borderColor} ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'}`}
        >
          <Ionicons name="pencil-outline" size={16} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
