import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { getServicesForDate, getDayColorInfo, getDayColorPressed, ServiceItem } from '../utils/mockScheduleData';

interface WeekViewProps {
  selectedDate: Date;
  isDarkMode: boolean;
  onDateSelect: (date: Date) => void;
  onDateChange: (date: Date) => void;
}

const getTypeColor = (type: string) => {
  switch (type) {
    case 'walking': return '#3B82F6';
    case 'grooming': return '#A855F7';
    case 'sitting': return '#10B981';
    default: return '#6B7280';
  }
};

const getTypeBg = (type: string, isDarkMode: boolean) => {
  switch (type) {
    case 'walking': return isDarkMode ? 'bg-blue-300/30' : 'bg-blue-100';
    case 'grooming': return isDarkMode ? 'bg-purple-300/30' : 'bg-purple-100';
    case 'sitting': return isDarkMode ? 'bg-green-300/30' : 'bg-green-100';
    default: return isDarkMode ? 'bg-gray-500/30' : 'bg-gray-100';
  }
};

const formatWeekRange = (date: Date) => {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${months[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${months[endOfWeek.getMonth()]} ${endOfWeek.getDate()}`;
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
  return weekDays.some(day => day.toDateString() === today.toDateString());
};

export default function WeekView({ selectedDate, isDarkMode, onDateSelect, onDateChange }: WeekViewProps) {
  const [pressedDay, setPressedDay] = useState<string | null>(null);
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';

  const weekDays = getWeekDays(selectedDate);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      <View className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity className="p-2" onPress={goToPreviousWeek}>
            <Text className={`text-2xl ${textColor}`}>‹</Text>
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className={`text-lg font-bold ${textColor}`}>{formatWeekRange(selectedDate)}</Text>
            {isThisWeek && (
              <Text className="text-brand-500 text-sm font-semibold mt-1">Today</Text>
            )}
          </View>
          <TouchableOpacity className="p-2" onPress={goToNextWeek}>
            <Text className={`text-2xl ${textColor}`}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
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
          <View className="flex-row items-center">
            <View className="w-3 h-3 rounded-full bg-blue-300 mr-1" />
            <Text className={`text-xs ${subtextColor}`}>Using service</Text>
          </View>
        </View>
      </View>

      {/* Week Calendar */}
      <View className="px-6 py-4">
        <View className="flex-row mb-4">
          {dayNames.map((day, index) => (
            <View key={day} className="flex-1 items-center">
              <Text className={`text-xs ${subtextColor} mb-2`}>{day}</Text>
            </View>
          ))}
        </View>

        <View className="flex-row mb-6">
          {weekDays.map((day, index) => {
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const services = getServicesForDate(day);
            const hasServices = services.length > 0;
            const isToday = day.toDateString() === new Date().toDateString();
            const isPressedNow = pressedDay === dateStr;
            
            const colorInfo = isPressedNow ? getDayColorPressed(day) : getDayColorInfo(day);
            const dayColor = colorInfo.color;
            
            return (
              <TouchableOpacity
                key={index}
                className="flex-1 items-center"
                onPressIn={() => setPressedDay(dateStr)}
                onPressOut={() => setPressedDay(null)}
                onPress={() => onDateSelect(day)}
              >
                <View
                  className="w-10 h-10 rounded-lg items-center justify-center"
                  style={{ 
                    backgroundColor: dayColor,
                    opacity: isToday && dayColor !== 'transparent' ? 0.8 : 1
                  }}
                >
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
          const services = getServicesForDate(day);
          
          if (services.length === 0) return null;
          
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          
          return (
            <View key={index} className="mb-6">
              <Text className={`text-sm font-bold ${textColor} mb-3`}>
                {dayNames[day.getDay()]}, {months[day.getMonth()]} {day.getDate()}
              </Text>
              
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  className={`${cardBg} rounded-xl p-3 mb-2 flex-row items-center justify-between`}
                  onPress={() => onDateSelect(day)}
                >
                  <View className="flex-1">
                    <Text className={`text-sm font-semibold ${textColor}`}>{service.title}</Text>
                    <Text className={`text-xs ${subtextColor} mt-1`}>
                      {service.time} • {service.petName}
                    </Text>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${getTypeBg(service.type, isDarkMode)}`}>
                    <Text className="text-xs font-medium" style={{ color: getTypeColor(service.type) }}>
                      {service.type}
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
