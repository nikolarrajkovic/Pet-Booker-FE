import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EnableNotificationsCardProps {
  isDarkMode: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

export default function EnableNotificationsCard({ isDarkMode, onEnable, onDismiss }: EnableNotificationsCardProps) {
  const enableModalBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-green-50';

  return (
    <View className={`${enableModalBg} mx-4 mt-4 rounded-2xl p-6 border ${isDarkMode ? 'border-[#243447]' : 'border-green-100'}`}>
      <View className="items-center mb-4">
        <View className="w-16 h-16 rounded-full bg-brand-500 items-center justify-center mb-3">
          <Ionicons name="notifications" size={28} color="white" />
        </View>
        <Text className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-[#1a365d]'} mb-2`}>Enable Push Notifications</Text>
        <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center`}>
          Stay updated with booking confirmations, reminders, and messages from your pet care providers.
        </Text>
      </View>
      <TouchableOpacity className="bg-brand-500 py-3 rounded-xl mb-2" onPress={onEnable}>
        <Text className="text-white text-center font-semibold text-base">Enable Notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} className="py-2">
        <Text className={`text-center font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Maybe Later</Text>
      </TouchableOpacity>
    </View>
  );
}
