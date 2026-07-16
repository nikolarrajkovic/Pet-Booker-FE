import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getServicesForDate, ServiceItem, ScheduleMode } from '../utils/mockScheduleData';
import { themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { DAY_KEYS, MONTH_KEYS } from '../../../i18n';

interface DayViewProps {
  selectedDate: Date;
  isDarkMode: boolean;
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
      return isDarkMode ? 'bg-blue-300/20' : 'bg-blue-100';
    case 'grooming':
      return isDarkMode ? 'bg-purple-300/20' : 'bg-purple-100';
    case 'sitting':
      return isDarkMode ? 'bg-green-300/20' : 'bg-green-100';
    default:
      return isDarkMode ? 'bg-gray-500/20' : 'bg-gray-50';
  }
};

export default function DayView({ selectedDate, isDarkMode, onDateChange, mode }: DayViewProps) {
  const { textColor, subtextColor, cardBg, borderColor } = themeColors(isDarkMode);
  const { t } = useLocale();

  const formatDate = (date: Date) =>
    `${t(DAY_KEYS[date.getDay()])}, ${t(MONTH_KEYS[date.getMonth()])} ${date.getDate()}, ${date.getFullYear()}`;

  // Get services for the selected date, filtered by mode
  const all = getServicesForDate(selectedDate);
  const servicesForDate =
    mode === 'user' ? all.filter((s) => s.isUserService) : all.filter((s) => !s.isUserService);

  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    onDateChange(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    onDateChange(nextDay);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <View className="px-6 py-6">
      {/* Date Navigation */}
      <View className="mb-6 flex-row items-center justify-between">
        <TouchableOpacity className="p-2" onPress={goToPreviousDay}>
          <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#fff' : '#000'} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className={`text-lg font-bold ${textColor}`}>{formatDate(selectedDate)}</Text>
          {isToday && (
            <Text className="mt-1 text-sm font-semibold text-brand-500">{t('schedule.today')}</Text>
          )}
        </View>
        <TouchableOpacity className="p-2" onPress={goToNextDay}>
          <Ionicons name="chevron-forward" size={24} color={isDarkMode ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>

      {/* Services List */}
      {servicesForDate.length > 0 ? (
        servicesForDate.map((service) => (
          <View key={service.id} className={`${cardBg} mb-3 rounded-2xl border p-4 ${borderColor}`}>
            <View className="mb-3 flex-row items-start justify-between">
              <View className="flex-1">
                <Text className={`text-base font-bold ${textColor} mb-1`}>{service.title}</Text>
                <Text className={`text-sm ${subtextColor}`}>
                  {service.provider} • {service.petName}
                </Text>
              </View>
              <View className={`rounded-full px-3 py-1 ${getTypeBg(service.type, isDarkMode)}`}>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: getTypeColor(service.type) }}>
                  {t(`schedule.${service.type}` as any)}
                </Text>
              </View>
            </View>

            <View className="mb-2 flex-row items-center">
              <Ionicons name="time-outline" size={16} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <Text className={`text-sm ${subtextColor} ml-2`}>{service.time}</Text>
            </View>

            <View className="flex-row items-center">
              <Ionicons
                name="location-outline"
                size={16}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
              <Text className={`text-sm ${subtextColor} ml-2`}>{service.location}</Text>
            </View>
          </View>
        ))
      ) : (
        <View className="items-center justify-center py-12">
          <Ionicons name="calendar-outline" size={48} color={isDarkMode ? '#4B5563' : '#D1D5DB'} />
          <Text className={`text-base ${subtextColor} mt-4`}>{t('schedule.noServicesDay')}</Text>
        </View>
      )}
    </View>
  );
}
