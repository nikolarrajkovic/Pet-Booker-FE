import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  getDayColorInfo,
  getDayColorPressed,
  getServicesForDate,
  ScheduleMode,
} from '../utils/scheduleData';
import { themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { DAY_SHORT_KEYS, MONTH_SHORT_KEYS } from '../../../i18n';
import { formatWeekdayDayMonth } from '../../../i18n/dates';
import { usePageGutter } from '../../../hooks/usePageGutter';
import {
  SchedulePanel,
  ScheduleHeader,
  ScheduleLegend,
  ScheduleRow,
  ScheduleEmpty,
} from './ScheduleParts';

interface WeekViewProps {
  selectedDate: Date;
  isDarkMode: boolean;
  onDateSelect: (date: Date) => void;
  onDateChange: (date: Date) => void;
  mode: ScheduleMode;
}

const getWeekDays = (date: Date) => {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(startOfWeek);
    currentDay.setDate(currentDay.getDate() + i);
    days.push(currentDay);
  }
  return days;
};

const isCurrentWeek = (date: Date) => {
  const today = new Date();
  const weekDays = getWeekDays(date);
  return weekDays.some((day) => day.toDateString() === today.toDateString());
};

export default function WeekView({
  selectedDate,
  isDarkMode,
  onDateSelect,
  onDateChange,
  mode,
}: WeekViewProps) {
  const gutter = usePageGutter();
  const [pressedDay, setPressedDay] = useState<string | null>(null);
  const { textColor, subtextColor, borderColor } = themeColors(isDarkMode);
  const { t } = useLocale();

  const weekDays = getWeekDays(selectedDate);
  const dayNames = DAY_SHORT_KEYS.map((k) => t(k));

  const formatWeekRange = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    return `${t(MONTH_SHORT_KEYS[startOfWeek.getMonth()])} ${startOfWeek.getDate()} - ${t(MONTH_SHORT_KEYS[endOfWeek.getMonth()])} ${endOfWeek.getDate()}`;
  };

  const shiftWeek = (by: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7 * by);
    onDateChange(next);
  };

  const servicesOn = (day: Date) => {
    const all = getServicesForDate(day);
    return mode === 'user'
      ? all.filter((s) => s.isUserService)
      : all.filter((s) => !s.isUserService);
  };
  const daysWithServices = weekDays.filter((day) => servicesOn(day).length > 0);

  return (
    <View className={`${gutter.px} pb-8 pt-2`}>
      <SchedulePanel isDarkMode={isDarkMode}>
        <ScheduleHeader
          title={formatWeekRange(selectedDate)}
          isCurrent={isCurrentWeek(selectedDate)}
          onPrevious={() => shiftWeek(-1)}
          onNext={() => shiftWeek(1)}
          onToday={() => onDateChange(new Date())}
          previousLabel={t('common.previous')}
          nextLabel={t('common.next')}
          isDarkMode={isDarkMode}>
          <ScheduleLegend mode={mode} isDarkMode={isDarkMode} />
        </ScheduleHeader>

        {/* The week at a glance: each day coloured by its load, today ringed. */}
        <View className={`flex-row border-b px-2 py-3 ${borderColor}`}>
          {weekDays.map((day, index) => {
            const dateStr = day.toDateString();
            const isToday = dateStr === new Date().toDateString();
            const colorInfo =
              pressedDay === dateStr ? getDayColorPressed(day, mode) : getDayColorInfo(day, mode);
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={formatWeekdayDayMonth(day, undefined, 'long')}
                key={dateStr}
                className="flex-1 items-center"
                onPressIn={() => setPressedDay(dateStr)}
                onPressOut={() => setPressedDay(null)}
                onPress={() => onDateSelect(day)}>
                <Text className={`mb-1.5 text-xs ${subtextColor}`}>{dayNames[index]}</Text>
                <View
                  className={`h-10 w-10 items-center justify-center rounded-xl ${
                    isToday ? 'border-2 border-brand-500' : ''
                  }`}
                  style={{ backgroundColor: colorInfo.color }}>
                  <Text
                    className={`font-semibold ${colorInfo.hasData ? 'text-gray-900' : isToday ? 'text-brand-600' : textColor}`}>
                    {day.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* The week's appointments, by day. */}
        <View className="px-4 pb-2">
          {daysWithServices.length === 0 ? (
            <ScheduleEmpty text={t('schedule.noServicesWeek')} isDarkMode={isDarkMode} />
          ) : (
            daysWithServices.map((day) => {
              const services = servicesOn(day);
              return (
                <View key={day.toDateString()} className="pt-4">
                  <Text className={`text-xs font-bold uppercase tracking-wide ${subtextColor}`}>
                    {formatWeekdayDayMonth(day, undefined, 'long')}
                  </Text>
                  {services.map((service, i) => (
                    <ScheduleRow
                      key={service.id}
                      service={service}
                      isDarkMode={isDarkMode}
                      onPress={() => onDateSelect(day)}
                      last={i === services.length - 1}
                    />
                  ))}
                </View>
              );
            })
          )}
        </View>
      </SchedulePanel>
    </View>
  );
}
