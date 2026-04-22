import React from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';

interface DailyStats {
  date: string;
  views: number;
  clicks: number;
  bookings: number;
}

const dailyData: DailyStats[] = [
  { date: 'Apr 12', views: 420, clicks: 18, bookings: 1 },
  { date: 'Apr 13', views: 520, clicks: 24, bookings: 2 },
  { date: 'Apr 14', views: 480, clicks: 21, bookings: 1 },
  { date: 'Apr 15', views: 510, clicks: 25, bookings: 2 },
  { date: 'Apr 16', views: 490, clicks: 22, bookings: 2 },
  { date: 'Apr 17', views: 530, clicks: 23, bookings: 2 },
  { date: 'Apr 18', views: 470, clicks: 23, bookings: 2 },
];

const maxViews = Math.max(...dailyData.map((d) => d.views));
const maxClicks = Math.max(...dailyData.map((d) => d.clicks));
const maxBookings = Math.max(...dailyData.map((d) => d.bookings));

interface PromotionAnalyticsScreenProps {
  route?: {
    params?: {
      promotion?: any;
      promotionTitle?: string;
      promotionDescription?: string;
    };
  };
}

export default function PromotionAnalyticsScreen({ route }: PromotionAnalyticsScreenProps) {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const promotion = route?.params?.promotion;
  const title = route?.params?.promotionTitle ?? promotion?.title ?? 'Spring Boost - Dog Walking';
  const description = route?.params?.promotionDescription ?? promotion?.description ?? 'Premium Dog Walking in Golden Gate Park';

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-100';
  const rowBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';

  const STAT_CARDS = [
    {
      icon: <Ionicons name="eye-outline" size={20} color="#2563EB" />,
      iconBg: 'bg-blue-100',
      value: '3,420',
      label: 'Total Views',
      sub: '+12% vs last week',
      subColor: 'text-green-600',
      subIcon: 'trending-up',
    },
    {
      icon: <MaterialCommunityIcons name="cursor-default-click-outline" size={20} color="#9333EA" />,
      iconBg: 'bg-purple-100',
      value: '156',
      label: 'Total Clicks',
      sub: '4.56% CTR',
      subColor: subtextColor,
      subIcon: null,
    },
    {
      icon: <Ionicons name="heart-outline" size={20} color="#16A34A" />,
      iconBg: 'bg-green-100',
      value: '12',
      label: 'Bookings',
      sub: '7.69% conversion',
      subColor: subtextColor,
      subIcon: null,
    },
    {
      icon: <Ionicons name="cash-outline" size={20} color="#EA580C" />,
      iconBg: 'bg-orange-100',
      value: '586%',
      label: 'ROI',
      sub: 'Profitable',
      subColor: 'text-green-600',
      subIcon: 'trending-up',
    },
  ];

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Analytics"
      headerSubtitle={`${title}\n${description}`}
      contentBg={contentBg}
      rightAction={
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            promotion
              ? (navigation as any).replace('EditPromotion', { promotion })
              : (navigation as any).goBack()
          }
          className="w-10 h-10 bg-brand-600 rounded-xl items-center justify-center"
        >
          <Ionicons name="pencil-outline" size={16} color="white" />
        </TouchableOpacity>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI grid */}
        <View className="flex-row flex-wrap gap-3 mb-5">
          {STAT_CARDS.map((card, i) => (
            <View
              key={i}
              className={`${cardBg} rounded-2xl p-4 border ${borderColor} flex-1`}
              style={{ minWidth: '45%' }}
            >
              <View className={`w-10 h-10 rounded-xl ${card.iconBg} items-center justify-center mb-3`}>
                {card.icon}
              </View>
              <Text className={`text-2xl font-bold ${textColor}`}>{card.value}</Text>
              <Text className={`text-xs ${subtextColor} mt-0.5`}>{card.label}</Text>
              <View className="flex-row items-center mt-1.5">
                {card.subIcon && (
                  <Ionicons name={card.subIcon as any} size={12} color="#16A34A" style={{ marginRight: 3 }} />
                )}
                <Text className={`text-xs font-medium ${card.subColor}`}>{card.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Performance Over Time */}
        <View className={`${cardBg} rounded-2xl border ${borderColor} p-4 mb-4`}>
          <Text className={`text-base font-bold ${textColor} mb-4`}>Performance Over Time</Text>
          {dailyData.map((day) => (
            <View key={day.date} className="mb-3">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className={`text-xs font-semibold ${subtextColor} w-12`}>{day.date}</Text>
                <Text className={`text-xs ${subtextColor} flex-1 ml-2`}>
                  {day.views} views • {day.clicks} clicks • {day.bookings} bookings
                </Text>
              </View>
              {/* Single gradient bar: blue → purple → green */}
              <View className={`h-2 rounded-full ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'} overflow-hidden`}>
                <LinearGradient
                  colors={['#3B82F6', '#A855F7', '#22C55E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ height: '100%', borderRadius: 999, width: `${(day.views / maxViews) * 100}%` }}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Cost Analysis */}
        <View className={`${cardBg} rounded-2xl border ${borderColor} p-4 mb-4`}>
          <Text className={`text-base font-bold ${textColor} mb-4`}>Cost Analysis</Text>
          {[
            { label: 'Total Spent', value: '$87.50', valueColor: textColor },
            { label: 'Cost per Click', value: '$0.56', valueColor: textColor },
            { label: 'Cost per Booking', value: '$7.29', valueColor: textColor },
          ].map((row) => (
            <View key={row.label} className={`flex-row justify-between py-3 border-b ${borderColor}`}>
              <Text className={`text-sm ${subtextColor}`}>{row.label}</Text>
              <Text className={`text-sm font-semibold ${row.valueColor}`}>{row.value}</Text>
            </View>
          ))}
          <View className={`flex-row justify-between py-3 border-b ${borderColor}`}>
            <Text className={`text-sm ${subtextColor}`}>Estimated Revenue</Text>
            <Text className="text-sm font-semibold text-green-600">$600.00</Text>
          </View>
          <View className="flex-row justify-between pt-3">
            <Text className={`text-sm font-bold ${textColor}`}>Net Profit</Text>
            <Text className="text-sm font-bold text-green-600">+$512.50</Text>
          </View>
        </View>

        {/* Performance Insights */}
        <View className={`${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-2xl p-4`}>
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
              <MaterialCommunityIcons name="pulse" size={18} color="#2563EB" />
            </View>
            <Text className={`text-base font-bold ${textColor}`}>Performance Insights</Text>
          </View>
          {[
            'Your click-through rate (4.56%) is above average for this category',
            'Peak engagement occurs on weekends between 2-6 PM',
            'Consider increasing your budget to maximize reach during high-traffic periods',
          ].map((insight) => (
            <View key={insight} className="flex-row items-start mb-2">
              <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 mr-2.5 flex-shrink-0" />
              <Text className={`text-sm ${subtextColor} flex-1 leading-5`}>{insight}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
