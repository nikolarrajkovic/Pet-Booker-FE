import React from 'react';
import { View, Text } from 'react-native';
import { useLocale } from '../../../context/LocaleContext';

// Aggregated distance-pricing components behind a location add-on's total,
// summed across appointments (see ReviewBookingScreen). Present only for
// per-km pickup/drop-off add-ons; drives the itemized sub-lines.
export interface AddonBreakdown {
  baseFee: number; // start fee (× count when >1 appointment)
  distanceCharge: number; // gross per-km charge (perKmFee × billed km)
  freeDiscount: number; // credit removed by the free distance
  cappedKm: number; // total distance charged per-km (after max cap)
  freeKm: number; // total free distance applied
  perKmFee: number; // the per-km rate (constant for a given add-on)
  count: number; // how many appointments contributed
}

export interface AddonLine {
  name: string;
  price: number;
  breakdown?: AddonBreakdown;
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
// Distance to at most 2 decimals, no trailing zeros (3.4 km, 1 km, 2.42 km).
const km2 = (n: number) => String(Math.round(n * 100) / 100);

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
        <View key={addon.name} className="mb-3">
          <View className="flex-row justify-between">
            <Text className={`text-sm ${subtextColor}`}>{addon.name}</Text>
            <Text className={`text-sm ${textColor}`}>${money(addon.price)}</Text>
          </View>
          {/* Distance-pricing sub-lines: start fee + per-km charge − free-km credit. */}
          {addon.breakdown && (
            <View className={`mt-1.5 border-l pl-3 ${borderColor} ml-1`}>
              <View className="mb-1 flex-row justify-between">
                <Text className={`text-xs ${subtextColor}`}>
                  {t('reviewBooking.addonStartFee')}
                  {addon.breakdown.count > 1 ? ` (×${addon.breakdown.count})` : ''}
                </Text>
                <Text className={`text-xs ${subtextColor}`}>${money(addon.breakdown.baseFee)}</Text>
              </View>
              {addon.breakdown.distanceCharge > 0 && (
                <View className="mb-1 flex-row justify-between">
                  <Text className={`text-xs ${subtextColor} flex-1 pr-2`}>
                    {t('reviewBooking.addonDistance', {
                      km: km2(addon.breakdown.cappedKm),
                      rate: `$${money(addon.breakdown.perKmFee)}`,
                    })}
                  </Text>
                  <Text className={`text-xs ${subtextColor}`}>
                    ${money(addon.breakdown.distanceCharge)}
                  </Text>
                </View>
              )}
              {addon.breakdown.freeDiscount > 0 && (
                <View className="mb-1 flex-row justify-between">
                  <Text className="flex-1 pr-2 text-xs text-brand-600">
                    {t('reviewBooking.addonFreeDistance', { km: km2(addon.breakdown.freeKm) })}
                  </Text>
                  <Text className="text-xs text-brand-600">
                    −${money(addon.breakdown.freeDiscount)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      ))}
      <View className={`border-t ${borderColor} mt-3 flex-row justify-between pt-3`}>
        <Text className={`text-base font-bold ${textColor}`}>{t('reviewBooking.total')}</Text>
        <Text className="text-2xl font-bold text-brand-600">${money(total)}</Text>
      </View>
    </View>
  );
}
