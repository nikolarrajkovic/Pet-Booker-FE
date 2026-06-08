import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { getDayColorInfo, getDayColorPressed, getMonthStats, ScheduleMode } from '../utils/mockScheduleData';
import { themeColors } from '../../../hooks/useThemeColors';

interface MonthViewProps {
  selectedDate: Date;
  isDarkMode: boolean;
  onDateSelect: (date: Date) => void;
  onDateChange: (date: Date) => void;
  mode: ScheduleMode;
}

const getMonthDays = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const days = [];
  
  // Add empty cells for days before the month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  
  // Add all days in the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  
  return days;
};

const formatMonth = (date: Date) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

const isCurrentMonth = (date: Date) => {
  const today = new Date();
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

export default function MonthView({ selectedDate, isDarkMode, onDateSelect, onDateChange, mode }: MonthViewProps) {
  const [pressedDay, setPressedDay] = useState<string | null>(null);
  const { textColor, subtextColor } = themeColors(isDarkMode);

  const monthDays = getMonthDays(selectedDate);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToPreviousMonth = () => {
    const prevMonth = new Date(selectedDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    onDateChange(prevMonth);
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(selectedDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    onDateChange(nextMonth);
  };

  const isThisMonth = isCurrentMonth(selectedDate);

  // Calculate stats for the current month
  const { totalServices, bookedDays, avgPerWeek } = getMonthStats(selectedDate, mode);

  return (
    <View className="flex-1">
      {/* Month Navigation */}
      <View className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity className="p-2" onPress={goToPreviousMonth}>
            <Text className={`text-2xl ${textColor}`}>‹</Text>
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className={`text-lg font-bold ${textColor}`}>{formatMonth(selectedDate)}</Text>
            {isThisMonth && (
              <Text className="text-brand-500 text-sm font-semibold mt-1">Today</Text>
            )}
          </View>
          <TouchableOpacity className="p-2" onPress={goToNextMonth}>
            <Text className={`text-2xl ${textColor}`}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
        {mode === 'partner' ? (
          <View className="flex-row items-center justify-center flex-wrap gap-3">
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full bg-green-300 mr-1" />
              <Text className={`text-xs ${subtextColor}`}>{'< 3h'}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full bg-yellow-300 mr-1" />
              <Text className={`text-xs ${subtextColor}`}>3-6h</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full bg-red-300 mr-1" />
              <Text className={`text-xs ${subtextColor}`}>6+ h</Text>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-center flex-wrap gap-3">
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: '#93C5FD' }} />
              <Text className={`text-xs ${subtextColor}`}>Walking</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: '#D8B4FE' }} />
              <Text className={`text-xs ${subtextColor}`}>Grooming</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: '#86EFAC' }} />
              <Text className={`text-xs ${subtextColor}`}>Sitting</Text>
            </View>
          </View>
        )}
      </View>

      {/* Calendar Grid */}
      <View className="px-6 py-4">
        {/* Day names */}
        <View className="flex-row mb-2">
          {dayNames.map((day) => (
            <View key={day} className="flex-1 items-center py-2">
              <Text className={`text-xs font-semibold ${subtextColor}`}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar dates */}
        <View className="flex-row flex-wrap">
          {monthDays.map((day, index) => {
            if (!day) {
              return <View key={`empty-${index}`} className="w-[14.28%] aspect-square p-1" />;
            }

            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const isPressedNow = pressedDay === dateStr;
            
            const colorInfo = isPressedNow ? getDayColorPressed(day, mode) : getDayColorInfo(day, mode);
            const dayColor = colorInfo.color;
            const hasData = colorInfo.hasData;
            
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <TouchableOpacity
                key={index}
                className="w-[14.28%] aspect-square p-1"
                onPressIn={() => setPressedDay(dateStr)}
                onPressOut={() => setPressedDay(null)}
                onPress={() => onDateSelect(day)}
              >
                <View
                  className="flex-1 rounded-lg items-center justify-center"
                  style={{ 
                    backgroundColor: dayColor,
                    opacity: isToday && dayColor !== 'transparent' ? 0.8 : 1
                  }}
                >
                  <Text className={`text-sm font-semibold ${hasData ? 'text-white' : textColor}`}>
                    {day.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Stats */}
      <View className={`mx-6 mt-6 p-6 rounded-2xl ${isDarkMode ? 'bg-[#1a2332]' : 'bg-gray-50'}`}>
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className={`text-3xl font-bold ${textColor}`}>{totalServices}</Text>
            <Text className={`text-xs ${subtextColor} mt-1`}>Total Services</Text>
          </View>
          <View className="items-center">
            <Text className={`text-3xl font-bold ${textColor}`}>{bookedDays}</Text>
            <Text className={`text-xs ${subtextColor} mt-1`}>Booked Days</Text>
          </View>
          <View className="items-center">
            <Text className={`text-3xl font-bold ${textColor}`}>{avgPerWeek}</Text>
            <Text className={`text-xs ${subtextColor} mt-1`}>Avg per Week</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
