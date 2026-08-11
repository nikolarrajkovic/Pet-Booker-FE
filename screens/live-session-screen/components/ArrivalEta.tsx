import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
export type ArrivalEtaProps = {
  /** Driving distance of the current route, km. Null while it resolves. */
  km: number | null;
  /**
   * Driving time of the current route, minutes. Null when the route came from
   * the straight-line fallback — a great-circle ETA would be a lie, so the card
   * shows distance only.
   */
  mins: number | null;
  /** When the route was measured — the countdown runs from this instant. */
  computedAt: number | null;
  /** Where the provider is headed ("Drop-off", "Your location", …). */
  destinationLabel?: string;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
};

/** Anything at or under this many minutes out reads as "arriving now". */
const ARRIVING_MINS = 1;

/**
 * Booker-side arrival estimate: how long until the provider reaches the booker's
 * location, derived from the live route (OSRM driving time) that LiveDirectionsMap
 * reports up. The route only re-measures once the provider has moved a meaningful
 * distance, so this ticks the remaining time down locally in between.
 */
export default function ArrivalEta({
  km,
  mins,
  computedAt,
  destinationLabel,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
}: ArrivalEtaProps) {
  const { t } = useLocale();
  const [now, setNow] = useState(() => Date.now());

  // Only tick while there's a countdown to age.
  useEffect(() => {
    if (mins == null || computedAt == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [mins, computedAt]);

  const measuring = km == null;
  // Elapsed since the measurement, so a 12-min ETA reads 10 min two minutes later.
  const remaining =
    mins != null && computedAt != null
      ? mins - (Math.max(now, computedAt) - computedAt) / 60000
      : null;
  const arriveAt = mins != null && computedAt != null ? new Date(computedAt + mins * 60000) : null;

  const headline = measuring
    ? t('liveSession.etaMeasuring')
    : remaining == null
      ? t('liveSession.etaDistance', { km: km!.toFixed(1) })
      : remaining <= ARRIVING_MINS
        ? t('liveSession.etaArrivingNow')
        : t('liveSession.etaMinutes', { mins: Math.round(remaining) });

  const details: string[] = [];
  if (!measuring && remaining != null)
    details.push(t('liveSession.etaDistance', { km: km!.toFixed(1) }));
  if (arriveAt)
    details.push(
      t('liveSession.etaClock', {
        time: arriveAt.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      })
    );
  if (!measuring && remaining == null) details.push(t('liveSession.etaNoDriveTime'));

  return (
    <View className={`${cardBg} rounded-2xl border ${borderColor} mb-3 flex-row items-center p-4`}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          backgroundColor: isDarkMode ? '#243447' : '#E6FAF0',
        }}>
        {measuring ? (
          <ActivityIndicator size="small" color={BRAND_GREEN} />
        ) : (
          <Ionicons name="navigate" size={22} color={BRAND_GREEN} />
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-xs font-bold uppercase ${subtextColor}`}>
          {t('liveSession.estimatedArrival')}
        </Text>
        <Text className={`text-lg font-bold ${textColor} mt-0.5`}>{headline}</Text>
        {details.length ? (
          <Text className={`text-xs ${subtextColor} mt-0.5`}>{details.join(' · ')}</Text>
        ) : null}
        {destinationLabel ? (
          <Text className={`text-xs ${subtextColor} mt-0.5`}>
            {t('liveSession.etaTo', { label: destinationLabel })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
