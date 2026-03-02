import React, { useRef } from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const benefits = [
  {
    id: 1,
    icon: 'cash-outline',
    iconType: 'ionicons',
    title: 'Earn More',
    description: 'Set your own rates and get paid weekly',
    color: '#00C870',
    bgColor: '#E6F9F0',
  },
  {
    id: 2,
    icon: 'calendar-outline',
    iconType: 'ionicons',
    title: 'Flexible Schedule',
    description: 'Work on your own time and availability',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
  },
  {
    id: 3,
    icon: 'trending-up',
    iconType: 'ionicons',
    title: 'Grow Your Business',
    description: 'Access thousands of pet owners in your area',
    color: '#A855F7',
    bgColor: '#F3E8FF',
  },
  {
    id: 4,
    icon: 'shield-checkmark-outline',
    iconType: 'ionicons',
    title: 'Protected Payments',
    description: 'Secure transactions and insurance coverage',
    color: '#F97316',
    bgColor: '#FFF7ED',
  },
];

const howItWorks = [
  {
    id: 1,
    step: '1',
    title: 'Sign Up',
    description: 'Complete your profile and verification',
  },
  {
    id: 2,
    step: '2',
    title: 'Get Approved',
    description: "We'll review your application within 24-48 hours",
  },
  {
    id: 3,
    step: '3',
    title: 'Start Earning',
    description: 'Accept bookings and grow your business',
  },
];

const requirements = [
  {
    id: 1,
    text: 'Experience in pet care or related field',
  },
  {
    id: 2,
    text: 'Valid ID and background check',
  },
  {
    id: 3,
    text: 'Proof of insurance (we can help!)',
  },
  {
    id: 4,
    text: 'Professional references',
  },
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
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Green Header */}
      <View className={`${bgColor} px-6 pt-12 pb-8`}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mb-6"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <Text className="text-white text-2xl font-bold mb-2">Become a Partner</Text>
        <Text className={`${isDarkMode ? 'text-gray-300' : 'text-brand-100'} text-base`}>
          Join our community of trusted pet care providers
        </Text>
      </View>

      <ScrollView 
        className={`flex-1 ${contentBg} rounded-t-3xl -mt-4`}
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
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
          <View key={benefit.id} className={`${cardBg} rounded-2xl p-4 mb-3 border ${borderColor} flex-row items-center`}>
            <View className={`w-12 h-12 rounded-xl items-center justify-center mr-4`} style={{ backgroundColor: isDarkMode ? '#243447' : benefit.bgColor }}>
              <Ionicons name={benefit.icon as any} size={24} color={benefit.color} />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>{benefit.title}</Text>
              <Text className={`text-sm ${subtextColor} mt-1`}>{benefit.description}</Text>
            </View>
          </View>
        ))}

        {/* How It Works */}
        <Text className={`text-xl font-bold ${textColor} mb-4 mt-6`}>How It Works</Text>
        
        {howItWorks.map((item, index) => (
          <View key={item.id} className="flex-row mb-4">
            <View className="mr-4 items-center">
              <View className="w-10 h-10 bg-brand-500 rounded-full items-center justify-center">
                <Text className="text-white font-bold text-base">{item.step}</Text>
              </View>
              {index < howItWorks.length - 1 && (
                <View className="flex-1 w-0.5 bg-brand-200 mt-2" style={{ height: 40 }} />
              )}
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor} mb-1`}>{item.title}</Text>
              <Text className={`text-sm ${subtextColor}`}>{item.description}</Text>
            </View>
          </View>
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

        {/* Testimonial */}
        <View className={`${cardBg} rounded-2xl p-6 border ${borderColor} mb-6`}>
          <View className="flex-row items-center mb-4">
            <View className="w-12 h-12 bg-brand-500 rounded-full items-center justify-center mr-3">
              <Text className="text-white text-lg font-bold">SJ</Text>
            </View>
            <View>
              <Text className={`text-base font-semibold ${textColor}`}>Sarah Johnson</Text>
              <Text className={`text-sm ${subtextColor}`}>Dog Walker, San Francisco</Text>
            </View>
          </View>
          <Text className={`text-sm ${isDarkMode ? 'text-green-200' : 'text-green-900'} italic leading-6`}>
            "PawCare helped me turn my passion for animals into a thriving business. I now have a steady stream of clients and earn more than my previous job."
          </Text>
        </View>
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
    </SafeAreaView>
  );
}
