import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import {
  getServicesForDate,
  getDayColorInfo,
  getDayColorPressed,
  ScheduleMode,
} from '../utils/mockScheduleData';
import { themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { DAY_KEYS, DAY_SHORT_KEYS, MONTH_SHORT_KEYS } from '../../../i18n';

interface WeekViewProps {
  selectedDate: Date;
  isDarkMode: boolean;
  onDateSelect: (date: Date) => void;
  onDateChange: (date: Date) => void;
  mode: ScheduleMode;
}

const getTypeColor = (type: string) => {
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

const getTypeBg = (type: string, isDarkMode: boolean) => {
  switch (type) {
    case 'walking':
      return isDarkMode ? 'bg-blue-300/30' : 'bg-blue-100';
    case 'grooming':
      return isDarkMode ? 'bg-purple-300/30' : 'bg-purple-100';
    case 'sitting':
      return isDarkMode ? 'bg-green-300/30' : 'bg-green-100';
    default:
      return isDarkMode ? 'bg-gray-500/30' : 'bg-gray-100';
  }
};

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
  const [pressedDay, setPressedDay] = useState<string | null>(null);
  const { textColor, subtextColor, cardBg } = themeColors(isDarkMode);
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

  const goToPreviousWeek = () => {
    const prevWeek = new Date(selectedDate);
    prevWeek.setDate(prevWeek.getDate() - 7);
    onDateChange(prevWeek);
  };

  const goToNextWeek = () => {
    const nextWeek = new Date(selectedDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    onDateChange(nextWeek);
  };

  const isThisWeek = isCurrentWeek(selectedDate);

  return (
    <View className="flex-1">
      {/* Week Navigation */}
      <View className={`border-b px-6 py-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <TouchableOpacity className="p-2" onPress={goToPreviousWeek}>
            <Text className={`text-2xl ${textColor}`}>‹</Text>
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className={`text-lg font-bold ${textColor}`}>
              {formatWeekRange(selectedDate)}
            </Text>
            {isThisWeek && (
              <Text className="mt-1 text-sm font-semibold text-brand-500">
                {t('schedule.today')}
              </Text>
            )}
          </View>
          <TouchableOpacity className="p-2" onPress={goToNextWeek}>
            <Text className={`text-2xl ${textColor}`}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
        {mode === 'partner' ? (
          <View className="flex-row flex-wrap items-center justify-center gap-3">
            <View className="flex-row items-center">
              <View className="mr-1 h-3 w-3 rounded-full bg-green-300" />
              <Text className={`text-xs ${subtextColor}`}>{'< 3h'}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="mr-1 h-3 w-3 rounded-full bg-yellow-300" />
              <Text className={`text-xs ${subtextColor}`}>3-6h</Text>
            </View>
            <View className="flex-row items-center">
              <View className="mr-1 h-3 w-3 rounded-full bg-red-300" />
              <Text className={`text-xs ${subtextColor}`}>6+ h</Text>
            </View>
          </View>
        ) : (
          <View className="flex-row flex-wrap items-center justify-center gap-3">
            <View className="flex-row items-center">
              <View className="mr-1 h-3 w-3 rounded-full" style={{ backgroundColor: '#93C5FD' }} />
              <Text className={`text-xs ${subtextColor}`}>{t('schedule.walking')}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="mr-1 h-3 w-3 rounded-full" style={{ backgroundColor: '#D8B4FE' }} />
              <Text className={`text-xs ${subtextColor}`}>{t('schedule.grooming')}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="mr-1 h-3 w-3 rounded-full" style={{ backgroundColor: '#86EFAC' }} />
              <Text className={`text-xs ${subtextColor}`}>{t('schedule.sitting')}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Week Calendar */}
      <View className="px-6 py-4">
        <View className="mb-4 flex-row">
          {dayNames.map((day, index) => (
            <View key={day} className="flex-1 items-center">
              <Text className={`text-xs ${subtextColor} mb-2`}>{day}</Text>
            </View>
          ))}
        </View>

        <View className="mb-6 flex-row">
          {weekDays.map((day, index) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const all = getServicesForDate(day);
            const services =
              mode === 'user'
                ? all.filter((s) => s.isUserService)
                : all.filter((s) => !s.isUserService);
            const hasServices = services.length > 0;
            const isToday = day.toDateString() === new Date().toDateString();
            const isPressedNow = pressedDay === dateStr;

            const colorInfo = isPressedNow
              ? getDayColorPressed(day, mode)
              : getDayColorInfo(day, mode);
            const dayColor = colorInfo.color;

            return (
              <TouchableOpacity
                key={index}
                className="flex-1 items-center"
                onPressIn={() => setPressedDay(dateStr)}
                onPressOut={() => setPressedDay(null)}
                onPress={() => onDateSelect(day)}>
                <View
                  className="h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: dayColor,
                    opacity: isToday && dayColor !== 'transparent' ? 0.8 : 1,
                  }}>
                  <Text className={`font-semibold ${hasServices ? 'text-white' : textColor}`}>
                    {day.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Services List */}
      <ScrollView className="flex-1 px-6">
        {weekDays.map((day, index) => {
          const all = getServicesForDate(day);
          const services =
            mode === 'user'
              ? all.filter((s) => s.isUserService)
              : all.filter((s) => !s.isUserService);

          if (services.length === 0) return null;

          return (
            <View key={index} className="mb-6">
              <Text className={`text-sm font-bold ${textColor} mb-3`}>
                {t(DAY_KEYS[day.getDay()])}, {t(MONTH_SHORT_KEYS[day.getMonth()])} {day.getDate()}
              </Text>

              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  className={`${cardBg} mb-2 flex-row items-center justify-between rounded-xl p-3`}
                  onPress={() => onDateSelect(day)}>
                  <View className="flex-1">
                    <Text className={`text-sm font-semibold ${textColor}`}>{service.title}</Text>
                    <Text className={`text-xs ${subtextColor} mt-1`}>
                      {service.time} • {service.petName}
                    </Text>
                  </View>
                  <View className={`rounded-full px-2 py-1 ${getTypeBg(service.type, isDarkMode)}`}>
                    <Text
                      className="text-xs font-medium"
                      style={{ color: getTypeColor(service.type) }}>
                      {t(`schedule.${service.type}` as any)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
