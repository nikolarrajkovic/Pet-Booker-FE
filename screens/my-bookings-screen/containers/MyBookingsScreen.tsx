import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { BookingCard } from '../components';

type Booking = {
  id: number;
  providerName: string;
  serviceType: string;
  date: string;
  time: string;
  price: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  rating?: number;
  image: string;
};

const bookingsData: Booking[] = [
  { id: 1, providerName: 'Pampered Pet...', serviceType: 'Grooming', date: 'Dec 15, 2024', time: '10:00 AM', price: 55, status: 'upcoming', image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=200' },
  { id: 2, providerName: 'Happy Paws ...', serviceType: 'Dog Walking', date: 'Dec 1, 2024', time: '2:00 PM', price: 30, status: 'completed', rating: 5.0, image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200' },
  { id: 3, providerName: 'Cozy Pet Hotel', serviceType: 'Pet Sitting', date: 'Nov 20, 2024', time: '9:00 AM', price: 85, status: 'completed', rating: 4.0, image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=200' },
  { id: 4, providerName: 'Fur-Ever Friends', serviceType: 'Dog Walking', date: 'Nov 10, 2024', time: '4:00 PM', price: 30, status: 'cancelled', image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=200' },
  { id: 5, providerName: 'Luxury Pet Gr...', serviceType: 'Grooming', date: 'Oct 28, 2024', time: '11:00 AM', price: 65, status: 'completed', rating: 5.0, image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=200' },
];

export default function MyBookingsScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-100';

  const upcomingBookings = bookingsData.filter(b => b.status === 'upcoming');
  const pastBookings = bookingsData.filter(b => b.status !== 'upcoming');

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <View className="bg-brand-500 px-6 pt-12 pb-6">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">My Bookings</Text>
        </View>
      </View>

      <ScrollView className={`flex-1 ${bgColor}`} contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}>
        <View className="px-6 mb-4">
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => setActiveTab('upcoming')}
              className={`flex-1 py-3 border-b-2 ${activeTab === 'upcoming' ? 'border-brand-500' : `border-gray-300 ${isDarkMode ? 'border-gray-700' : ''}`}`}
            >
              <Text className={`text-center font-semibold ${activeTab === 'upcoming' ? 'text-brand-600' : subtextColor}`}>Upcoming</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('past')}
              className={`flex-1 py-3 border-b-2 ${activeTab === 'past' ? 'border-brand-500' : `border-gray-300 ${isDarkMode ? 'border-gray-700' : ''}`}`}
            >
              <Text className={`text-center font-semibold ${activeTab === 'past' ? 'text-brand-600' : subtextColor}`}>Past Bookings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-6">
          {activeTab === 'upcoming' ? (
            upcomingBookings.length > 0 ? (
              upcomingBookings.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  isDarkMode={isDarkMode}
                  cardBg={cardBg}
                  textColor={textColor}
                  subtextColor={subtextColor}
                  borderColor={borderColor}
                />
              ))
            ) : (
              <View className="items-center justify-center py-12">
                <Ionicons name="calendar-outline" size={64} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                <Text className={`${subtextColor} text-center mt-4`}>No upcoming bookings</Text>
              </View>
            )
          ) : (
            <>
              <Text className={`text-sm ${subtextColor} mb-3`}>{pastBookings.length} bookings</Text>
              {pastBookings.map(booking => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  isDarkMode={isDarkMode}
                  cardBg={cardBg}
                  textColor={textColor}
                  subtextColor={subtextColor}
                  borderColor={borderColor}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
