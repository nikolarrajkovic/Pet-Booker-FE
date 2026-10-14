import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors, BRAND_GREEN } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import type { ScheduleMode, ServiceItem } from '../utils/scheduleData';

/**
 * The pieces Day, Week and Month share. The three views used to be drawn straight onto the
 * page's paw pattern with no surface of their own, each with its own header and arrows ("‹" in
 * two of them, chevrons in the third), so the schedule read as text floating on wallpaper.
 */

export const getTypeColor = (type: string) => {
  switch (type) {
    case 'walking':
      return '#3B82F6';
    case 'grooming':
      return '#A855F7';
    case 'sitting':
      return '#10B981';
    default:
      return '#6B7280';
  }
};

export const getTypeBg = (type: string, isDarkMode: boolean) => {
  switch (type) {
    case 'walking':
      return isDarkMode ? 'bg-blue-300/20' : 'bg-blue-100';
    case 'grooming':
      return isDarkMode ? 'bg-purple-300/20' : 'bg-purple-100';
    case 'sitting':
      return isDarkMode ? 'bg-green-300/20' : 'bg-green-100';
    default:
      return isDarkMode ? 'bg-gray-500/20' : 'bg-gray-50';
  }
};

/** A white (dark: slate) card with a border, the surface every view sits on. */
export function SchedulePanel({
  isDarkMode,
  children,
}: {
  isDarkMode: boolean;
  children: React.ReactNode;
}) {
  const { cardBg, borderColor } = themeColors(isDarkMode);
  return (
    <View className={`${cardBg} overflow-hidden rounded-2xl border ${borderColor}`}>
      {children}
    </View>
  );
}

/**
 * The period navigator: arrows either side of the period's title, on a light green strip. On the
 * current period it says so; on any other it offers the way back to today.
 */
export function ScheduleHeader({
  title,
  isCurrent,
  onPrevious,
  onNext,
  onToday,
  previousLabel,
  nextLabel,
  isDarkMode,
  children,
}: {
  title: string;
  isCurrent: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  previousLabel: string;
  nextLabel: string;
  isDarkMode: boolean;
  /** Drawn under the title row, inside the strip (the legend). */
  children?: React.ReactNode;
}) {
  const { t } = useLocale();
  const { textColor, borderColor } = themeColors(isDarkMode);
  const arrow = `h-9 w-9 items-center justify-center rounded-full border ${borderColor} ${
    isDarkMode ? 'bg-[#243447]' : 'bg-white'
  }`;
  return (
    <View
      className={`border-b px-4 py-3 ${borderColor} ${isDarkMode ? 'bg-brand-900/30' : 'bg-brand-50'}`}>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={previousLabel}
          className={arrow}
          onPress={onPrevious}>
          <Ionicons name="chevron-back" size={18} color={isDarkMode ? '#E5E7EB' : '#111827'} />
        </TouchableOpacity>
        <View className="flex-1 items-center px-2">
          <Text className={`text-base font-bold ${textColor}`} numberOfLines={1}>
            {title}
          </Text>
          {isCurrent ? (
            <Text className="mt-0.5 text-xs font-semibold text-brand-600">
              {t('schedule.today')}
            </Text>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onToday}
              className="mt-1 rounded-full bg-brand-500 px-3 py-0.5">
              <Text className="text-xs font-semibold text-white">{t('schedule.goToToday')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={nextLabel}
          className={arrow}
          onPress={onNext}>
          <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#E5E7EB' : '#111827'} />
        </TouchableOpacity>
      </View>
      {children ? <View className="mt-3">{children}</View> : null}
    </View>
  );
}

/** What the calendar colours mean: workload for a partner, the kind of service for a user. */
export function ScheduleLegend({ mode, isDarkMode }: { mode: ScheduleMode; isDarkMode: boolean }) {
  const { t } = useLocale();
  const { subtextColor } = themeColors(isDarkMode);
  const items: [string, string][] =
    mode === 'partner'
      ? [
          ['#86EFAC', '< 3h'],
          ['#FDE047', '3-6h'],
          ['#FCA5A5', '6+ h'],
        ]
      : [
          ['#93C5FD', t('schedule.walking')],
          ['#D8B4FE', t('schedule.grooming')],
          ['#86EFAC', t('schedule.sitting')],
        ];
  return (
    <View className="flex-row flex-wrap items-center justify-center gap-4">
      {items.map(([color, label]) => (
        <View key={label} className="flex-row items-center">
          <View className="mr-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <Text className={`text-xs ${subtextColor}`}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** One appointment as a row in a panel: what, when, with whom, and its kind. */
export function ScheduleRow({
  service,
  isDarkMode,
  onPress,
  last,
}: {
  service: ServiceItem;
  isDarkMode: boolean;
  onPress?: () => void;
  /** No divider under the last row of a group. */
  last?: boolean;
}) {
  const { t } = useLocale();
  const { textColor, subtextColor, borderColor } = themeColors(isDarkMode);
  const meta = [service.counterpart, service.petName].filter(Boolean).join(' • ');
  const body = (
    <View className={`flex-row items-center py-3 ${last ? '' : `border-b ${borderColor}`}`}>
      <View
        className="mr-3 w-1 self-stretch rounded-full"
        style={{ backgroundColor: getTypeColor(service.type) }}
      />
      <View className="flex-1">
        <Text className={`text-sm font-semibold ${textColor}`} numberOfLines={1}>
          {service.title}
        </Text>
        <View className="mt-1 flex-row items-center">
          <Ionicons name="time-outline" size={13} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          <Text className={`ml-1 text-xs ${subtextColor}`} numberOfLines={1}>
            {service.time}
            {meta ? ` • ${meta}` : ''}
          </Text>
        </View>
      </View>
      <View className={`ml-3 rounded-full px-2.5 py-1 ${getTypeBg(service.type, isDarkMode)}`}>
        <Text className="text-xs font-semibold" style={{ color: getTypeColor(service.type) }}>
          {t(`schedule.${service.type}` as any)}
        </Text>
      </View>
    </View>
  );
  return onPress ? (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.7}>
      {body}
    </TouchableOpacity>
  ) : (
    body
  );
}

/** The panel's empty state. */
export function ScheduleEmpty({ text, isDarkMode }: { text: string; isDarkMode: boolean }) {
  const { subtextColor } = themeColors(isDarkMode);
  return (
    <View className="items-center justify-center py-10">
      <View
        className={`mb-3 h-14 w-14 items-center justify-center rounded-full ${
          isDarkMode ? 'bg-brand-900/30' : 'bg-brand-50'
        }`}>
        <Ionicons name="calendar-outline" size={26} color={BRAND_GREEN} />
      </View>
      <Text className={`text-sm ${subtextColor}`}>{text}</Text>
    </View>
  );
}
