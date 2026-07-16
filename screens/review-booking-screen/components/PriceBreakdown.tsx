import React from 'react';
import { View, Text } from 'react-native';
import { useLocale } from '../../../context/LocaleContext';

interface AddonLine {
  name: string;
  price: number;
}

// A discount line shown between the (whole) service price and the add-ons.
// `label` states the discount type (e.g. "Discount (20% off)"); `amount` is the
// positive amount subtracted, rendered as a negative line.
interface DiscountLine {
  label: string;
  amount: number;
}

interface PriceBreakdownProps {
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  // The FULL (pre-discount) service total. When `discount` is set, the discount
  // is subtracted on its own line so the breakdown shows whole values first.
  serviceTotal: number;
  discount?: DiscountLine | null;
  addons: AddonLine[];
  total: number;
}

// Trim float artifacts from price subtraction (e.g. 9.999999 → 10) for display.
const money = (n: number) => Math.round(n * 100) / 100;

export default function PriceBreakdown({
  isDarkMode,
  textColor,
  subtextColor,
  borderColor,
  serviceTotal,
  discount,
  addons,
  total,
}: PriceBreakdownProps) {
  const { t } = useLocale();
  return (
    <View className={`border-t px-6 py-5 ${borderColor}`}>
      <Text className={`text-base font-semibold ${textColor} mb-4`}>
        {t('reviewBooking.priceBreakdown')}
      </Text>
      <View className="mb-3 flex-row justify-between">
        <Text className={`text-sm ${subtextColor}`}>{t('reviewBooking.serviceLine')}</Text>
        <Text className={`text-sm ${textColor}`}>${money(serviceTotal)}</Text>
      </View>
      {discount && discount.amount > 0 && (
        <View className="mb-3 flex-row justify-between">
          <Text className="text-sm text-brand-600">{discount.label}</Text>
          <Text className="text-sm text-brand-600">−${money(discount.amount)}</Text>
        </View>
      )}
      {addons.map((addon) => (
        <View key={addon.name} className="mb-3 flex-row justify-between">
          <Text className={`text-sm ${subtextColor}`}>{addon.name}</Text>
          <Text className={`text-sm ${textColor}`}>${money(addon.price)}</Text>
        </View>
      ))}
      <View className={`border-t ${borderColor} mt-3 flex-row justify-between pt-3`}>
        <Text className={`text-base font-bold ${textColor}`}>{t('reviewBooking.total')}</Text>
        <Text className="text-2xl font-bold text-brand-600">${money(total)}</Text>
      </View>
    </View>
  );
}
