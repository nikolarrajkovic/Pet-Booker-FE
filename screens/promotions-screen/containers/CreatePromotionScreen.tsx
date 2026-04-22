import React from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';

interface PromotionTypeOption {
  key: string;
  title: string;
  description: string;
  price: string;
  priceColor: string;
  iconBg: string;
  icon: React.ReactNode;
  bullets: string[];
}

const PROMOTION_TYPES: PromotionTypeOption[] = [
  {
    key: 'boost',
    title: 'Boost Listing',
    description: 'Appear higher in search results',
    price: 'Starting at $50/week',
    priceColor: 'text-green-600',
    iconBg: 'bg-blue-100',
    icon: <Ionicons name="trending-up" size={24} color="#00C870" />,
    bullets: ['2x visibility', 'Priority placement', 'Analytics dashboard'],
  },
  {
    key: 'featured',
    title: 'Featured Badge',
    description: 'Stand out with a special badge',
    price: '$99/month',
    priceColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
    icon: <Ionicons name="flash" size={24} color="#9333EA" />,
    bullets: ["'Featured' badge", 'Top of category', 'Verified checkmark'],
  },
  {
    key: 'offer',
    title: 'Special Offer',
    description: 'Create discounts for new clients',
    price: 'Free to create',
    priceColor: 'text-green-600',
    iconBg: 'bg-green-100',
    icon: <MaterialCommunityIcons name="gift-outline" size={24} color="#16A34A" />,
    bullets: ['Set discount %', 'Target new users', 'Time-limited offers'],
  },
  {
    key: 'ad',
    title: 'Ad Campaign',
    description: 'Run targeted advertising',
    price: 'Custom budget',
    priceColor: 'text-orange-500',
    iconBg: 'bg-orange-100',
    icon: <MaterialCommunityIcons name="bullseye" size={24} color="#EA580C" />,
    bullets: ['Location targeting', 'Service-specific', 'Performance tracking'],
  },
];

export default function CreatePromotionScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Create Promotion"
      headerSubtitle="Choose a promotion type to get started"
      contentBg={contentBg}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {PROMOTION_TYPES.map((option) => (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.75}
            onPress={() => (navigation as any).goBack()}
            className={`${cardBg} rounded-2xl p-5 mb-4 border ${borderColor}`}
          >
            <View className="flex-row items-start mb-3">
              <View className={`w-12 h-12 rounded-2xl ${option.iconBg} items-center justify-center mr-4`}>
                {option.icon}
              </View>
              <View className="flex-1">
                <Text className={`text-base font-bold ${textColor}`}>{option.title}</Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>{option.description}</Text>
                <Text className={`text-sm font-semibold mt-1 ${option.priceColor}`}>{option.price}</Text>
              </View>
            </View>
            <View className="gap-1.5">
              {option.bullets.map((bullet) => (
                <View key={bullet} className="flex-row items-center">
                  <View className="w-1.5 h-1.5 rounded-full bg-brand-500 mr-2.5" />
                  <Text className={`text-sm ${subtextColor}`}>{bullet}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenLayout>
  );
}
