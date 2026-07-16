import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WhileYouWaitCardProps {
  isDarkMode: boolean;
}

export default function WhileYouWaitCard({ isDarkMode }: WhileYouWaitCardProps) {
  const tips = [
    'Check your email regularly for updates',
    'Prepare your service space and materials',
    'Review our provider guidelines and best practices',
  ];

  return (
    <View
      className={`${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'} rounded-2xl border p-5 ${isDarkMode ? 'border-green-800' : 'border-green-200'}`}>
      <Text
        className={`text-base font-semibold ${isDarkMode ? 'text-green-200' : 'text-green-900'} mb-3`}>
        While You Wait
      </Text>
      {tips.map((tip, index) => (
        <View
          key={index}
          className={`flex-row items-start ${index < tips.length - 1 ? 'mb-2' : ''}`}>
          <Ionicons
            name="checkmark-circle"
            size={20}
            color="#00C870"
            style={{ marginTop: 2, marginRight: 8 }}
          />
          <Text className={`flex-1 text-sm ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
            {tip}
          </Text>
        </View>
      ))}
    </View>
  );
}
