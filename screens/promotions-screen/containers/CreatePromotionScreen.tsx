import React, { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import DatePicker from '../../../components/shared/DatePicker';
import { getServices, ServiceDto } from '../../../services/services';
import { getErrorMessage } from '../../../services/http';
import { createServiceDiscount, DiscountType } from '../../../services/service-discounts';

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function CreatePromotionScreen() {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor, inputBg } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();

  const [services, setServices] = useState<ServiceDto[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  const [serviceId, setServiceId] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<number>(DiscountType.Percent);
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const providerId = currentUser?.serviceProviderId || null;
  const isPercent = discountType === DiscountType.Percent;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!providerId) {
        setIsLoadingServices(false);
        return;
      }
      try {
        const list = await getServices({ serviceProviderId: providerId });
        if (!cancelled) setServices(list);
      } catch (e) {
        if (!cancelled) showError(getErrorMessage(e, t('promotions.servicesLoadFailed')));
      } finally {
        if (!cancelled) setIsLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const amountNum = useMemo(() => parseFloat(amount), [amount]);
  const canSubmit =
    serviceId != null &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    (!isPercent || amountNum <= 100) &&
    (!endDate || endDate >= startDate);

  const handleCreate = async () => {
    if (serviceId == null) {
      Alert.alert(t('promotions.pickServiceTitle'), t('promotions.pickServiceMsg'));
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert(t('promotions.enterAmountTitle'), t('promotions.enterAmountMsg'));
      return;
    }
    if (isPercent && amountNum > 100) {
      Alert.alert(t('promotions.invalidPctTitle'), t('promotions.invalidPctMsg'));
      return;
    }
    if (endDate && endDate < startDate) {
      Alert.alert(t('promotions.invalidDatesTitle'), t('promotions.invalidDatesMsg'));
      return;
    }

    setIsSubmitting(true);
    try {
      await createServiceDiscount({
        serviceId,
        type: discountType,
        amount: amountNum,
        percentAmount: isPercent ? amountNum : null,
        applyFrom: startDate.toISOString(),
        applyTo: endDate ? endDate.toISOString() : null,
        isEnabled: true,
      });
      navigation.goBack();
    } catch (e) {
      showError(getErrorMessage(e, t('promotions.createFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const labelColor = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const dateField = `${inputBg} border ${borderColor} rounded-xl px-4 py-3.5 flex-row items-center justify-between`;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('promotions.createTitle')}
      headerSubtitle={t('promotions.createSubtitle')}
      contentBg={contentBg}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Intro banner */}
        <View
          className={`${cardBg} mb-5 rounded-2xl border p-4 ${borderColor} flex-row items-center`}>
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-green-100">
            <MaterialCommunityIcons name="gift-outline" size={22} color="#16A34A" />
          </View>
          <View className="flex-1">
            <Text className={`text-base font-bold ${textColor}`}>
              {t('promotions.specialOffer')}
            </Text>
            <Text className={`text-xs ${subtextColor} mt-0.5`}>
              {t('promotions.specialOfferText')}
            </Text>
          </View>
        </View>

        {/* Service selector */}
        <Text className={`text-sm font-semibold ${labelColor} mb-2`}>
          {t('promotions.service')}
        </Text>
        {isLoadingServices ? (
          <View className={`${cardBg} mb-5 rounded-xl border p-6 ${borderColor} items-center`}>
            <ActivityIndicator color="#00C870" />
          </View>
        ) : services.length === 0 ? (
          <View className={`${cardBg} mb-5 rounded-xl border p-5 ${borderColor} items-center`}>
            <Ionicons
              name="briefcase-outline"
              size={28}
              color={isDarkMode ? '#4B5563' : '#9CA3AF'}
            />
            <Text className={`${subtextColor} mt-2 text-center text-sm`}>
              {t('promotions.noServicesYet')}
            </Text>
          </View>
        ) : (
          <View className="mb-5">
            {services.map((s) => {
              const selected = serviceId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  activeOpacity={0.75}
                  onPress={() => setServiceId(s.id ?? null)}
                  className={`mb-2 flex-row items-center rounded-xl border px-4 py-3.5 ${
                    selected ? 'border-brand-500 bg-brand-50' : `${borderColor} ${cardBg}`
                  }`}>
                  <View
                    className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-brand-500 bg-brand-500' : 'border-gray-400'
                    }`}>
                    {selected && <Ionicons name="checkmark" size={12} color="white" />}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-sm font-semibold ${selected ? 'text-brand-700' : textColor}`}>
                      {s.name ?? t('promotions.service')}
                    </Text>
                    {s.pricing?.basePrice != null && (
                      <Text className={`text-xs ${subtextColor} mt-0.5`}>
                        {t('promotions.basePrice', { price: s.pricing.basePrice })}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Discount type toggle */}
        <Text className={`text-sm font-semibold ${labelColor} mb-2`}>
          {t('promotions.discountTypeLabel')}
        </Text>
        <View
          className={`mb-5 flex-row rounded-xl p-1 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
          {[
            {
              type: DiscountType.Percent,
              label: t('promotions.percentage'),
              icon: 'percent' as const,
            },
            {
              type: DiscountType.Fixed,
              label: t('promotions.fixedAmount'),
              icon: 'currency-usd' as const,
            },
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

        {/* Amount */}
        <Text className={`text-sm font-semibold ${labelColor} mb-2`}>
          {isPercent ? t('promotions.discountPercentage') : t('promotions.discountAmount')}
        </Text>
        <View
          className={`${inputBg} border ${borderColor} mb-5 flex-row items-center rounded-xl px-4`}>
          {!isPercent && <Text className={`text-sm font-semibold ${subtextColor} mr-1`}>$</Text>}
          <TextInput
            className={`flex-1 py-3.5 text-sm ${textColor}`}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder={isPercent ? 'e.g. 20' : 'e.g. 10'}
            placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
          />
          {isPercent && <Text className={`text-sm font-semibold ${subtextColor}`}>%</Text>}
        </View>

        {/* Date range */}
        <Text className={`text-sm font-semibold ${labelColor} mb-2`}>
          {t('promotions.activePeriod')}
        </Text>
        <View className="mb-2 flex-row gap-3">
          <View className="flex-1">
            <Text className={`text-xs ${subtextColor} mb-1.5`}>{t('promotions.startDate')}</Text>
            <TouchableOpacity
              className={dateField}
              activeOpacity={0.75}
              onPress={() => setShowStartPicker((v) => !v)}>
              <Text className={`text-sm ${textColor}`}>{fmtDate(startDate)}</Text>
              <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <View className="flex-1">
            <Text className={`text-xs ${subtextColor} mb-1.5`}>{t('promotions.endDate')}</Text>
            <TouchableOpacity
              className={dateField}
              activeOpacity={0.75}
              onPress={() => setShowEndPicker((v) => !v)}>
              <Text className={`text-sm ${endDate ? textColor : subtextColor}`}>
                {endDate ? fmtDate(endDate) : t('promotions.noEndDate')}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
        {endDate && (
          <TouchableOpacity
            onPress={() => setEndDate(null)}
            activeOpacity={0.7}
            className="mb-2 self-start">
            <Text className="text-xs font-semibold text-brand-600">
              {t('promotions.clearEndDate')}
            </Text>
          </TouchableOpacity>
        )}

        {showStartPicker && (
          <DatePicker
            value={startDate}
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
            value={endDate ?? startDate}
            minDate={startDate}
            isDarkMode={isDarkMode}
            onChange={(date) => {
              if (date) setEndDate(startOfDay(date));
              setShowEndPicker(false);
            }}
            onClose={() => setShowEndPicker(false)}
          />
        )}

        {/* Create */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={isSubmitting || !canSubmit}
          activeOpacity={0.8}
          className="mt-4 items-center rounded-2xl bg-brand-500 py-4"
          style={{ opacity: isSubmitting || !canSubmit ? 0.6 : 1 }}>
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-bold text-white">{t('promotions.createOffer')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}
