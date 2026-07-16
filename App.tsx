import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './global.css';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/home-screen/containers/HomeScreen';
import SearchScreen from './screens/search-screen/containers/SearchScreen';
import ProfileScreen from './screens/profile-screen/containers/ProfileScreen';
import ProviderDetailScreen from './screens/provider-detail-screen/containers/ProviderDetailScreen';
import ServiceDetailScreen from './screens/service-detail-screen/containers/ServiceDetailScreen';
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
import ChangePasswordScreen from './screens/change-password-screen/containers/ChangePasswordScreen';
import ForgotPasswordScreen from './screens/forgot-password-screen/containers/ForgotPasswordScreen';
import MyBookingsScreen from './screens/my-bookings-screen/containers/MyBookingsScreen';
import BookingDetailsScreen from './screens/booking-details-screen/containers/BookingDetailsScreen';
import MyScheduleScreen from './screens/my-schedule-screen/containers/MyScheduleScreen';
import MyServicesScreen from './screens/my-services-screen/containers/MyServicesScreen';
import AddEditServiceScreen from './screens/my-services-screen/containers/AddEditServiceScreen';
import ServicePreviewScreen from './screens/service-preview-screen/containers/ServicePreviewScreen';
import NotificationsScreen from './screens/notifications-screen/containers/NotificationsScreen';
import NotificationSettingsScreen from './screens/notifications-screen/containers/NotificationSettingsScreen';
import NewRequestsScreen from './screens/new-requests-screen/containers/NewRequestsScreen';
import LiveSessionScreen from './screens/live-session-screen/containers/LiveSessionScreen';
import PartnerHubScreen from './screens/partner-hub-screen/containers/PartnerHubScreen';
import PartnerWelcomeScreen from './screens/partner-welcome-screen/containers/PartnerWelcomeScreen';
import PromotionsScreen from './screens/promotions-screen/containers/PromotionsScreen';
import CreatePromotionScreen from './screens/promotions-screen/containers/CreatePromotionScreen';
import EditPromotionScreen from './screens/promotions-screen/containers/EditPromotionScreen';
import PromotionAnalyticsScreen from './screens/promotions-screen/containers/PromotionAnalyticsScreen';
import AdminDashboardScreen from './screens/admin-dashboard-screen/containers/AdminDashboardScreen';
import AdminNewRequestsScreen from './screens/admin-new-requests-screen/containers/AdminNewRequestsScreen';
import ApplicationReviewScreen from './screens/admin-new-requests-screen/containers/ApplicationReviewScreen';
import AdminPartnersScreen from './screens/admin-partners-screen/containers/AdminPartnersScreen';
import AdminReviewsScreen from './screens/admin-reviews-screen/containers/AdminReviewsScreen';
import PartnerDetailsScreen from './screens/admin-partners-screen/containers/PartnerDetailsScreen';
import AdminAddPartnerScreen from './screens/admin-add-partner-screen/containers/AdminAddPartnerScreen';
import LoginScreen from './screens/login-screen/containers/LoginScreen';
import RegisterScreen from './screens/register-screen/containers/RegisterScreen';
import VerifyEmailScreen from './screens/verify-email-screen/containers/VerifyEmailScreen';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LocaleProvider, useLocale } from './context/LocaleContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { EnumsProvider } from './context/EnumsContext';
import LanguagePicker from './components/shared/LanguagePicker';
import { hasSeenPartnerWelcome, markPartnerWelcomeSeen } from './services/onboarding';
import { Ionicons } from '@expo/vector-icons';
import { enableScreens } from 'react-native-screens';

