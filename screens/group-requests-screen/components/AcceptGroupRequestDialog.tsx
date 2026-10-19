import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { formatMoney } from '../../../services/currency';
import type { GroupBookingRequestDto } from '../../../services/group-booking-requests';
import { parseBookingDate } from '../../../services/bookings';
import { formatRequestWhen } from '../groupRequestFormat';

type Props = {
  request: GroupBookingRequestDto | null;
  onClose: () => void;
  /** `startInMinutes` only for an ASAP request: how soon the provider can be there. */
  onConfirm: (
    serviceId: number,
    pricingOptionId: number | null,
    startInMinutes: number | null
  ) => void;
};

/** "I can be there in…" — the offers an ASAP request's accept takes (the server allows 0–180). */
const START_IN_CHOICES = [0, 15, 30, 45, 60, 90, 120, 180];

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
  const [startIn, setStartIn] = useState<number | null>(null);

  useEffect(() => {
    const preselected = services.find((s) => s.isPreselected) ?? services[0];
    setServiceId(preselected?.serviceId ?? null);
    setOptionId(null);
    setStartIn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  const chosen = services.find((s) => s.serviceId === serviceId);
  const needsOption = (chosen?.pricingOptions.length ?? 0) > 0;
  // The server starts it at the next whole minute plus the offer (AcceptedWindow) — say the same.
  const startAt = (minutes: number) => {
    const next = new Date();
    if (next.getSeconds() > 0 || next.getMilliseconds() > 0) {
      next.setSeconds(0, 0);
      next.setMinutes(next.getMinutes() + 1);
    }
    return new Date(next.getTime() + minutes * 60000);
  };
  // An ASAP request has no start yet: the provider says how soon they can be there, no later than
  // the owner's deadline (which is the request's own "open until").
  const asap = !!request?.isAsap && !!request.activeUntil;
  const deadline = asap ? parseBookingDate(request!.activeUntil!).getTime() : 0;
  const startChoices = asap ? START_IN_CHOICES.filter((m) => startAt(m).getTime() <= deadline) : [];
  const clock = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const ready = chosen != null && (!needsOption || optionId != null) && (!asap || startIn != null);

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
      // react-native-web 0.21 reads aria-* (accessibilityState alone never reaches the DOM).
      aria-checked={active}
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
          <Text className={`mb-4 text-sm ${subtextColor}`}>{formatRequestWhen(t, request)}</Text>
        )}
        <ScrollView style={{ maxHeight: 380 }}>
          {asap ? (
            <View className="mb-4">
              <Text className={`mb-2 text-sm font-semibold ${textColor}`}>
                {t('groupRequest.startInTitle')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {startChoices.map((m) => {
                  const active = startIn === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                      onPress={() => setStartIn(m)}
                      className={`rounded-full border px-3 py-2 ${
                        active
                          ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                          : `${borderColor} ${cardBg}`
                      }`}>
                      <Text
                        className={`text-sm ${active ? 'font-semibold text-brand-600' : subtextColor}`}>
                        {m === 0
                          ? t('groupRequest.startNow')
                          : t('groupRequest.startInMin', { n: m })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {startIn != null ? (
                <Text className="mt-2 text-xs font-medium text-brand-600">
                  {t('groupRequest.startsAt', { time: clock(startAt(startIn)) })}
                </Text>
              ) : null}
            </View>
          ) : null}
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
            onPress={() =>
              chosen &&
              onConfirm(chosen.serviceId, needsOption ? optionId : null, asap ? startIn : null)
            }
            className={`flex-1 items-center rounded-xl py-3 ${ready ? 'bg-brand-500' : 'bg-gray-300'}`}>
            <Text className="font-semibold text-white">{t('groupRequest.acceptConfirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModal>
  );
}
