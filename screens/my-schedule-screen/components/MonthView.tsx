import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  getDayColorInfo,
  getDayColorPressed,
  getMonthStats,
  getServicesForDate,
  ScheduleMode,
} from '../utils/scheduleData';
import { themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { DAY_SHORT_KEYS, MONTH_KEYS } from '../../../i18n';
import { formatWeekdayDayMonth } from '../../../i18n/dates';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { useResponsive } from '../../../hooks/useResponsive';
import { SchedulePanel, ScheduleHeader, ScheduleLegend } from './ScheduleParts';

interface MonthViewProps {
  selectedDate: Date;
  isDarkMode: boolean;
  onDateSelect: (date: Date) => void;
  onDateChange: (date: Date) => void;
  mode: ScheduleMode;
}

/**
 * Height of a day cell in the wide layout. Cells used to be square (`aspect-square` on a
 * seventh of the width), so on a desktop each week was ~220 px tall and the month ran far below
 * the fold with the numbers floating in empty space. A fixed height keeps the month on one
 * screen and leaves room to say what the day holds.
 */
const WIDE_CELL_HEIGHT = 84;

const getMonthDays = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days: (Date | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
  // Fill the last week, so the grid's bottom edge is straight.
  while (days.length % 7 !== 0) days.push(null);
  return days;
};

const isCurrentMonth = (date: Date) => {
  const today = new Date();
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

export default function MonthView({
  selectedDate,
  isDarkMode,
  onDateSelect,
  onDateChange,
  mode,
}: MonthViewProps) {
  const gutter = usePageGutter();
  const { isWebLayout } = useResponsive();
  const [pressedDay, setPressedDay] = useState<string | null>(null);
  const { textColor, subtextColor, borderColor } = themeColors(isDarkMode);
  const { t } = useLocale();

  const monthDays = getMonthDays(selectedDate);
  const dayNames = DAY_SHORT_KEYS.map((k) => t(k));
  const title = `${t(MONTH_KEYS[selectedDate.getMonth()])} ${selectedDate.getFullYear()}`;

  const shiftMonth = (by: number) => {
    const next = new Date(selectedDate);
    next.setDate(1);
    next.setMonth(next.getMonth() + by);
    onDateChange(next);
  };

  const { totalServices, bookedDays, avgPerWeek } = getMonthStats(selectedDate, mode);
  const todayStr = new Date().toDateString();
  const emptyCellBg = isDarkMode ? 'bg-[#141c28]' : 'bg-gray-50';

  return (
    <View className={`${gutter.px} pb-8 pt-2`}>
      <SchedulePanel isDarkMode={isDarkMode}>
        <ScheduleHeader
          title={title}
          isCurrent={isCurrentMonth(selectedDate)}
          onPrevious={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          onToday={() => onDateChange(new Date())}
          previousLabel={t('common.previous')}
          nextLabel={t('common.next')}
          isDarkMode={isDarkMode}>
          <ScheduleLegend mode={mode} isDarkMode={isDarkMode} />
        </ScheduleHeader>

        <View className={isWebLayout ? 'p-3' : 'px-2 py-3'}>
          {/* Day names */}
          <View className="flex-row">
            {dayNames.map((day) => (
              <View key={day} className="flex-1 items-center pb-2">
                <Text className={`text-xs font-semibold uppercase ${subtextColor}`}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Dates */}
          <View className="flex-row flex-wrap">
            {monthDays.map((day, index) => {
              const cellSize = isWebLayout ? '' : 'aspect-square';
              const cellStyle = isWebLayout ? { height: WIDE_CELL_HEIGHT } : undefined;
              if (!day) {
                return (
                  <View
                    key={`empty-${index}`}
                    className={`${cellSize} w-[14.28%] p-1`}
                    style={cellStyle}>
                    {isWebLayout ? <View className={`flex-1 rounded-lg ${emptyCellBg}`} /> : null}
                  </View>
                );
              }

              const dateStr = day.toDateString();
              const isToday = dateStr === todayStr;
              const colorInfo =
                pressedDay === dateStr ? getDayColorPressed(day, mode) : getDayColorInfo(day, mode);
              const count = colorInfo.hasData
                ? getServicesForDate(day).filter((s) =>
                    mode === 'user' ? s.isUserService : !s.isUserService
                  ).length
                : 0;
              const hours = Math.round(colorInfo.totalHours * 10) / 10;

              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    count > 0
                      ? `${formatWeekdayDayMonth(day, undefined, 'long')}, ${t('schedule.servicesCount', { count })}`
                      : formatWeekdayDayMonth(day, undefined, 'long')
                  }
                  key={dateStr}
                  className={`${cellSize} w-[14.28%] p-1`}
                  style={cellStyle}
                  onPressIn={() => setPressedDay(dateStr)}
                  onPressOut={() => setPressedDay(null)}
                  onPress={() => onDateSelect(day)}>
                  {isWebLayout ? (
                    // Wide: the date in the corner, and what the day holds along the bottom.
                    <View
                      className={`flex-1 justify-between rounded-lg border p-2 ${
                        isToday ? 'border-brand-500' : borderColor
                      }`}
                      style={{
                        backgroundColor: colorInfo.hasData ? `${colorInfo.color}55` : undefined,
                      }}>
                      <View
                        className={`h-6 w-6 items-center justify-center rounded-full ${
                          isToday ? 'bg-brand-500' : ''
                        }`}>
                        <Text
                          className={`text-xs font-semibold ${isToday ? 'text-white' : textColor}`}>
                          {day.getDate()}
                        </Text>
                      </View>
                      {count > 0 ? (
                        <View className="flex-row items-center">
                          <View
                            className="mr-1.5 h-2 w-2 rounded-full"
                            style={{ backgroundColor: colorInfo.color }}
                          />
                          <Text className={`text-xs font-medium ${textColor}`} numberOfLines={1}>
                            {t('schedule.servicesCount', { count })}
                            {mode === 'partner' ? ` · ${t('schedule.hoursShort', { hours })}` : ''}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    // Phone: a compact tile coloured by the day's load.
                    <View
                      className={`flex-1 items-center justify-center rounded-lg ${
                        isToday ? 'border-2 border-brand-500' : ''
                      }`}
                      style={{ backgroundColor: colorInfo.color }}>
                      <Text
                        className={`text-sm font-semibold ${
                          colorInfo.hasData
                            ? 'text-gray-900'
                            : isToday
                              ? 'text-brand-600'
                              : textColor
                        }`}>
                        {day.getDate()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* The month in numbers */}
        <View className={`flex-row border-t ${borderColor}`}>
          {[
            [totalServices, t('schedule.totalServices')],
            [bookedDays, t('schedule.bookedDays')],
            [avgPerWeek, t('schedule.avgPerWeek')],
          ].map(([value, label], i) => (
            <View
              key={String(label)}
              className={`flex-1 items-center py-4 ${i > 0 ? `border-l ${borderColor}` : ''}`}>
              <Text className={`text-2xl font-bold ${textColor}`}>{value}</Text>
              <Text className={`mt-0.5 text-xs ${subtextColor}`}>{label}</Text>
            </View>
          ))}
        </View>
      </SchedulePanel>
    </View>
  );
}
