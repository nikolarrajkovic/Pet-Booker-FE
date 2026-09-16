import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, themeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { DAY_SHORT_KEYS, MONTH_KEYS, MONTH_SHORT_KEYS } from '../../i18n';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date | null) => void;
  onClose: () => void;
  isDarkMode: boolean;
  minDate?: Date;
  maxDate?: Date;
  // Optional per-day gate (on top of min/max). Return false to disable a date —
  // e.g. weekdays a service isn't scheduled for. Receives the day's start.
  isDateEnabled?: (date: Date) => boolean;
}

/**
 * Which of the three panes is showing. The picker drills down year -> month -> day, so a date
 * far from today is three taps away.
 *
 * It used to be days-plus-a-year-list, with the month reachable ONLY by stepping the chevrons
 * one month at a time. That is fine for "next Tuesday" and miserable for the field it is most
 * used on — a date of birth, which opens on January 2000 and is typically 100+ chevron taps and
 * several pages of an ascending 1900-onwards year list away. Same props, same call sites.
 */
type Pane = 'days' | 'months' | 'years';

const YEARS_PER_PAGE = 16; // 4 columns x 4 rows

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function DatePicker({
  value,
  onChange,
  onClose,
  isDarkMode,
  minDate,
  maxDate,
  isDateEnabled,
}: DatePickerProps) {
  const { t } = useLocale();
  // Localized month/day names, indexed by getMonth()/getDay().
  const MONTHS = MONTH_KEYS.map((k) => t(k));
  const MONTHS_SHORT = MONTH_SHORT_KEYS.map((k) => t(k));
  const DAYS = DAY_SHORT_KEYS.map((k) => t(k));
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [selected, setSelected] = useState(startOfDay(value));
  const [pane, setPane] = useState<Pane>('days');

  const minYear = minDate ? minDate.getFullYear() : 1900;
  const maxYear = maxDate ? maxDate.getFullYear() : today.getFullYear() + 20;

  // Newest first. The years that matter are almost always near the top of the range — a birth
  // year, a certificate issued recently — so counting up from 1900 buried them pages deep.
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const totalYearPages = Math.ceil(years.length / YEARS_PER_PAGE);
  const pageOfYear = (year: number) =>
    Math.min(Math.max(Math.floor((maxYear - year) / YEARS_PER_PAGE), 0), totalYearPages - 1);
  const [yearPage, setYearPage] = useState(() => pageOfYear(value.getFullYear()));
  const yearPageYears = years.slice(yearPage * YEARS_PER_PAGE, (yearPage + 1) * YEARS_PER_PAGE);
  // Descending page, so the first entry is the high end of the range.
  const yearPageHigh = yearPageYears[0] ?? maxYear;
  const yearPageLow = yearPageYears[yearPageYears.length - 1] ?? minYear;

  const { hex } = themeColors(isDarkMode);
  const cardBg = hex.card;
  const borderColor = hex.border;
  const textColor = hex.text;
  const subtextColor = hex.subtext;
  const inputBg = hex.inputBg;
  const chipBg = isDarkMode ? '#243447' : '#F3F4F6';

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
    if (isDateEnabled && !isDateEnabled(cellDate)) return true;
    return false;
  };

  // A month is out of reach only when EVERY day in it is — a partially allowed month stays
  // tappable and its own days are gated by isDisabled above.
  const isMonthDisabled = (month: number) => {
    const monthStart = new Date(viewYear, month, 1);
    const monthEnd = new Date(viewYear, month + 1, 0);
    if (minDate && monthEnd < startOfDay(minDate)) return true;
    if (maxDate && monthStart > startOfDay(maxDate)) return true;
    return false;
  };

  const isSelected = (day: number) => isSameDay(selected, new Date(viewYear, viewMonth, day));
  const isToday = (day: number) => isSameDay(today, new Date(viewYear, viewMonth, day));

  const handleSelect = (day: number) => {
    if (isDisabled(day)) return;
    setSelected(new Date(viewYear, viewMonth, day));
  };

  const handleDone = () => {
    onChange(selected);
    onClose();
  };

  const handleClear = () => {
    onChange(null);
    onClose();
  };

  // ─── Header stepping — what the chevrons mean depends on the open pane ──────────────
  const stepBack = () => {
    if (pane === 'years') {
      setYearPage((p) => Math.max(p - 1, 0));
    } else if (pane === 'months') {
      setViewYear((y) => Math.max(y - 1, minYear));
    } else if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const stepForward = () => {
    if (pane === 'years') {
      setYearPage((p) => Math.min(p + 1, totalYearPages - 1));
    } else if (pane === 'months') {
      setViewYear((y) => Math.min(y + 1, maxYear));
    } else if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const canStepBack = () => {
    if (pane === 'years') return yearPage > 0;
    if (pane === 'months') return viewYear > minYear;
    if (!minDate) return true;
    // The whole previous month lies before minDate?
    return new Date(viewYear, viewMonth, 0) >= startOfDay(minDate);
  };

  const canStepForward = () => {
    if (pane === 'years') return yearPage < totalYearPages - 1;
    if (pane === 'months') return viewYear < maxYear;
    if (!maxDate) return true;
    // The whole next month lies after maxDate?
    return new Date(viewYear, viewMonth + 1, 1) <= startOfDay(maxDate);
  };

  const backDisabled = !canStepBack();
  const forwardDisabled = !canStepForward();

  // Drill down rather than dismiss: picking a year asks for the month, picking the month asks
  // for the day. Tapping the open pane's own chip closes it back to the days grid.
  const openPane = (next: Pane) => {
    if (next === 'years') setYearPage(pageOfYear(viewYear));
    setPane((current) => (current === next ? 'days' : next));
  };

  const headerChip = (label: string, target: Pane) => {
    const active = pane === target;
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: active }}
        onPress={() => openPane(target)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: active ? BRAND_GREEN : chipBg,
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
          gap: 3,
        }}>
        <Text
          style={{ color: active ? '#ffffff' : textColor, fontWeight: '700', fontSize: 15 }}
          numberOfLines={1}>
          {label}
        </Text>
        <Ionicons
          name={active ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={active ? '#ffffff' : subtextColor}
        />
      </TouchableOpacity>
    );
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
      }}>
      {/* Month/Year navigation — both parts are their own drill-down control */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={stepBack}
          disabled={backDisabled}
          style={{ padding: 4, opacity: backDisabled ? 0.3 : 1 }}>
          <Ionicons name="chevron-back" size={20} color={subtextColor} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          {pane === 'years'
            ? headerChip(`${yearPageLow}–${yearPageHigh}`, 'years')
            : [headerChip(MONTHS[viewMonth], 'months'), headerChip(String(viewYear), 'years')].map(
                (chip, i) => <React.Fragment key={i}>{chip}</React.Fragment>
              )}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={stepForward}
          disabled={forwardDisabled}
          style={{ padding: 4, opacity: forwardDisabled ? 0.3 : 1 }}>
          <Ionicons name="chevron-forward" size={20} color={subtextColor} />
        </TouchableOpacity>
      </View>

      {pane === 'years' ? (
        /* Year picker — replaces the calendar grid */
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', minHeight: 44 * 4 }}>
          {yearPageYears.map((year) => {
            const isActive = year === viewYear;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={year}
                onPress={() => {
                  setViewYear(year);
                  setPane('months');
                }}
                style={{
                  width: '25%',
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: isActive ? BRAND_GREEN : 'transparent',
                }}>
                <Text
                  style={{
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
      ) : pane === 'months' ? (
        /* Month picker — 12 cells, so no chevron-stepping to reach a month */
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', minHeight: 44 * 4 }}>
          {MONTHS_SHORT.map((label, month) => {
            const isActive = month === viewMonth;
            const disabled = isMonthDisabled(month);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: isActive, disabled }}
                key={label}
                disabled={disabled}
                onPress={() => {
                  setViewMonth(month);
                  setPane('days');
                }}
                style={{
                  width: '25%',
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  backgroundColor: isActive ? BRAND_GREEN : 'transparent',
                  opacity: disabled ? 0.3 : 1,
                }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: isActive ? '700' : '400',
                    color: isActive ? '#ffffff' : textColor,
                  }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <>
          {/* Day headers */}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {DAYS.map((d) => (
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
                    accessibilityRole="button"
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
                      backgroundColor: selected_ ? BRAND_GREEN : 'transparent',
                      borderWidth: today_ && !selected_ ? 1.5 : 0,
                      borderColor: BRAND_GREEN,
                      opacity: disabled ? 0.3 : 1,
                    }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: selected_ ? '700' : '400',
                        color: selected_ ? '#ffffff' : today_ ? BRAND_GREEN : textColor,
                      }}>
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
          accessibilityRole="button"
          onPress={handleClear}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: inputBg,
            borderWidth: 1,
            borderColor,
          }}>
          <Text style={{ color: subtextColor, fontWeight: '600', fontSize: 14 }}>
            {t('shared.clear')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleDone}
          style={{
            flex: 2,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: BRAND_GREEN,
          }}>
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
            {t('shared.done')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
