import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

interface CalendarPickerProps {
  selectedDate: number | null;
  setSelectedDate: (date: number) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  calendarDays: (number | null)[];
  weekDays: string[];
  timeSlots: TimeSlot[];
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
  borderColor: string;
}

export default function CalendarPicker({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  calendarDays,
  weekDays,
  timeSlots,
  isDarkMode,
  textColor,
  subtextColor,
  borderColor,
}: CalendarPickerProps) {
  return (
    <View className={`px-6 py-5 border-t ${borderColor}`}>
      <View className="flex-row items-center mb-4">
        <View className={`w-6 h-6 rounded-full items-center justify-center ${selectedDate && selectedTime ? 'bg-brand-500' : 'bg-gray-300'}`}>
          {selectedDate && selectedTime ? (
            <Ionicons name="checkmark" size={16} color="white" />
          ) : (
            <Text className="text-white text-xs font-bold">3</Text>
          )}
        </View>
        <Text className={`text-base font-semibold ${textColor} ml-3`}>Choose Date & Time</Text>
      </View>

      {/* Calendar */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity>
            <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
          <Text className={`text-base font-semibold ${textColor}`}>November 2025</Text>
          <TouchableOpacity>
            <Ionicons name="chevron-forward" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
        </View>

        {/* Week days header */}
        <View className="flex-row mb-2">
          {weekDays.map(day => (
            <View key={day} className="flex-1 items-center">
              <Text className={`text-xs font-medium ${subtextColor}`}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View className="flex-row flex-wrap">
          {calendarDays.map((day, index) => (
            <View key={index} className="w-[14.28%] aspect-square p-1">
              {day !== null ? (
                <TouchableOpacity
                  onPress={() => setSelectedDate(day)}
                  disabled={day < 26}
                  className={`flex-1 items-center justify-center rounded-full ${
                    selectedDate === day
                      ? 'bg-brand-500'
                      : 'bg-transparent'
                  }`}
                >
                  <Text className={`text-sm ${
                    selectedDate === day
                      ? 'text-white font-bold'
                      : day < 26
                      ? isDarkMode ? 'text-gray-700' : 'text-gray-300'
                      : textColor
                  }`}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View className="flex-1" />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Available Times */}
      {selectedDate && (
        <View className="mt-4">
          <Text className={`text-base font-semibold ${textColor} mb-3`}>Available Times</Text>
          <View className="flex-row flex-wrap gap-2">
            {timeSlots.map(slot => (
              <TouchableOpacity
                key={slot.id}
                onPress={() => slot.available && setSelectedTime(slot.id)}
                disabled={!slot.available}
                className={`px-6 py-3 rounded-xl ${
                  selectedTime === slot.id
                    ? 'bg-brand-500'
                    : slot.available
                    ? isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
                    : isDarkMode ? 'bg-[#1a2332]' : 'bg-gray-50'
                }`}
              >
                <Text className={`text-sm font-medium ${
                  selectedTime === slot.id
                    ? 'text-white'
                    : slot.available
                    ? 'text-brand-600'
                    : isDarkMode ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {slot.time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
