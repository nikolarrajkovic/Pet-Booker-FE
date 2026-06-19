import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

export type TimeSlot = {
  id: string; // e.g. "09:00"
  label: string; // e.g. "09:00 AM"
  start: Date; // exact slot start
  available: boolean;
};

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: TimeSlot) => void;
  isLoading: boolean;
  isDarkMode: boolean;
  textColor: string;
  subtextColor: string;
}

/**
 * Grid of bookable time slots for the selected date. Unavailable slots
 * (already booked, or in the past) are greyed out and disabled.
 * Restored from the pre-Phase-2 CalendarPicker (git 9e63747~1), now backed by
 * real availability computed in BookServiceScreen.
 */
export default function TimeSlotPicker({
  slots,
  selectedSlotId,
  onSelectSlot,
  isLoading,
  isDarkMode,
  textColor,
  subtextColor,
}: TimeSlotPickerProps) {
  return (
    <View className="mt-4">
      <Text className={`text-base font-semibold ${textColor} mb-3`}>Available Times</Text>
      {isLoading ? (
        <View className="items-center py-6">
          <ActivityIndicator color="#00C870" />
          <Text className={`text-xs ${subtextColor} mt-2`}>Checking availability…</Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {slots.map((slot) => (
            <TouchableOpacity
              key={slot.id}
              onPress={() => slot.available && onSelectSlot(slot)}
              disabled={!slot.available}
              // Uniform width (3 per row) so columns stay aligned regardless of label length
              style={{ flexBasis: '30%', flexGrow: 1 }}
              className={`items-center rounded-xl py-3 ${
                selectedSlotId === slot.id
                  ? 'bg-brand-500'
                  : slot.available
                    ? isDarkMode
                      ? 'bg-[#243447]'
                      : 'bg-gray-100'
                    : isDarkMode
                      ? 'bg-[#1a2332]'
                      : 'bg-gray-50'
              }`}>
              <Text
                className={`text-sm font-medium ${
                  selectedSlotId === slot.id
                    ? 'text-white'
                    : slot.available
                      ? 'text-brand-600'
                      : isDarkMode
                        ? 'text-gray-700'
                        : 'text-gray-300'
                }`}>
                {slot.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {!isLoading && slots.length === 0 && (
        <Text className={`text-sm ${subtextColor} mt-1`}>
          The provider isn&apos;t available on this day — please pick another day.
        </Text>
      )}
      {!isLoading && slots.length > 0 && slots.every((s) => !s.available) && (
        <Text className={`text-sm ${subtextColor} mt-3`}>
          No free slots on this date — please pick another day.
        </Text>
      )}
    </View>
  );
}
