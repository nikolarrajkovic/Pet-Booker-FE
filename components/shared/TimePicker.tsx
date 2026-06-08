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

export default function TimePicker({ value, onChange, onClose, isDarkMode, minDate }: TimePickerProps) {
  // Clamp initial value to minDate if it is in the past
  const clampedInit = minDate && value < minDate ? minDate : value;
  const initH = clampedInit.getHours();

  const [isAM, setIsAM] = useState(initH < 12);
  const [hour12, setHour12] = useState(initH % 12 === 0 ? 12 : initH % 12);
  const [minute, setMinute] = useState(clampedInit.getMinutes());

  const { hex } = themeColors(isDarkMode);
  const cardBg = hex.card;
  const borderColor = hex.border;
  const textColor = hex.text;
  const subtextColor = hex.subtext;
  const inputBg = hex.inputBg;
  const stripBg = isDarkMode ? '#243447' : '#F0FDF8';

  // Convert current picker state to total minutes since midnight (0–1439)
  const toTotalMinutes = (h12 = hour12, am = isAM, min = minute) => {
    const h24 = am ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12);
    return h24 * 60 + min;
  };

  // Minimum allowed total minutes since midnight (if minDate provided)
  const minTotalMinutes = minDate ? minDate.getHours() * 60 + minDate.getMinutes() : 0;

  // Apply a delta (in minutes) to the current time, carrying hours and flipping AM/PM
  const changeTime = (deltaMinutes: number) => {
    const total = toTotalMinutes();
    let next = total + deltaMinutes;
    // Wrap within a day
    next = ((next % 1440) + 1440) % 1440;
    // Clamp to minimum if enforcing
    if (minDate && next < minTotalMinutes) next = minTotalMinutes;
    const newH24 = Math.floor(next / 60);
    const newMin = next % 60;
    setMinute(newMin);
    setIsAM(newH24 < 12);
    setHour12(newH24 % 12 === 0 ? 12 : newH24 % 12);
  };

  const changeHour = (delta: number) => changeTime(delta * 60);
  const changeMinute = (delta: number) => changeTime(delta);

  // Whether decrement would go below the minimum
  const canDecrement = (deltaMinutes: number) => {
    if (!minDate) return true;
    return toTotalMinutes() + deltaMinutes >= minTotalMinutes;
  };

  const handleDone = () => {
    const h24 = isAM ? (hour12 === 12 ? 0 : hour12) : (hour12 === 12 ? 12 : hour12 + 12);
    let result = new Date(value);
    result.setHours(h24, minute, 0, 0);
    // Ensure result is not before minDate
    if (minDate && result < minDate) {
      result = new Date(minDate);
      result.setSeconds(0, 0);
    }
    onChange(result);
    onClose();
  };

  const SpinnerColumn = ({
    value: displayVal,
    onUp,
    onDown,
    downDisabled = false,
  }: {
    value: string;
    onUp: () => void;
    onDown: () => void;
    downDisabled?: boolean;
  }) => (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <TouchableOpacity
        onPress={onUp}
        style={{ padding: 8, marginBottom: 2 }}
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
        Select Time
      </Text>

      {/* Spinner row */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SpinnerColumn
          value={String(hour12).padStart(2, '0')}
          onUp={() => changeHour(1)}
          onDown={() => changeHour(-1)}
          downDisabled={!canDecrement(-60)}
        />

        {/* Colon separator */}
        <Text style={{ color: textColor, fontSize: 28, fontWeight: '700', marginHorizontal: 4, marginTop: -8 }}>:</Text>

        <SpinnerColumn
          value={String(minute).padStart(2, '0')}
          onUp={() => changeMinute(1)}
          onDown={() => changeMinute(-1)}
          downDisabled={!canDecrement(-1)}
        />

        {/* AM/PM toggle */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setIsAM(true)}
            style={{
              width: '80%',
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: 'center',
              marginBottom: 6,
              backgroundColor: isAM ? '#00C870' : inputBg,
              borderWidth: 1.5,
              borderColor: isAM ? '#00C870' : borderColor,
            }}
          >
            <Text style={{ color: isAM ? '#ffffff' : subtextColor, fontSize: 15, fontWeight: '600' }}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsAM(false)}
            style={{
              width: '80%',
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: !isAM ? '#00C870' : inputBg,
              borderWidth: 1.5,
              borderColor: !isAM ? '#00C870' : borderColor,
            }}
          >
            <Text style={{ color: !isAM ? '#ffffff' : subtextColor, fontSize: 15, fontWeight: '600' }}>PM</Text>
          </TouchableOpacity>
        </View>
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
