import React, { useRef } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { BenefitCard, HowItWorksStep, TestimonialCard } from '../components';

// Titles/descriptions are translation keys, resolved with t() at render.
const benefits = [
  {
    id: 1,
    icon: 'cash-outline',
    iconType: 'ionicons',
    titleKey: 'becomePartner.benefit1Title',
    descKey: 'becomePartner.benefit1Desc',
    color: '#00C870',
    bgColor: '#E6F9F0',
  },
  {
    id: 2,
    icon: 'calendar-outline',
    iconType: 'ionicons',
    titleKey: 'becomePartner.benefit2Title',
    descKey: 'becomePartner.benefit2Desc',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
  },
  {
    id: 3,
    icon: 'trending-up',
    iconType: 'ionicons',
    titleKey: 'becomePartner.benefit3Title',
    descKey: 'becomePartner.benefit3Desc',
    color: '#A855F7',
    bgColor: '#F3E8FF',
  },
  {
    id: 4,
    icon: 'shield-checkmark-outline',
    iconType: 'ionicons',
    titleKey: 'becomePartner.benefit4Title',
    descKey: 'becomePartner.benefit4Desc',
    color: '#F97316',
    bgColor: '#FFF7ED',
  },
];

const howItWorks = [
  { id: 1, step: '1', titleKey: 'becomePartner.step1Title', descKey: 'becomePartner.step1Desc' },
  { id: 2, step: '2', titleKey: 'becomePartner.step2Title', descKey: 'becomePartner.step2Desc' },
  { id: 3, step: '3', titleKey: 'becomePartner.step3Title', descKey: 'becomePartner.step3Desc' },
];

const requirements = [
  { id: 1, textKey: 'becomePartner.req1' },
  { id: 2, textKey: 'becomePartner.req2' },
  { id: 3, textKey: 'becomePartner.req3' },
  { id: 4, textKey: 'becomePartner.req4' },
];

export default function BecomePartnerScreen() {
  const navigation = useNavigation();
  const {
    isDarkMode,
    cardBg,
    bgColor: contentBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();
  const { t } = useLocale();
  const scrollY = useRef(new Animated.Value(0)).current;

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('becomePartner.title')}
      headerSubtitle={t('becomePartner.subtitle')}
      contentBg={contentBg}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}>
        {/* Stats Card */}
        <View className={`${cardBg} mb-6 rounded-2xl border p-6 ${borderColor}`}>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">10K+</Text>
              <Text className={`text-xs ${subtextColor} mt-1`}>
                {t('becomePartner.statActive')}
              </Text>
              <Text className={`text-xs ${subtextColor}`}>{t('becomePartner.statProviders')}</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">$2K</Text>
              <Text className={`text-xs ${subtextColor} mt-1`}>
                {t('becomePartner.statAvgMonthly')}
              </Text>
              <Text className={`text-xs ${subtextColor}`}>{t('becomePartner.statEarnings')}</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">4.8★</Text>
              <Text className={`text-xs ${subtextColor} mt-1`}>
                {t('becomePartner.statProvider')}
              </Text>
              <Text className={`text-xs ${subtextColor}`}>{t('becomePartner.statRating')}</Text>
            </View>
          </View>
        </View>

        {/* Why Partner with Us */}
        <Text className={`text-xl font-bold ${textColor} mb-4`}>
          {t('becomePartner.whyPartner')}
        </Text>
        {benefits.map((benefit) => (
          <BenefitCard
            key={benefit.id}
            icon={benefit.icon}
            title={t(benefit.titleKey as any)}
            description={t(benefit.descKey as any)}
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
        <Text className={`text-xl font-bold ${textColor} mb-4 mt-6`}>
          {t('becomePartner.howItWorks')}
        </Text>
        {howItWorks.map((item, index) => (
          <HowItWorksStep
            key={item.id}
            step={item.step}
            title={t(item.titleKey as any)}
            description={t(item.descKey as any)}
            isLast={index === howItWorks.length - 1}
            textColor={textColor}
            subtextColor={subtextColor}
          />
        ))}

        {/* Requirements */}
        <Text className={`text-xl font-bold ${textColor} mb-4 mt-6`}>
          {t('becomePartner.requirements')}
        </Text>
        <View className={`${isDarkMode ? 'bg-[#243447]' : 'bg-blue-50'} mb-6 rounded-2xl p-4`}>
          {requirements.map((req) => (
            <View key={req.id} className="mb-3 flex-row items-start last:mb-0">
              <Ionicons
                name="star"
                size={16}
                color="#3B82F6"
                style={{ marginTop: 2, marginRight: 8 }}
              />
              <Text className={`flex-1 text-sm ${isDarkMode ? 'text-blue-200' : 'text-blue-900'}`}>
                {t(req.textKey as any)}
              </Text>
            </View>
          ))}
        </View>

        <TestimonialCard
          isDarkMode={isDarkMode}
          cardBg={cardBg}
          textColor={textColor}
          subtextColor={subtextColor}
          borderColor={borderColor}
        />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('PartnerApplication')}
          className="items-center rounded-2xl bg-brand-500 py-4">
          <Text className="text-lg font-bold text-white">{t('becomePartner.getStarted')}</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
