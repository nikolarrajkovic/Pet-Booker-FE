import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';

interface TimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  isDarkMode: boolean;
  /** When provided, the picker will not allow selecting a time before this moment. */
  minDate?: Date;
}

// Total minutes since midnight at the top of the range: 24:00 (end of day).
const MAX_MINUTES = 24 * 60;

// 24:00 can't be held by a JS Date (hour 24 rolls to next-day 00:00), so it is
// encoded as the end-of-day sentinel 23:59:59 — a value the whole-minute picker
// never produces normally (it always sets seconds to 0).
const isMaxSentinel = (d: Date) =>
  d.getHours() === 23 && d.getMinutes() === 59 && d.getSeconds() === 59;

/**
 * Formats a picker Date as 24-hour "HH:mm", rendering the end-of-day sentinel
 * (23:59:59, produced when 24:00 is selected) as "24:00". Consumers should use
 * this to display/store a value coming out of TimePicker.
 */
export function formatTime24(date: Date): string {
  if (isMaxSentinel(date)) return '24:00';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function TimePicker({ value, onChange, onClose, isDarkMode, minDate }: TimePickerProps) {
  // Clamp initial value to minDate if it is in the past
  const clampedInit = minDate && value < minDate ? minDate : value;

  // 24-hour state: hour 0–24, minute 0–59 (hour 24 only as 24:00).
  const startAtMax = isMaxSentinel(value);
  const [hour, setHour] = useState(startAtMax ? 24 : clampedInit.getHours());
  const [minute, setMinute] = useState(startAtMax ? 0 : clampedInit.getMinutes());

  const { hex } = themeColors(isDarkMode);
  const cardBg = hex.card;
  const borderColor = hex.border;
  const textColor = hex.text;
  const subtextColor = hex.subtext;
  const stripBg = isDarkMode ? '#243447' : '#F0FDF8';

  // Current picker state as total minutes since midnight (0–1440)
  const toTotalMinutes = (h = hour, min = minute) => h * 60 + min;

  // Minimum allowed total minutes since midnight (if minDate provided)
  const minTotalMinutes = minDate ? minDate.getHours() * 60 + minDate.getMinutes() : 0;

  // Apply a delta (in minutes), clamped to [min, 24:00] (no wrap-around).
  const changeTime = (deltaMinutes: number) => {
    let next = toTotalMinutes() + deltaMinutes;
    if (next > MAX_MINUTES) next = MAX_MINUTES;
    if (next < minTotalMinutes) next = minTotalMinutes;
    if (next < 0) next = 0;
    setHour(Math.floor(next / 60));
    setMinute(next % 60);
  };

  const changeHour = (delta: number) => changeTime(delta * 60);
  const changeMinute = (delta: number) => changeTime(delta);

  // Whether decrement would go below the minimum
  const canDecrement = (deltaMinutes: number) => {
    if (!minDate) return true;
    return toTotalMinutes() + deltaMinutes >= minTotalMinutes;
  };
  // At the 24:00 ceiling the up arrows can't go higher.
  const atMax = toTotalMinutes() >= MAX_MINUTES;

  const handleDone = () => {
    let result = new Date(value);
    if (hour >= 24) {
      // 24:00 — encode as the end-of-day sentinel (see isMaxSentinel).
      result.setHours(23, 59, 59, 0);
    } else {
      result.setHours(hour, minute, 0, 0);
      // Ensure result is not before minDate
      if (minDate && result < minDate) {
        result = new Date(minDate);
        result.setSeconds(0, 0);
      }
    }
    onChange(result);
    onClose();
  };

  const SpinnerColumn = ({
    value: displayVal,
    onUp,
    onDown,
    upDisabled = false,
    downDisabled = false,
  }: {
    value: string;
    onUp: () => void;
    onDown: () => void;
    upDisabled?: boolean;
    downDisabled?: boolean;
  }) => (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <TouchableOpacity
        onPress={onUp}
        disabled={upDisabled}
        style={{ padding: 8, marginBottom: 2, opacity: upDisabled ? 0.3 : 1 }}
        activeOpacity={0.6}
      >
        <Ionicons name="chevron-up" size={22} color="#00C870" />
      </TouchableOpacity>

      <View
        style={{
          backgroundColor: stripBg,
          borderRadius: 12,
          width: '90%',
          alignItems: 'center',
          paddingVertical: 14,
          borderWidth: 1.5,
          borderColor: '#00C870',
        }}
      >
        <Text style={{ color: textColor, fontSize: 28, fontWeight: '700' }}>{displayVal}</Text>
      </View>

      <TouchableOpacity
        onPress={onDown}
        disabled={downDisabled}
        style={{ padding: 8, marginTop: 2, opacity: downDisabled ? 0.3 : 1 }}
        activeOpacity={0.6}
      >
        <Ionicons name="chevron-down" size={22} color="#00C870" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View
      style={{
        marginTop: 12,
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <Text style={{ color: subtextColor, fontSize: 13, fontWeight: '500', textAlign: 'center', marginBottom: 12 }}>
        Select Time (24h)
      </Text>

      {/* Spinner row — hour : minute (24-hour clock, 00:00–24:00, no AM/PM) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: '12%',
        }}
      >
        <SpinnerColumn
          value={String(hour).padStart(2, '0')}
          onUp={() => changeHour(1)}
          onDown={() => changeHour(-1)}
          upDisabled={atMax}
          downDisabled={!canDecrement(-60)}
        />

        {/* Colon separator */}
        <Text style={{ color: textColor, fontSize: 28, fontWeight: '700', marginHorizontal: 4, marginTop: -8 }}>:</Text>

        <SpinnerColumn
          value={String(minute).padStart(2, '0')}
          onUp={() => changeMinute(1)}
          onDown={() => changeMinute(-1)}
          upDisabled={atMax}
          downDisabled={!canDecrement(-1)}
        />
      </View>

      {/* Done button */}
      <TouchableOpacity
        onPress={handleDone}
        style={{
          marginTop: 16,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: '#00C870',
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}
