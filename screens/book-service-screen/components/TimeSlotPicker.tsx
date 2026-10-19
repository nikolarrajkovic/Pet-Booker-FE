import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
export type TimeSlot = {
  id: string; // e.g. "09:00"
  label: string; // e.g. "09:00 AM"
  start: Date; // exact slot start
  available: boolean;
};

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: TimeSlot) => void;
  isLoading: boolean;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  /** Length of one appointment, to state the window the picked start gives ("10:30 – 11:30"). */
  slotMinutes?: number;
}

/**
 * The part of the day a start time belongs to — the way people think about a walk or a sit.
 * "After midnight" only appears on a day that carries the tail of the previous night's hours
 * (an overnight window, Friday 20:00–02:00, shows Saturday 00:00–02:00).
 */
export type DayPart = 'afterMidnight' | 'morning' | 'afternoon' | 'evening' | 'night';
export const dayPartOf = (d: Date): DayPart => {
  const h = d.getHours();
  if (h < 6) return 'afterMidnight';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
};

const DAY_PARTS: { key: DayPart; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'afterMidnight', icon: 'moon-outline' },
  { key: 'morning', icon: 'sunny-outline' },
  { key: 'afternoon', icon: 'partly-sunny-outline' },
  { key: 'evening', icon: 'cloudy-night-outline' },
  { key: 'night', icon: 'moon-outline' },
];

const clock = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Bookable start times for the selected date, grouped into morning / afternoon / evening.
 *
 * Starts come every 30 minutes (see BookServiceScreen), which is twice as many as the old hourly
 * grid — grouped by part of the day they stay scannable, and "an evening walk" is one glance.
 * Unavailable starts (taken, or in the past) are greyed out and disabled.
 */
export default function TimeSlotPicker({
  slots,
  selectedSlotId,
  onSelectSlot,
  isLoading,
  isDarkMode,
  textColor,
  subtextColor,
  slotMinutes,
}: TimeSlotPickerProps) {
  const { t } = useLocale();
  const selected = slots.find((s) => s.id === selectedSlotId) ?? null;

  const chip = (slot: TimeSlot) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: selectedSlotId === slot.id, disabled: !slot.available }}
      aria-selected={selectedSlotId === slot.id}
      aria-disabled={!slot.available}
      key={slot.id}
      onPress={() => slot.available && onSelectSlot(slot)}
      disabled={!slot.available}
      // Fixed columns (four per row) so they stay aligned regardless of label length; growing let
      // a short last row stretch two slots across the whole width.
      style={{ flexBasis: '23%', flexGrow: 0 }}
      className={`items-center rounded-xl py-2.5 ${
        selectedSlotId === slot.id
          ? 'bg-brand-500'
          : slot.available
            ? isDarkMode
              ? 'bg-[#243447]'
              : 'bg-gray-100'
            : isDarkMode
              ? 'bg-[#1a2332]'
              : 'bg-gray-50'
      }`}>
      <Text
        className={`text-sm font-medium ${
          selectedSlotId === slot.id
            ? 'text-white'
            : slot.available
              ? 'text-brand-600'
              : isDarkMode
                ? 'text-gray-700'
                : 'text-gray-300'
        }`}>
        {slot.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="mt-4">
      <Text className={`text-base font-semibold ${textColor} mb-3`}>
        {t('bookService.availableTimes')}
      </Text>
      {isLoading ? (
        <View className="items-center py-6">
          <ActivityIndicator color={BRAND_GREEN} />
          <Text className={`text-xs ${subtextColor} mt-2`}>
            {t('bookService.checkingAvailability')}
          </Text>
        </View>
      ) : (
        DAY_PARTS.map(({ key, icon }) => {
          const part = slots.filter((s) => dayPartOf(s.start) === key);
          if (part.length === 0) return null;
          return (
            <View key={key} className="mb-3">
              <View className="mb-2 flex-row items-center">
                <Ionicons name={icon} size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                <Text className={`ml-1.5 text-xs font-semibold uppercase ${subtextColor}`}>
                  {t(`bookService.${key}` as any)}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">{part.map(chip)}</View>
            </View>
          );
        })
      )}
      {!isLoading && selected && slotMinutes ? (
        <Text className="mt-1 text-sm font-medium text-brand-600">
          {t('bookService.slotRange', {
            from: clock(selected.start),
            to: clock(new Date(selected.start.getTime() + slotMinutes * 60000)),
          })}
        </Text>
      ) : null}
      {!isLoading && slots.length === 0 && (
        <Text className={`text-sm ${subtextColor} mt-1`}>{t('bookService.noWindowsForDay')}</Text>
      )}
      {!isLoading && slots.length > 0 && slots.every((s) => !s.available) && (
        <Text className={`text-sm ${subtextColor} mt-3`}>{t('bookService.noFreeSlots')}</Text>
      )}
    </View>
  );
}