enableScreens();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppContent() {
  const { isDarkMode } = useTheme();
  const { hasChosen, isLoading: localeLoading, language, setLanguage } = useLocale();
  const { isLoggedIn, isLoading, isPartner, currentUser } = useAuth();
  const navigationRef = useNavigationContainerRef();
  const [navReady, setNavReady] = useState(false);

  // Celebrate once, the first time we observe a user is an approved partner
  // (the backend adds them to the ServiceProvider group → `isPartner` flips
  // true on the next getMe). A per-user flag keeps it to a single showing.
  const userId = currentUser?.id;
  useEffect(() => {
    if (!navReady || !isLoggedIn || !isPartner || !userId) return;
    let cancelled = false;
    (async () => {
      if (await hasSeenPartnerWelcome(userId)) return;
      if (cancelled) return;
      await markPartnerWelcomeSeen(userId);
      if (!cancelled) (navigationRef as any).navigate('PartnerWelcome');
    })();
    return () => {
      cancelled = true;
    };
  }, [navReady, isLoggedIn, isPartner, userId, navigationRef]);

  if (isLoading || localeLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#0f1621' : '#ffffff',
        }}>
        <ActivityIndicator size="large" color="#00A85A" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 250,
          }}>
          {isLoggedIn ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
              <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} />
              <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
              <Stack.Screen name="BookService" component={BookServiceScreen} />
              <Stack.Screen name="ReviewBooking" component={ReviewBookingScreen} />
              <Stack.Screen
                name="BookingConfirmed"
                component={BookingConfirmedScreen}
                options={{ animation: 'fade' }}
              />
              <Stack.Screen name="MyPets" component={MyPetsScreen} />
              <Stack.Screen
                name="AddPet"
                component={AddPetScreen}
                options={{ animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="BecomePartner" component={BecomePartnerScreen} />
              <Stack.Screen name="PartnerApplication" component={PartnerApplicationScreen} />
              <Stack.Screen
                name="ApplicationSubmitted"
                component={ApplicationSubmittedScreen}
                options={{ animation: 'fade' }}
              />
              <Stack.Screen
                name="PartnerWelcome"
                component={PartnerWelcomeScreen}
                options={{ animation: 'fade', gestureEnabled: false }}
              />
              <Stack.Screen name="Account" component={AccountScreen} />
              <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
              <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
              <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
              <Stack.Screen name="MySchedule" component={MyScheduleScreen} />
              <Stack.Screen name="MyServices" component={MyServicesScreen} />
              <Stack.Screen
                name="AddEditService"
                component={AddEditServiceScreen}
                options={{ animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="ServicePreview"
                component={ServicePreviewScreen}
                options={{ animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              <Stack.Screen name="NewRequests" component={NewRequestsScreen} />
              <Stack.Screen name="LiveSession" component={LiveSessionScreen} />
              <Stack.Screen name="Promotions" component={PromotionsScreen} />
              <Stack.Screen
                name="CreatePromotion"
                component={CreatePromotionScreen}
                options={{ animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="EditPromotion" component={EditPromotionScreen} />
              <Stack.Screen name="PromotionAnalytics" component={PromotionAnalyticsScreen} />
              <Stack.Screen name="AdminNewRequests" component={AdminNewRequestsScreen} />
              <Stack.Screen name="ApplicationReview" component={ApplicationReviewScreen} />
              <Stack.Screen name="AdminPartners" component={AdminPartnersScreen} />
              <Stack.Screen name="AdminReviews" component={AdminReviewsScreen} />
              <Stack.Screen name="PartnerDetails" component={PartnerDetailsScreen} />
              <Stack.Screen name="AdminAddPartner" component={AdminAddPartnerScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {/* First-run language chooser — asks the user before they interact. */}
      <LanguagePicker visible={!hasChosen} current={language} onSelect={setLanguage} />
      <StatusBar style={isDarkMode ? 'light' : 'auto'} />
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
        animation: 'fade',
        unmountOnBlur: true,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <Ionicons name="home" size={size} color={color} />;
          if (route.name === 'Search') return <Ionicons name="search" size={size} color={color} />;
          if (route.name === 'PartnerHub')
            return <Ionicons name="briefcase-outline" size={size} color={color} />;
          return <Ionicons name="person" size={size} color={color} />;
        },
      })}>
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
      <LocaleProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationsProvider>
              <EnumsProvider>
                <AppContent />
              </EnumsProvider>
            </NotificationsProvider>
          </AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
