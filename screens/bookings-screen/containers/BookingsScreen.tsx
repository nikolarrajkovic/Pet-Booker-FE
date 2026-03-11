import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import TabBar from '../../../components/shared/TabBar';

export default function BookingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center">
      <View>
        <Text className="text-lg font-semibold">Bookings</Text>
      </View>
      <TabBar />
    </SafeAreaView>
  );
}
