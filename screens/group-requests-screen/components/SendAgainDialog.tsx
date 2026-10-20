import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { parseBookingDate } from '../../../services/bookings';
import {
  GroupBookingAudience,
  REQUEST_DISTANCES_KM,
  type GroupBookingRequestDto,
} from '../../../services/group-booking-requests';
import { formatLength } from '../groupRequestFormat';

type Props = {
  /** The expired "as soon as possible" request to send again; null hides the dialog. */
  request: GroupBookingRequestDto | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (openForMinutes: number, maxDistanceKm: number | null) => void;
};

/** How long the new request stays open, in minutes (the server allows 15 min – 12 h). */
const OPEN_FOR = [30, 60, 120, 240];

/**
 * "Send again" for an "as soon as possible" request that closed with nobody accepting it: the same
 * pet, place and providers, open for a while and, when it went to every matching provider, as far
 * as the owner now wants. Defaults lean one step wider than last time, since last time was too narrow.
 */
export default function SendAgainDialog({ request, busy, onClose, onConfirm }: Props) {
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const [openFor, setOpenFor] = useState(60);
  const [distance, setDistance] = useState<number | null>(null);
  const anyMatching = request?.audience === GroupBookingAudience.AnyEligible;

  useEffect(() => {
    if (!request) return;
    const was =
      request.activeUntil != null
        ? Math.round(
            (parseBookingDate(request.activeUntil).getTime() -
              parseBookingDate(request.bookingFrom).getTime()) /
              60000
          )
        : 60;
    setOpenFor(OPEN_FOR.find((m) => m > was) ?? OPEN_FOR[OPEN_FOR.length - 1]);
    const km = request.maxDistanceKm ?? null;
    const steps: number[] = REQUEST_DISTANCES_KM.flatMap((d) => (d == null ? [] : [d]));
    setDistance(km == null ? null : (steps.find((d) => d > km) ?? null));
  }, [request]);

  const chip = (active: boolean, text: string, onPress: () => void, key: string) => (
    <TouchableOpacity
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      // react-native-web 0.21 reads aria-* (accessibilityState alone never reaches the DOM).
      aria-checked={active}
      onPress={onPress}
      className={`rounded-full border px-3 py-2 ${
        active
          ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
          : `${borderColor} ${cardBg}`
      }`}>
      <Text className={`text-sm ${active ? 'font-semibold text-brand-600' : subtextColor}`}>
        {text}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ResponsiveModal
      visible={request != null}
      onClose={onClose}
      mobilePresentation="centered"
      dialogWidth={480}>
      <View className={`${cardBg} p-5`}>
        <Text className={`mb-1 text-lg font-bold ${textColor}`}>
          {t('groupRequest.sendAgainTitle')}
        </Text>
        <Text className={`mb-4 text-sm ${subtextColor}`}>{t('groupRequest.sendAgainBody')}</Text>

        <Text className={`mb-2 text-sm font-semibold ${textColor}`}>
          {t('groupRequest.asapOpenFor')}
        </Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {OPEN_FOR.map((m) =>
            chip(openFor === m, formatLength(t, m), () => setOpenFor(m), `open-${m}`)
          )}
        </View>

        {anyMatching ? (
          <>
            <Text className={`mb-2 text-sm font-semibold ${textColor}`}>
              {t('groupRequest.distanceTitle')}
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {REQUEST_DISTANCES_KM.map((km) =>
                chip(
                  distance === km,
                  km == null ? t('groupRequest.distanceAny') : t('groupRequest.distanceKm', { km }),
                  () => setDistance(km),
                  `km-${km ?? 'any'}`
                )
              )}
            </View>
          </>
        ) : null}

        <View className="mt-2 flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
            <Text className={`font-semibold ${textColor}`}>{t('requests.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onConfirm(openFor, anyMatching ? distance : null)}
            className="flex-1 items-center rounded-xl bg-brand-500 py-3">
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">{t('groupRequest.sendAgain')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModal>
  );
}
