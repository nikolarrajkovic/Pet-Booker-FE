import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { formatMoney } from '../../../services/currency';
import type { GroupBookingRequestDto } from '../../../services/group-booking-requests';
import { formatRequestWindow } from '../groupRequestFormat';

type Props = {
  request: GroupBookingRequestDto | null;
  onClose: () => void;
  onConfirm: (serviceId: number, pricingOptionId: number | null) => void;
};

/**
 * "Accept with which service?" — the provider's own services that fit the request (the server
 * lists exactly the ones its accept gate will take), preselecting the one the owner picked them
 * from. A service that prices by duration needs one picked; the booking's end then follows it.
 * Accepting is first come, first served and creates a confirmed booking, so the dialog says so.
 */
export default function AcceptGroupRequestDialog({ request, onClose, onConfirm }: Props) {
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const services = request?.myEligibleServices ?? [];
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [optionId, setOptionId] = useState<number | null>(null);

  useEffect(() => {
    const preselected = services.find((s) => s.isPreselected) ?? services[0];
    setServiceId(preselected?.serviceId ?? null);
    setOptionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  const chosen = services.find((s) => s.serviceId === serviceId);
  const needsOption = (chosen?.pricingOptions.length ?? 0) > 0;
  const ready = chosen != null && (!needsOption || optionId != null);

  const choice = (
    active: boolean,
    onPress: () => void,
    title: string,
    sub: string,
    price: string
  ) => (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      className={`mb-2 flex-row items-center rounded-2xl border-2 p-3 ${
        active
          ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
          : `${borderColor} ${cardBg}`
      }`}>
      <Ionicons
        name={active ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={BRAND_GREEN}
      />
      <View className="ml-3 flex-1">
        <Text className={`text-sm font-semibold ${textColor}`}>{title}</Text>
        {sub ? <Text className={`text-xs ${subtextColor}`}>{sub}</Text> : null}
      </View>
      <Text className="ml-2 text-sm font-bold text-brand-600">{price}</Text>
    </TouchableOpacity>
  );

  return (
    <ResponsiveModal
      visible={request != null}
      onClose={onClose}
      mobilePresentation="centered"
      dialogWidth={520}>
      <View className={`${cardBg} p-5`}>
        <Text className={`mb-1 text-lg font-bold ${textColor}`}>
          {t('groupRequest.acceptTitle')}
        </Text>
        {request && (
          <Text className={`mb-4 text-sm ${subtextColor}`}>
            {formatRequestWindow(t, request.bookingFrom, request.bookingTo)}
          </Text>
        )}
        <ScrollView style={{ maxHeight: 380 }}>
          <Text className={`mb-2 text-sm font-semibold ${textColor}`}>
            {t('groupRequest.withService')}
          </Text>
          {services.map((s) =>
            choice(
              s.serviceId === serviceId,
              () => {
                setServiceId(s.serviceId);
                setOptionId(null);
              },
              s.name,
              s.isPreselected ? t('groupRequest.pickedByOwner') : '',
              formatMoney(s.price, s.currency)
            )
          )}
          {needsOption && (
            <>
              <Text className={`mb-2 mt-3 text-sm font-semibold ${textColor}`}>
                {t('bookService.chooseDuration')}
              </Text>
              {chosen!.pricingOptions.map((o) =>
                choice(
                  o.id === optionId,
                  () => setOptionId(o.id),
                  o.name,
                  t('durations.nMin', { n: o.durationMinutes }),
                  formatMoney(o.price, chosen!.currency)
                )
              )}
            </>
          )}
        </ScrollView>
        <Text className={`mb-4 mt-3 text-xs ${subtextColor}`}>{t('groupRequest.acceptNote')}</Text>
        <View className="flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
            <Text className={`font-semibold ${textColor}`}>{t('requests.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!ready}
            onPress={() => chosen && onConfirm(chosen.serviceId, needsOption ? optionId : null)}
            className={`flex-1 items-center rounded-xl py-3 ${ready ? 'bg-brand-500' : 'bg-gray-300'}`}>
            <Text className="font-semibold text-white">{t('groupRequest.acceptConfirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModal>
  );
}
