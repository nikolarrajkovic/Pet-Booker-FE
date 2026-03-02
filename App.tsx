import 'react-native-gesture-handler';
import './global.css';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/search-screen/containers/SearchScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProviderDetailScreen from './screens/ProviderDetailScreen';
import BookServiceScreen from './screens/BookServiceScreen';
import ReviewBookingScreen from './screens/ReviewBookingScreen';
import BookingConfirmedScreen from './screens/BookingConfirmedScreen';
import MyPetsScreen from './screens/MyPetsScreen';
import AddPetScreen from './screens/AddPetScreen';
import SettingsScreen from './screens/SettingsScreen';
import BecomePartnerScreen from './screens/BecomePartnerScreen';
import PartnerApplicationScreen from './screens/PartnerApplicationScreen';
import ApplicationSubmittedScreen from './screens/ApplicationSubmittedScreen';
import AccountScreen from './screens/AccountScreen';
import MyBookingsScreen from './screens/MyBookingsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { enableScreens } from 'react-native-screens';

enableScreens();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppContent() {
  const { isDarkMode } = useTheme();
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} />
          <Stack.Screen name="BookService" component={BookServiceScreen} />
          <Stack.Screen name="ReviewBooking" component={ReviewBookingScreen} />
          <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />
          <Stack.Screen name="MyPets" component={MyPetsScreen} />
          <Stack.Screen name="AddPet" component={AddPetScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="BecomePartner" component={BecomePartnerScreen} />
          <Stack.Screen name="PartnerApplication" component={PartnerApplicationScreen} />
          <Stack.Screen name="ApplicationSubmitted" component={ApplicationSubmittedScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={isDarkMode ? "light" : "auto"} />
    </GestureHandlerRootView>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: 'none' },
        unmountOnBlur: true,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <Ionicons name="home" size={size} color={color} />;
          if (route.name === 'Search') return <Ionicons name="search" size={size} color={color} />;
          return <Ionicons name="person" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
