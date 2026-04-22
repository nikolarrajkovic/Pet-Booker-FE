import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { PromotionCard } from '../components';
import type { Promotion } from '../components';

const mockPromotions: Promotion[] = [
  {
    id: 1,
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
    id: 2,
    type: 'offer',
    title: 'New Client 20% Off',
    description: 'Professional Pet Grooming & Spa',
    dateRange: 'Apr 10, 2026 - May 10, 2026',
    status: 'active',
    discountPercent: 20,
    usageCount: 8,
    offerNote: 'For new clients only',
  },
  {
    id: 3,
    type: 'featured',
    title: 'Featured Badge - Pet Sitting',
    description: 'In-Home Pet Sitting & Care',
    dateRange: 'Apr 25, 2026 - May 25, 2026',
    status: 'scheduled',
  },
];

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
  const { isDarkMode } = useTheme();
  const viewAll = route?.params?.viewAll ?? false;

  const [promotions, setPromotions] = useState<Promotion[]>(mockPromotions);

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-100';

  const handlePause = (id: number) =>
    setPromotions((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === 'active' ? 'paused' : 'active' } : p
      )
    );

  const handleStart = (id: number) =>
    setPromotions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'active' } : p))
    );

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

        {promotions.length === 0 ? (
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
