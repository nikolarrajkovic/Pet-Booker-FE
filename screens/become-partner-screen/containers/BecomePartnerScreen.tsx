import React, { useRef } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { BenefitCard, HowItWorksStep, TestimonialCard } from '../components';

const benefits = [
  { id: 1, icon: 'cash-outline', iconType: 'ionicons', title: 'Earn More', description: 'Set your own rates and get paid weekly', color: '#00C870', bgColor: '#E6F9F0' },
  { id: 2, icon: 'calendar-outline', iconType: 'ionicons', title: 'Flexible Schedule', description: 'Work on your own time and availability', color: '#3B82F6', bgColor: '#EFF6FF' },
  { id: 3, icon: 'trending-up', iconType: 'ionicons', title: 'Grow Your Business', description: 'Access thousands of pet owners in your area', color: '#A855F7', bgColor: '#F3E8FF' },
  { id: 4, icon: 'shield-checkmark-outline', iconType: 'ionicons', title: 'Protected Payments', description: 'Secure transactions and insurance coverage', color: '#F97316', bgColor: '#FFF7ED' },
];

const howItWorks = [
  { id: 1, step: '1', title: 'Sign Up', description: 'Complete your profile and verification' },
  { id: 2, step: '2', title: 'Get Approved', description: "We'll review your application within 24-48 hours" },
  { id: 3, step: '3', title: 'Start Earning', description: 'Accept bookings and grow your business' },
];

const requirements = [
  { id: 1, text: 'Experience in pet care or related field' },
  { id: 2, text: 'Valid ID and background check' },
  { id: 3, text: 'Proof of insurance (we can help!)' },
  { id: 4, text: 'Professional references' },
];

export default function BecomePartnerScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-100';

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Become a Partner"
      headerSubtitle="Join our community of trusted pet care providers"
      contentBg={contentBg}
    >

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* Stats Card */}
        <View className={`${cardBg} rounded-2xl p-6 mb-6 border ${borderColor}`}>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">10K+</Text>
              <Text className={`text-xs ${subtextColor} mt-1`}>Active</Text>
              <Text className={`text-xs ${subtextColor}`}>Providers</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">$2K</Text>
              <Text className={`text-xs ${subtextColor} mt-1`}>Avg Monthly</Text>
              <Text className={`text-xs ${subtextColor}`}>Earnings</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">4.8★</Text>
              <Text className={`text-xs ${subtextColor} mt-1`}>Provider</Text>
              <Text className={`text-xs ${subtextColor}`}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Why Partner with Us */}
        <Text className={`text-xl font-bold ${textColor} mb-4`}>Why Partner with Us?</Text>
        {benefits.map((benefit) => (
          <BenefitCard
            key={benefit.id}
            icon={benefit.icon}
            title={benefit.title}
            description={benefit.description}
            color={benefit.color}
            bgColor={benefit.bgColor}
            isDarkMode={isDarkMode}
            cardBg={cardBg}
            textColor={textColor}
            subtextColor={subtextColor}
            borderColor={borderColor}
          />
        ))}

        {/* How It Works */}
        <Text className={`text-xl font-bold ${textColor} mb-4 mt-6`}>How It Works</Text>
        {howItWorks.map((item, index) => (
          <HowItWorksStep
            key={item.id}
            step={item.step}
            title={item.title}
            description={item.description}
            isLast={index === howItWorks.length - 1}
            textColor={textColor}
            subtextColor={subtextColor}
          />
        ))}

        {/* Requirements */}
        <Text className={`text-xl font-bold ${textColor} mb-4 mt-6`}>Requirements</Text>
        <View className={`${isDarkMode ? 'bg-[#243447]' : 'bg-blue-50'} rounded-2xl p-4 mb-6`}>
          {requirements.map((req) => (
            <View key={req.id} className="flex-row items-start mb-3 last:mb-0">
              <Ionicons name="star" size={16} color="#3B82F6" style={{ marginTop: 2, marginRight: 8 }} />
              <Text className={`flex-1 text-sm ${isDarkMode ? 'text-blue-200' : 'text-blue-900'}`}>{req.text}</Text>
            </View>
          ))}
        </View>

        <TestimonialCard isDarkMode={isDarkMode} cardBg={cardBg} textColor={textColor} subtextColor={subtextColor} borderColor={borderColor} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('PartnerApplication')}
          className="bg-brand-500 py-4 rounded-2xl items-center"
        >
          <Text className="text-white text-lg font-bold">Get Started</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
