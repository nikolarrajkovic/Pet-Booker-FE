import React from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import { usePageGutter } from '../../../hooks/usePageGutter';
import {
  formatOfferAmount,
  PROMOTION_STATUS_STYLES,
  type Promotion,
} from '../components/PromotionCard';

interface PromotionAnalyticsScreenProps {
  route?: {
    params?: {
      promotion?: Promotion;
    };
  };
}

/**
 * What is known about one promotion — and an honest note about what is not.
 *
 * This screen used to be entirely invented: 3,420 views, 156 clicks, a "586%" ROI, a seven-day
 * chart for dates in April, a cost analysis (promotions cost a partner nothing here) and three
 * "insights" about a click-through rate nobody measures. None of it came from anywhere, and every
 * promotion showed the same numbers. The backend records no views, clicks or per-promotion
 * bookings (BACKEND_GAPS PR1–PR4), so the screen now shows the offer itself and says plainly that
 * performance is not tracked yet.
 */
export default function PromotionAnalyticsScreen({ route }: PromotionAnalyticsScreenProps) {
  const gutter = usePageGutter();
  const navigation = useNavigation();
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();

  const promotion = route?.params?.promotion;

  if (!promotion) {
    // Opened without a promotion — a reload on web, where route params do not survive. It used to
    // fall back to a made-up "Spring Boost" campaign instead.
    return (
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle={t('promotions.analytics')}
        contentBg={bgColor}>
        <ListState isEmpty emptyIcon="pricetag-outline" emptyMessage={t('promotions.notFound')} />
      </ScreenLayout>
    );
  }

  const status = PROMOTION_STATUS_STYLES[promotion.status];
  const isOffer = promotion.discountValue != null || promotion.percentAmount != null;

  const rows: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
  }[] = [
    ...(isOffer
      ? [
          {
            icon: 'pricetag-outline' as const,
            label: t('promotions.discount'),
            value: formatOfferAmount(
              promotion.discountType,
              promotion.discountValue,
              promotion.currency,
              promotion.percentAmount,
              t
            ),
          },
        ]
      : []),
    { icon: 'calendar-outline', label: t('promotions.activePeriod'), value: promotion.dateRange },
  ];

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('promotions.analytics')}
      headerSubtitle={`${promotion.title}\n${promotion.description}`}
      contentBg={bgColor}
      rightAction={
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('promotions.editTitle')}
          activeOpacity={0.7}
          onPress={() => (navigation as any).replace('EditPromotion', { promotion })}
          className="h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
          <Ionicons name="pencil-outline" size={16} color="white" />
        </TouchableOpacity>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: gutter.value,
          paddingTop: 20,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}>
        {/* The offer itself — every value here is the promotion's own. */}
        <View className={`${cardBg} mb-4 rounded-2xl border ${borderColor} p-4`}>
          <View className="mb-3 flex-row items-start justify-between">
            <View className="mr-3 flex-1">
              <Text className={`text-base font-bold ${textColor}`}>{promotion.title}</Text>
              {!!promotion.description && (
                <Text className={`text-sm ${subtextColor} mt-0.5`}>{promotion.description}</Text>
              )}
            </View>
            <View className={`rounded-full px-2.5 py-1 ${status.bg}`}>
              <Text className={`text-xs font-semibold ${status.text}`}>
                {t(status.labelKey as any)}
              </Text>
            </View>
          </View>
          {rows.map((row, i) => (
            <View
              key={row.label}
              className={`flex-row items-center py-3 ${i > 0 ? `border-t ${borderColor}` : ''}`}>
              <Ionicons name={row.icon} size={16} color={BRAND_GREEN} style={{ marginRight: 10 }} />
              <Text className={`text-sm ${subtextColor} flex-1`}>{row.label}</Text>
              <Text className={`text-sm font-semibold ${textColor}`}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* What is not measured yet, said plainly rather than filled with invented numbers. */}
        <View className={`${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-2xl p-4`}>
          <View className="mb-2 flex-row items-center">
            <View
              className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <MaterialCommunityIcons name="chart-line" size={18} color="#2563EB" />
            </View>
            <Text className={`flex-1 text-base font-bold ${textColor}`}>
              {t('promotions.trackingTitle')}
            </Text>
          </View>
          <Text className={`text-sm ${subtextColor} leading-5`}>
            {t('promotions.trackingBody')}
          </Text>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
