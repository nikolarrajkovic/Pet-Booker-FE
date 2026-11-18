import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '../../../components/shared/ResponsiveModal';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { useResource } from '../../../hooks/useResource';
import { getServiceAvailability } from '../../../services/services';
import { formatBookingDate, parseBookingDate } from '../../../services/bookings';
import { formatShortDate } from '../../../i18n/dates';
import {
  daySegments,
  roomIn,
  startCandidates,
  stayRoom,
  stayStartCandidates,
} from '../../book-service-screen/slotMath';

const DAY_MINUTES = 24 * 60;
const DAY_MS = DAY_MINUTES * 60_000;
/** The availability endpoint answers at most a month at a time. */
const DAYS_AHEAD = 30;
const STEP_MINUTES = 30;

type Props = {
  visible: boolean;
  serviceId: number;
  /** The booking's current window (wall-clock ISO strings); its length is kept. */
  bookingFrom: string;
  bookingTo: string;
  submitting?: boolean;
  /** True when the change applies at once (the customer's own request not answered yet). */
  appliesAtOnce?: boolean;
  onClose: () => void;
  onSubmit: (newFrom: string) => void;
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Picks a new start for a booking, keeping its length (app review 2026-11-13, finding 28): the
 * days of the next month the service works, then the free starts on the chosen day, from the same
 * availability the booking form reads. The booking's own time counts as free for itself.
 */
export default function ChangeTimeModal({
  visible,
  serviceId,
  bookingFrom,
  bookingTo,
  submitting = false,
  appliesAtOnce = false,
  onClose,
  onSubmit,
}: Props) {
  const { cardBg, textColor, subtextColor, borderColor, isDarkMode } = useThemeColors();
  const { t } = useLocale();

  const current = parseBookingDate(bookingFrom);
  const lengthMinutes = Math.max(
    1,
    Math.round((parseBookingDate(bookingTo).getTime() - current.getTime()) / 60_000)
  );
  const isStay = lengthMinutes >= DAY_MINUTES;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const rangeFrom = ymd(today);
  const rangeTo = ymd(new Date(today.getTime() + DAYS_AHEAD * DAY_MS));
  const { data: availability, isLoading } = useResource(
    ['services', serviceId, 'availability', rangeFrom, rangeTo],
    () => getServiceAvailability(serviceId, rangeFrom, rangeTo),
    { enabled: visible }
  );

  const [date, setDate] = useState<string | null>(null);
  const [startMin, setStartMin] = useState<number | null>(null);
  useEffect(() => {
    if (visible) {
      setDate(null);
      setStartMin(null);
    }
  }, [visible]);

  const windowsOn = (key: string) => availability?.days.find((d) => d.date === key)?.windows ?? [];
  const dayKeys = (availability?.days ?? [])
    .filter((d) => d.windows.some((w) => w.remainingCapacity > 0))
    .map((d) => d.date);

  // The booking holds its own place; moving it within that time must not read as "full".
  const ownStart = current.getTime();
  const ownEnd = ownStart + lengthMinutes * 60_000;
  const startsOn = (key: string): number[] => {
    const dayStart = new Date(`${key}T00:00:00`).getTime();
    const next = ymd(new Date(dayStart + DAY_MS));
    const segments = daySegments(windowsOn(key), windowsOn(next));
    const candidates = isStay
      ? stayStartCandidates(segments, STEP_MINUTES)
      : startCandidates(segments, lengthMinutes, STEP_MINUTES);
    const now = Date.now();
    return candidates.filter((m) => {
      const at = dayStart + m * 60_000;
      if (at <= now || at === ownStart) return false;
      const overlapsOwn = at < ownEnd && at + lengthMinutes * 60_000 > ownStart;
      const room = isStay
        ? stayRoom(
            Array.from({ length: Math.floor((m + lengthMinutes) / DAY_MINUTES) + 1 }, (_, i) =>
              windowsOn(ymd(new Date(dayStart + i * DAY_MS)))
            ),
            m,
            lengthMinutes
          )
        : roomIn(segments, m, m + lengthMinutes);
      return room != null && room + (overlapsOwn ? 1 : 0) > 0;
    });
  };
  const starts = date ? startsOn(date) : [];

  const submit = () => {
    if (!date || startMin == null) return;
    const at = new Date(new Date(`${date}T00:00:00`).getTime() + startMin * 60_000);
    onSubmit(formatBookingDate(at));
  };

  const chip = (selected: boolean) =>
    `mb-2 mr-2 rounded-full border px-3 py-2 ${
      selected
        ? 'border-brand-500 bg-brand-500'
        : `${borderColor} ${isDarkMode ? 'bg-[#1E2A3A]' : 'bg-white'}`
    }`;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      mobilePresentation="centered"
      dismissOnBackdropPress={false}
      dialogWidth={520}>
      <View className={`${cardBg} p-5`} style={{ maxHeight: 640 }}>
        <Text className={`text-lg font-bold ${textColor} mb-1`}>{t('changeTime.title')}</Text>
        <Text className={`text-sm ${subtextColor} mb-4`}>
          {appliesAtOnce ? t('changeTime.subtitleAtOnce') : t('changeTime.subtitle')}
        </Text>
        {isLoading ? (
          <ActivityIndicator color={BRAND_GREEN} className="my-8" />
        ) : dayKeys.length === 0 ? (
          <Text className={`text-sm ${subtextColor} my-6 text-center`}>
            {t('changeTime.noDays')}
          </Text>
        ) : (
          <ScrollView style={{ maxHeight: 420 }}>
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>{t('changeTime.day')}</Text>
            <View className="flex-row flex-wrap">
              {dayKeys.map((key) => (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: date === key }}
                  onPress={() => {
                    setDate(key);
                    setStartMin(null);
                  }}
                  className={chip(date === key)}>
                  <Text
                    className={`text-sm ${date === key ? 'font-semibold text-white' : textColor}`}>
                    {formatShortDate(new Date(`${key}T00:00:00`))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {date ? (
              <>
                <Text className={`text-sm font-semibold ${textColor} mb-2 mt-3`}>
                  {t('changeTime.start')}
                </Text>
                {starts.length === 0 ? (
                  <Text className={`text-sm ${subtextColor}`}>{t('changeTime.noStarts')}</Text>
                ) : (
                  <View className="flex-row flex-wrap">
                    {starts.map((m) => (
                      <TouchableOpacity
                        key={m}
                        accessibilityRole="button"
                        accessibilityState={{ selected: startMin === m }}
                        onPress={() => setStartMin(m)}
                        className={chip(startMin === m)}>
                        <Text
                          className={`text-sm ${startMin === m ? 'font-semibold text-white' : textColor}`}>
                          {clock(m)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </ScrollView>
        )}
        <View className="mt-4 flex-row" style={{ gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            disabled={submitting}
            className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
            <Text className={`font-semibold ${textColor}`}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: startMin == null || submitting }}
            onPress={submit}
            disabled={startMin == null || submitting}
            className={`flex-1 items-center rounded-xl bg-brand-500 py-3 ${startMin == null ? 'opacity-50' : ''}`}>
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">
                {appliesAtOnce ? t('changeTime.moveNow') : t('changeTime.ask')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModal>
  );
}
