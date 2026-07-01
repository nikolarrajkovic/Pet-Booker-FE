import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import DatePicker from '../../../components/shared/DatePicker';
import type { Promotion, PromotionType, PromotionStatus } from '../components';
import {
  updateServiceDiscount,
  deleteServiceDiscount,
  DiscountType,
} from '../../../services/service-discounts';
import { getErrorMessage } from '../../../services/http';

const TYPE_META: Record<PromotionType, { label: string; iconBg: string; icon: React.ReactNode }> = {
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
  active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  paused: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Paused' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Scheduled' },
  ended: { bg: 'bg-red-100', text: 'text-red-600', label: 'Ended' },
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

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

// Prefer the ISO field (real offers), else best-effort parse the display string (mock entries).
function parseInitialDate(iso: string | null | undefined, fallbackStr: string): Date | null {
  for (const candidate of [iso, fallbackStr]) {
    if (candidate) {
      const d = new Date(candidate);
      if (!isNaN(d.getTime())) return startOfDay(d);
    }
  }
  return null;
}

export default function EditPromotionScreen({ route }: EditPromotionScreenProps) {
  const navigation = useNavigation();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor, inputBg } = useThemeColors();
  const { showError } = useToast();

  const promotion = route?.params?.promotion ?? FALLBACK;
  const meta = TYPE_META[promotion.type];
  const statusStyle = STATUS_STYLES[promotion.status];
  const isScheduled = promotion.status === 'scheduled';

  // Parse date range into start / end for the display-string fallback path
  const [startStr, endStr] = promotion.dateRange.includes(' - ')
    ? promotion.dateRange.split(' - ')
    : [promotion.dateRange, ''];

  const [name, setName] = useState(promotion.title);
  const [startDate, setStartDate] = useState<Date | null>(
    parseInitialDate(promotion.applyFrom, startStr)
  );
  const [endDate, setEndDate] = useState<Date | null>(parseInitialDate(promotion.applyTo, endStr));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [budget, setBudget] = useState(String(promotion.budgetTotal ?? ''));
  const [discountType, setDiscountType] = useState<number>(
    promotion.discountType ?? DiscountType.Percent
  );
  const [discount, setDiscount] = useState(
    String(promotion.discountValue ?? promotion.discountPercent ?? '')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPercent = discountType === DiscountType.Percent;

  // Real 'offer' promotions are backed by a ServiceDiscount; others are mock-only.
  const isBackedOffer =
    promotion.type === 'offer' && promotion.discountId != null && promotion.serviceId != null;

  const handleSave = async () => {
    if (!isBackedOffer) {
      navigation.goBack();
      return;
    } // boost/featured: mock, no persistence
    const val = parseFloat(discount) || 0;
    if (val <= 0) {
      Alert.alert('Enter an amount', 'The discount amount must be greater than zero.');
      return;
    }
    if (isPercent && val > 100) {
      Alert.alert('Invalid percentage', 'A percentage discount cannot exceed 100%.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      Alert.alert('Invalid dates', 'The end date must be on or after the start date.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateServiceDiscount(promotion.discountId!, {
        id: promotion.discountId!,
        serviceId: promotion.serviceId!,
        type: discountType,
        amount: val,
        percentAmount: isPercent ? val : null,
        applyFrom: (startDate ?? new Date()).toISOString(),
        applyTo: endDate ? endDate.toISOString() : null,
        isEnabled: promotion.status === 'active',
      });
      navigation.goBack();
    } catch (e) {
      showError(getErrorMessage(e, 'Could not save the promotion. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!isBackedOffer) {
      navigation.goBack();
      return;
    }
    Alert.alert('Delete promotion?', 'This permanently removes the discount.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsSubmitting(true);
          try {
            await deleteServiceDiscount(promotion.discountId!);
            navigation.goBack();
          } catch (e) {
            showError(getErrorMessage(e, 'Could not delete the promotion. Please try again.'));
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const labelColor = isDarkMode ? 'text-gray-300' : 'text-gray-700';

  const inputStyle = `${inputBg} border ${borderColor} rounded-xl px-4 py-3.5 text-sm ${textColor}`;
  const dateField = `${inputBg} border ${borderColor} rounded-xl px-4 py-3.5 flex-row items-center justify-between`;

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
          className="h-10 w-10 items-center justify-center rounded-full bg-white/20">
          <Ionicons name="bar-chart-outline" size={18} color="white" />
        </TouchableOpacity>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Promotion type banner */}
        <View
          className={`${cardBg} mb-5 rounded-2xl border p-4 ${borderColor} flex-row items-center`}>
          <View className={`h-11 w-11 rounded-xl ${meta.iconBg} mr-3 items-center justify-center`}>
            {meta.icon}
          </View>
          <View className="flex-1">
            <Text className={`text-xs ${subtextColor}`}>Promotion Type</Text>
            <Text className={`text-base font-bold ${textColor}`}>{meta.label}</Text>
          </View>
          <View className={`rounded-full px-2.5 py-1 ${statusStyle.bg}`}>
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
        <View className="mb-2 flex-row gap-3">
          <View className="flex-1">
            <Text className={`text-xs ${subtextColor} mb-1.5`}>Start Date</Text>
            <TouchableOpacity
              className={dateField}
              activeOpacity={0.75}
              onPress={() => setShowStartPicker((v) => !v)}>
              <Text className={`text-sm ${startDate ? textColor : subtextColor}`}>
                {startDate ? fmtDate(startDate) : 'Select date'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <View className="flex-1">
            <Text className={`text-xs ${subtextColor} mb-1.5`}>End Date</Text>
            <TouchableOpacity
              className={dateField}
              activeOpacity={0.75}
              onPress={() => setShowEndPicker((v) => !v)}>
              <Text className={`text-sm ${endDate ? textColor : subtextColor}`}>
                {endDate ? fmtDate(endDate) : 'No end date'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
        {endDate && (
          <TouchableOpacity
            onPress={() => setEndDate(null)}
            activeOpacity={0.7}
            className="mb-5 self-start">
            <Text className="text-xs font-semibold text-brand-600">
              Clear end date (open-ended)
            </Text>
          </TouchableOpacity>
        )}
        {!endDate && <View className="mb-5" />}

        {showStartPicker && (
          <DatePicker
            value={startDate ?? new Date()}
            isDarkMode={isDarkMode}
            onChange={(date) => {
              if (date) {
                const d = startOfDay(date);
                setStartDate(d);
                if (endDate && endDate < d) setEndDate(null);
              }
              setShowStartPicker(false);
            }}
            onClose={() => setShowStartPicker(false)}
          />
        )}
        {showEndPicker && (
          <DatePicker
            value={endDate ?? startDate ?? new Date()}
            minDate={startDate ?? undefined}
            isDarkMode={isDarkMode}
            onChange={(date) => {
              if (date) setEndDate(startOfDay(date));
              setShowEndPicker(false);
            }}
            onClose={() => setShowEndPicker(false)}
          />
        )}

        {/* Budget — Boost only */}
        {promotion.type === 'boost' && (
          <>
            <Text className={`text-sm font-semibold ${labelColor} mb-2`}>Budget</Text>
            <View
              className={`${inputBg} border ${borderColor} mb-1 flex-row items-center rounded-xl px-4`}>
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
            <Text className={`text-sm font-semibold ${labelColor} mb-2`}>Discount Type</Text>
            <View
              className={`mb-4 flex-row rounded-xl p-1 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
              {[
                { type: DiscountType.Percent, label: 'Percentage', icon: 'percent' as const },
                { type: DiscountType.Fixed, label: 'Fixed Amount', icon: 'currency-usd' as const },
              ].map((opt) => {
                const active = discountType === opt.type;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    activeOpacity={0.8}
                    onPress={() => setDiscountType(opt.type)}
                    className={`flex-1 flex-row items-center justify-center rounded-lg py-2.5 ${active ? 'bg-brand-500' : ''}`}>
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={16}
                      color={active ? 'white' : '#9CA3AF'}
                    />
                    <Text
                      className={`ml-1.5 text-sm font-semibold ${active ? 'text-white' : subtextColor}`}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className={`text-sm font-semibold ${labelColor} mb-2`}>
              {isPercent ? 'Discount Percentage' : 'Discount Amount'}
            </Text>
            <View
              className={`${inputBg} border ${borderColor} mb-5 flex-row items-center rounded-xl px-4`}>
              {!isPercent && (
                <Text className={`text-sm font-semibold ${subtextColor} mr-1`}>$</Text>
              )}
              <TextInput
                className={`flex-1 py-3.5 text-sm ${textColor}`}
                value={discount}
                onChangeText={setDiscount}
                keyboardType="numeric"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
              {isPercent && <Text className={`text-sm font-semibold ${subtextColor}`}>%</Text>}
            </View>
          </>
        )}

        {/* Save Changes */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSubmitting}
          activeOpacity={0.8}
          className="mb-3 items-center rounded-2xl bg-brand-500 py-4"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Pause — only for active/paused (not scheduled) */}
        {!isScheduled && (
          <TouchableOpacity
            activeOpacity={0.8}
            className={`mb-3 flex-row items-center justify-center rounded-2xl py-4 ${isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
            <Ionicons name="pause" size={16} color="#D97706" style={{ marginRight: 8 }} />
            <Text className="text-base font-semibold text-yellow-600">Pause Promotion</Text>
          </TouchableOpacity>
        )}

        {/* Delete */}
        <TouchableOpacity
          onPress={handleDelete}
          disabled={isSubmitting}
          activeOpacity={0.8}
          className={`items-center rounded-2xl py-4 ${isDarkMode ? 'bg-red-900/20' : 'bg-red-50'}`}>
          <Text className="text-base font-semibold text-red-500">Delete Promotion</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}
