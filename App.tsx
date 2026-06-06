import 'react-native-gesture-handler';
import './global.css';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/home-screen/containers/HomeScreen';
import SearchScreen from './screens/search-screen/containers/SearchScreen';
import ProfileScreen from './screens/profile-screen/containers/ProfileScreen';
import ProviderDetailScreen from './screens/provider-detail-screen/containers/ProviderDetailScreen';
import BookServiceScreen from './screens/book-service-screen/containers/BookServiceScreen';
import ReviewBookingScreen from './screens/review-booking-screen/containers/ReviewBookingScreen';
import BookingConfirmedScreen from './screens/booking-confirmed-screen/containers/BookingConfirmedScreen';
import MyPetsScreen from './screens/my-pets-screen/containers/MyPetsScreen';
import AddPetScreen from './screens/add-pet-screen/containers/AddPetScreen';
import SettingsScreen from './screens/settings-screen/containers/SettingsScreen';
import BecomePartnerScreen from './screens/become-partner-screen/containers/BecomePartnerScreen';
import PartnerApplicationScreen from './screens/partner-application-screen/containers/PartnerApplicationScreen';
import ApplicationSubmittedScreen from './screens/application-submitted-screen/containers/ApplicationSubmittedScreen';
import AccountScreen from './screens/account-screen/containers/AccountScreen';
import MyBookingsScreen from './screens/my-bookings-screen/containers/MyBookingsScreen';
import MyScheduleScreen from './screens/my-schedule-screen/containers/MyScheduleScreen';
import MyServicesScreen from './screens/my-services-screen/containers/MyServicesScreen';
import AddEditServiceScreen from './screens/my-services-screen/containers/AddEditServiceScreen';
import ServicePreviewScreen from './screens/service-preview-screen/containers/ServicePreviewScreen';
import NotificationsScreen from './screens/notifications-screen/containers/NotificationsScreen';
import NewRequestsScreen from './screens/new-requests-screen/containers/NewRequestsScreen';
import PartnerHubScreen from './screens/partner-hub-screen/containers/PartnerHubScreen';
import PromotionsScreen from './screens/promotions-screen/containers/PromotionsScreen';
import AdminDashboardScreen from './screens/admin-dashboard-screen/containers/AdminDashboardScreen';
import AdminNewRequestsScreen from './screens/admin-new-requests-screen/containers/AdminNewRequestsScreen';
import ApplicationReviewScreen from './screens/admin-new-requests-screen/containers/ApplicationReviewScreen';
import AdminPartnersScreen from './screens/admin-partners-screen/containers/AdminPartnersScreen';
import PartnerDetailsScreen from './screens/admin-partners-screen/containers/PartnerDetailsScreen';
import AdminAddPartnerScreen from './screens/admin-add-partner-screen/containers/AdminAddPartnerScreen';
import LoginScreen from './screens/login-screen/containers/LoginScreen';
import RegisterScreen from './screens/register-screen/containers/RegisterScreen';
import VerifyEmailScreen from './screens/verify-email-screen/containers/VerifyEmailScreen';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EnumsProvider } from './context/EnumsContext';
import { Ionicons } from '@expo/vector-icons';
import { enableScreens } from 'react-native-screens';

enableScreens();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppContent() {
  const { isDarkMode } = useTheme();
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#0f1621' : '#ffffff' }}>
        <ActivityIndicator size="large" color="#00A85A" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isLoggedIn ? (
            <>
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
              <Stack.Screen name="MySchedule" component={MyScheduleScreen} />
              <Stack.Screen name="MyServices" component={MyServicesScreen} />
              <Stack.Screen name="AddEditService" component={AddEditServiceScreen} />
              <Stack.Screen name="ServicePreview" component={ServicePreviewScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="NewRequests" component={NewRequestsScreen} />
              <Stack.Screen name="Promotions" component={PromotionsScreen} />
              <Stack.Screen name="AdminNewRequests" component={AdminNewRequestsScreen} />
              <Stack.Screen name="ApplicationReview" component={ApplicationReviewScreen} />
              <Stack.Screen name="AdminPartners" component={AdminPartnersScreen} />
              <Stack.Screen name="PartnerDetails" component={PartnerDetailsScreen} />
              <Stack.Screen name="AdminAddPartner" component={AdminAddPartnerScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            </>
          )}
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
          if (route.name === 'PartnerHub') return <Ionicons name="briefcase-outline" size={size} color={color} />;
          return <Ionicons name="person" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="PartnerHub" component={PartnerHubScreen} />
      <Tab.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <EnumsProvider>
          <AppContent />
        </EnumsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
