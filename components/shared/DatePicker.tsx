import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../hooks/useThemeColors';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date | null) => void;
  onClose: () => void;
  isDarkMode: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function DatePicker({ value, onChange, onClose, isDarkMode, minDate, maxDate }: DatePickerProps) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [selected, setSelected] = useState(startOfDay(value));
  const [showYearPicker, setShowYearPicker] = useState(false);

  const minYear = minDate ? minDate.getFullYear() : 1900;
  const maxYear = maxDate ? maxDate.getFullYear() : today.getFullYear() + 20;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const YEARS_PER_PAGE = 16; // 4 columns × 4 rows
  const initialPage = Math.floor((value.getFullYear() - minYear) / YEARS_PER_PAGE);
  const [yearPage, setYearPage] = useState(initialPage);
  const totalYearPages = Math.ceil(years.length / YEARS_PER_PAGE);
  const yearPageYears = years.slice(yearPage * YEARS_PER_PAGE, (yearPage + 1) * YEARS_PER_PAGE);
  const yearPageStart = yearPage * YEARS_PER_PAGE + minYear;
  const yearPageEnd = Math.min(yearPageStart + YEARS_PER_PAGE - 1, maxYear);

  const { hex } = themeColors(isDarkMode);
  const cardBg = hex.card;
  const borderColor = hex.border;
  const textColor = hex.text;
  const subtextColor = hex.subtext;
  const inputBg = hex.inputBg;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Build grid: pad with nulls for leading empty cells
  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const isDisabled = (day: number) => {
    const cellDate = new Date(viewYear, viewMonth, day);
    if (minDate && cellDate < startOfDay(minDate)) return true;
    if (maxDate && cellDate > startOfDay(maxDate)) return true;
    return false;
  };

  const isSelected = (day: number) => isSameDay(selected, new Date(viewYear, viewMonth, day));
  const isToday = (day: number) => isSameDay(today, new Date(viewYear, viewMonth, day));

  const handleSelect = (day: number) => {
    if (isDisabled(day)) return;
    const newDate = new Date(viewYear, viewMonth, day);
    setSelected(newDate);
  };

  const handleDone = () => {
    onChange(selected);
    onClose();
  };

  const handleClear = () => {
    onChange(null);
    onClose();
  };

  // Prevent "prev" nav if the entire previous month is before minDate
  const canGoPrev = () => {
    if (!minDate) return true;
    const lastDayOfPrev = new Date(viewYear, viewMonth, 0);
    return lastDayOfPrev >= startOfDay(minDate);
  };

  // Prevent "next" nav if the first day of the next month is after maxDate
  const canGoNext = () => {
    if (!maxDate) return true;
    const firstDayOfNext = new Date(viewYear, viewMonth + 1, 1);
    return firstDayOfNext <= startOfDay(maxDate);
  };

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
      {/* Month/Year navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <TouchableOpacity
          onPress={showYearPicker ? () => setYearPage(p => p - 1) : prevMonth}
          disabled={showYearPicker ? yearPage === 0 : !canGoPrev()}
          style={{ padding: 4, opacity: (showYearPicker ? yearPage === 0 : !canGoPrev()) ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-back" size={20} color={subtextColor} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {!showYearPicker && (
            <Text style={{ color: textColor, fontWeight: '600', fontSize: 15 }}>
              {MONTHS[viewMonth]}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => {
              if (!showYearPicker) {
                const page = Math.floor((viewYear - minYear) / YEARS_PER_PAGE);
                setYearPage(page);
              }
              setShowYearPicker(v => !v);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: showYearPicker ? '#00C870' : (isDarkMode ? '#243447' : '#F3F4F6'),
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
              gap: 3,
            }}
          >
            {showYearPicker ? (
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                {yearPageStart}–{yearPageEnd}
              </Text>
            ) : (
              <Text style={{ color: textColor, fontWeight: '700', fontSize: 15 }}>
                {viewYear}
              </Text>
            )}
            <Ionicons
              name={showYearPicker ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={showYearPicker ? '#ffffff' : subtextColor}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={showYearPicker ? () => setYearPage(p => p + 1) : nextMonth}
          disabled={showYearPicker ? yearPage >= totalYearPages - 1 : !canGoNext()}
          style={{ padding: 4, opacity: (showYearPicker ? yearPage >= totalYearPages - 1 : !canGoNext()) ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-forward" size={20} color={subtextColor} />
        </TouchableOpacity>
      </View>

      {/* Year picker — replaces calendar grid */}
      {showYearPicker ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', minHeight: 44 * 4 }}>
          {yearPageYears.map(year => {
            const isActive = year === viewYear;
            return (
              <TouchableOpacity
                key={year}
                onPress={() => { setViewYear(year); setShowYearPicker(false); }}
                style={{
                  width: '25%',
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: isActive ? '#00C870' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: isActive ? '700' : '400',
                  color: isActive ? '#ffffff' : textColor,
                }}>
                  {year}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <>
          {/* Day headers */}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {DAYS.map(d => (
              <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ color: subtextColor, fontSize: 12, fontWeight: '500' }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', marginBottom: 2 }}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                const key = `${row}-${col}`;
                if (!day) return <View key={key} style={{ flex: 1 }} />;
                const selected_ = isSelected(day);
                const today_ = isToday(day);
                const disabled = isDisabled(day);
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleSelect(day)}
                    disabled={disabled}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 36,
                      margin: 1,
                      borderRadius: 18,
                      backgroundColor: selected_ ? '#00C870' : 'transparent',
                      borderWidth: today_ && !selected_ ? 1.5 : 0,
                      borderColor: '#00C870',
                      opacity: disabled ? 0.3 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: selected_ ? '700' : '400',
                        color: selected_ ? '#ffffff' : today_ ? '#00C870' : textColor,
                      }}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </>
      )}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          onPress={handleClear}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: inputBg,
            borderWidth: 1,
            borderColor,
          }}
        >
          <Text style={{ color: subtextColor, fontWeight: '600', fontSize: 14 }}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDone}
          style={{
            flex: 2,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: '#00C870',
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
