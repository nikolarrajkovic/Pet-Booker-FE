import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import type { Promotion, PromotionType, PromotionStatus } from '../components';

const TYPE_META: Record<
  PromotionType,
  { label: string; iconBg: string; icon: React.ReactNode }
> = {
  boost: {
    label: 'Boost Listing',
    iconBg: 'bg-blue-100',
    icon: <Ionicons name="trending-up" size={22} color="#00C870" />,
  },
  featured: {
    label: 'Featured Badge',
    iconBg: 'bg-purple-100',
    icon: <Ionicons name="flash" size={22} color="#9333EA" />,
  },
  offer: {
    label: 'Special Offer',
    iconBg: 'bg-green-100',
    icon: <MaterialCommunityIcons name="gift-outline" size={22} color="#16A34A" />,
  },
  ad: {
    label: 'Ad Campaign',
    iconBg: 'bg-orange-100',
    icon: <MaterialCommunityIcons name="bullseye" size={22} color="#EA580C" />,
  },
};

const STATUS_STYLES: Record<PromotionStatus, { bg: string; text: string; label: string }> = {
  active:    { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  paused:    { bg: 'bg-gray-100',  text: 'text-gray-500',  label: 'Paused' },
  scheduled: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Scheduled' },
  ended:     { bg: 'bg-red-100',   text: 'text-red-600',   label: 'Ended' },
};

interface EditPromotionScreenProps {
  route?: {
    params?: {
      promotion?: Promotion;
    };
  };
}

// Fallback mock so screen is usable standalone
const FALLBACK: Promotion = {
  id: 1,
  type: 'boost',
  title: 'Spring Boost - Dog Walking',
  description: 'Premium Dog Walking in Golden Gate Park',
  dateRange: 'Apr 15, 2026 - Apr 30, 2026',
  status: 'active',
  budgetSpent: 87.5,
  budgetTotal: 150,
};

export default function EditPromotionScreen({ route }: EditPromotionScreenProps) {
  const navigation = useNavigation();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor, inputBg } = useThemeColors();

  const promotion = route?.params?.promotion ?? FALLBACK;
  const meta = TYPE_META[promotion.type];
  const statusStyle = STATUS_STYLES[promotion.status];
  const isScheduled = promotion.status === 'scheduled';

  // Parse date range into start / end
  const [startDate, endDate] = promotion.dateRange.includes(' - ')
    ? promotion.dateRange.split(' - ')
    : [promotion.dateRange, ''];

  const [name, setName] = useState(promotion.title);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [budget, setBudget] = useState(String(promotion.budgetTotal ?? ''));
  const [discount, setDiscount] = useState(String(promotion.discountPercent ?? ''));

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const inputBorder = borderColor;
  const labelColor = isDarkMode ? 'text-gray-300' : 'text-gray-700';

  const inputStyle = `${inputBg} border ${inputBorder} rounded-xl px-4 py-3.5 text-sm ${textColor}`;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Edit Promotion"
      headerSubtitle="Update your promotion details"
      contentBg={contentBg}
      rightAction={
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            (navigation as any).replace('PromotionAnalytics', {
              promotion,
              promotionTitle: promotion.title,
              promotionDescription: promotion.description,
            })
          }
          className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
        >
          <Ionicons name="bar-chart-outline" size={18} color="white" />
        </TouchableOpacity>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Promotion type banner */}
        <View className={`${cardBg} rounded-2xl p-4 mb-5 border ${borderColor} flex-row items-center`}>
          <View className={`w-11 h-11 rounded-xl ${meta.iconBg} items-center justify-center mr-3`}>
            {meta.icon}
          </View>
          <View className="flex-1">
            <Text className={`text-xs ${subtextColor}`}>Promotion Type</Text>
            <Text className={`text-base font-bold ${textColor}`}>{meta.label}</Text>
          </View>
          <View className={`px-2.5 py-1 rounded-full ${statusStyle.bg}`}>
            <Text className={`text-xs font-semibold ${statusStyle.text}`}>{statusStyle.label}</Text>
          </View>
        </View>

        {/* Promotion Name */}
        <Text className={`text-sm font-semibold ${labelColor} mb-2`}>Promotion Name</Text>
        <TextInput
          className={`${inputStyle} mb-5`}
          value={name}
          onChangeText={setName}
          placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
        />

        {/* Campaign Duration */}
        <Text className={`text-sm font-semibold ${labelColor} mb-2`}>Campaign Duration</Text>
        <View className="flex-row gap-3 mb-5">
          <View className="flex-1">
            <Text className={`text-xs ${subtextColor} mb-1.5`}>Start Date</Text>
            <TextInput
              className={inputStyle}
              value={start}
              onChangeText={setStart}
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />
          </View>
          <View className="flex-1">
            <Text className={`text-xs ${subtextColor} mb-1.5`}>End Date</Text>
            <TextInput
              className={inputStyle}
              value={end}
              onChangeText={setEnd}
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Budget — Boost only */}
        {promotion.type === 'boost' && (
          <>
            <Text className={`text-sm font-semibold ${labelColor} mb-2`}>Budget</Text>
            <View className={`${inputBg} border ${inputBorder} rounded-xl flex-row items-center px-4 mb-1`}>
              <Ionicons name="cash-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                className={`flex-1 py-3.5 text-sm ${textColor}`}
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
            </View>
            {promotion.budgetSpent !== undefined && (
              <Text className={`text-xs ${subtextColor} mb-5`}>
                ${promotion.budgetSpent} spent of ${budget} budget
              </Text>
            )}
            {promotion.budgetSpent === undefined && <View className="mb-5" />}
          </>
        )}

        {/* Discount — Offer only */}
        {promotion.type === 'offer' && (
          <>
            <Text className={`text-sm font-semibold ${labelColor} mb-2`}>Discount Percentage</Text>
            <View className={`${inputBg} border ${inputBorder} rounded-xl flex-row items-center px-4 mb-5`}>
              <TextInput
                className={`flex-1 py-3.5 text-sm ${textColor}`}
                value={discount}
                onChangeText={setDiscount}
                keyboardType="numeric"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
              <Text className={`text-sm font-semibold ${subtextColor}`}>%</Text>
            </View>
          </>
        )}

        {/* Save Changes */}
        <TouchableOpacity
          onPress={() => (navigation as any).goBack()}
          activeOpacity={0.8}
          className="bg-brand-500 rounded-2xl py-4 items-center mb-3"
        >
          <Text className="text-white text-base font-bold">Save Changes</Text>
        </TouchableOpacity>

        {/* Pause — only for active/paused (not scheduled) */}
        {!isScheduled && (
          <TouchableOpacity
            activeOpacity={0.8}
            className={`rounded-2xl py-4 items-center mb-3 flex-row justify-center ${isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}
          >
            <Ionicons name="pause" size={16} color="#D97706" style={{ marginRight: 8 }} />
            <Text className="text-yellow-600 text-base font-semibold">Pause Promotion</Text>
          </TouchableOpacity>
        )}

        {/* Delete */}
        <TouchableOpacity
          activeOpacity={0.8}
          className={`rounded-2xl py-4 items-center ${isDarkMode ? 'bg-red-900/20' : 'bg-red-50'}`}
        >
          <Text className="text-red-500 text-base font-semibold">Delete Promotion</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}
