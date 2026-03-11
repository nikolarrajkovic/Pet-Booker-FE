import React from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ServiceBubble from '../../../components/shared/ServiceBubble';
import TabBar from '../../../components/shared/TabBar';
import Banner from '../../../components/shared/Banner';
import Button from '../../../components/shared/Button';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useLocation } from '../../../hooks/useLocation';
import { useTheme } from '../../../context/ThemeContext';

export default function HomeScreen() {
  const navigation = useNavigation();
  const location = useLocation();
  const { isDarkMode } = useTheme();

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-600';
  const titleColor = isDarkMode ? 'text-white' : 'text-white';
  const subtitleColor = isDarkMode ? 'text-gray-400' : 'text-brand-100';
  
  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      <View className={`${bgColor} px-6 pt-12 pb-8 rounded-b-3xl`}>
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center flex-1">
            <MaterialCommunityIcons name="map-marker" size={18} color="#ffffff" />
            {location.loading ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginLeft: 8 }} />
            ) : (
              <Text className="text-white ml-2" numberOfLines={1}>{location.address}</Text>
            )}
          </View>
          <TouchableOpacity className="p-2 bg-brand-600 rounded-full">
            <Ionicons name="notifications" size={18} color="white" />
          </TouchableOpacity>
        </View>
        <View className="items-center mt-6">
          <Text className={`text-2xl font-bold ${titleColor}`}>PawCare</Text>
          <Text className={`${subtitleColor} mt-2`}>Professional pet care at your fingertips</Text>
        </View>
      </View>

      <ScrollView className={`flex-1 -mt-8 ${contentBg} rounded-t-3xl`} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 80 }}>
        <Text className={`text-center text-sm ${textColor}`}>Select a Service</Text>
        <View className="items-center mt-6">
          <ServiceBubble label="Dog Sitting" bg="bg-blue-500" icon={<MaterialCommunityIcons name="dog-side" size={28} color="white" />} onPress={() => (navigation as any).navigate('Search', { serviceType: 'Dog Sitting' })} />
        </View>
        <View className="flex-row justify-center items-center mt-6 gap-6">
          <ServiceBubble label="Boarding" bg="bg-brand-500" icon={<MaterialCommunityIcons name="home-heart" size={28} color="white" />} onPress={() => (navigation as any).navigate('Search', { serviceType: 'Boarding' })} />
          <ServiceBubble label="Pet Hotels" bg="bg-brand-500" icon={<MaterialCommunityIcons name="office-building" size={28} color="white" />} onPress={() => (navigation as any).navigate('Search', { serviceType: 'Pet Hotels' })} />
        </View>
        <View className="mt-8">
          <Button text="View All Services" onPress={() => (navigation as any).navigate('Search')} variant="primary" />
        </View>
        <View className="mt-6 flex-row flex-wrap gap-3">
          <Banner title="Verified" description="Trusted providers" image="✨" color="emerald" size="medium" isDarkMode={isDarkMode} />
          <Banner title="Care" description="Professional service" image="💝" color="pink" size="medium" isDarkMode={isDarkMode} />
          <Banner title="Nearby" description="Local providers" image="📍" color="red" size="medium" isDarkMode={isDarkMode} />
          <Banner title="Affordable" description="Fair pricing" image="💰" color="yellow" size="medium" isDarkMode={isDarkMode} />
        </View>
        <View className="h-24" />
      </ScrollView>

      <TabBar />
    </SafeAreaView>
  );
}
