import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Booking {
  id: number;
  providerName: string;
  serviceType: string;
  date: string;
  time: string;
  price: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  rating?: number;
  image: string;
}

interface BookingCardProps {
  booking: Booking;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  onViewDetails?: () => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'upcoming': return 'text-blue-600';
    case 'completed': return 'text-green-600';
    case 'cancelled': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

const getStatusText = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

export default function BookingCard({
  booking,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  onViewDetails,
}: BookingCardProps) {
  return (
    <View className={`${cardBg} rounded-2xl p-4 mb-3 border ${borderColor}`}>
      <View className="flex-row">
        <Image source={{ uri: booking.image }} className="w-20 h-20 rounded-xl mr-4" />
        <View className="flex-1">
          <View className="flex-row items-start justify-between mb-2">
            <Text className={`text-base font-semibold ${textColor} flex-1`}>{booking.providerName}</Text>
            <Text className={`text-sm font-semibold ${getStatusColor(booking.status)}`}>{getStatusText(booking.status)}</Text>
          </View>
          <Text className={`text-sm ${subtextColor} mb-2`}>{booking.serviceType}</Text>
          <View className="flex-row items-center mb-2">
            <Ionicons name="calendar-outline" size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            <Text className={`text-xs ${subtextColor} ml-1`}>{booking.date}</Text>
            <Ionicons name="time-outline" size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} style={{ marginLeft: 12 }} />
            <Text className={`text-xs ${subtextColor} ml-1`}>{booking.time}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-brand-600 text-base font-bold">${booking.price}</Text>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              {booking.rating ? (
                <View className="flex-row items-center">
                  <Ionicons name="star" size={16} color="#FFC107" />
                  <Text className={`text-sm font-semibold ${textColor} ml-1`}>{booking.rating}</Text>
                </View>
              ) : null}
              <TouchableOpacity onPress={onViewDetails}>
                <Text className="text-brand-600 font-semibold text-sm">View Details →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
