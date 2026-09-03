import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import { getErrorMessage } from '../../../services/http';
import DayView from '../components/DayView';
import WeekView from '../components/WeekView';
import MonthView from '../components/MonthView';
import {
  ScheduleMode,
  buildScheduleFromBookings,
  setLiveScheduleData,
  clearLiveScheduleData,
} from '../utils/scheduleData';
import { getBookings } from '../../../services/bookings';
import { useResponsive } from '../../../hooks/useResponsive';

type ViewType = 'day' | 'week' | 'month';

export default function MyScheduleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser } = useAuth();
  const { isDarkMode, bgColor: contentBg, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  const [selectedView, setSelectedView] = useState<ViewType>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [, setDataVersion] = useState(0); // bumped after live data loads to re-render the views
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine mode from navigation params; default to 'partner' for backward compat
  const mode: ScheduleMode = (route.params as any)?.mode ?? 'partner';

  // Load real bookings into the schedule source on focus; clear on blur.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setError(null);
      (async () => {
        try {
          let bookings;
          if (mode === 'user') {
            bookings = currentUser?.id ? await getBookings({ userId: currentUser.id }) : [];
          } else {
            const providerId = currentUser?.serviceProviderId || null;
            bookings = providerId ? await getBookings({ serviceProviderId: providerId }) : [];
          }
          if (cancelled) return;
          setLiveScheduleData(buildScheduleFromBookings(bookings, mode));
          setDataVersion((v) => v + 1);
        } catch (e) {
          // Inline, not a toast: this is a fetch-on-mount failure, and the calendar behind it is
          // now EMPTY rather than filled with invented appointments — so the screen has to say why.
          if (!cancelled) setError(getErrorMessage(e, t('schedule.loadFailed')));
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
        clearLiveScheduleData();
      };
    }, [mode, currentUser?.id, currentUser?.serviceProviderId])
  );

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedView('day');
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const title = t('schedule.title');

  return (
    <ScreenLayout
      headerVariant="large"
      contentBg={contentBg}
      // A calendar wants width — a week view squeezed into 720px is why the day view exists.
      width="wide"
      headerTitle={isWebLayout ? title : undefined}
      showBackButton={!isWebLayout}
      headerChildren={
        isWebLayout ? undefined : (
          <View className="mb-4 flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="flex-1 text-2xl font-bold text-white">{title}</Text>
          </View>
        )
      }>
      <View className="flex-1">
        {/* Tab Selector */}
        <View className={`${isWebLayout ? contentBg : bgColor} px-6 py-4`}>
          <View
            className={`flex-row rounded-xl p-1 ${isWebLayout ? (isDarkMode ? 'bg-[#243447]' : 'bg-gray-100') : 'bg-white/20'}`}>
            <TouchableOpacity
              className={`flex-1 rounded-lg py-2 ${selectedView === 'day' ? 'bg-white' : ''}`}
              onPress={() => setSelectedView('day')}>
              <Text
                className={`text-center font-semibold ${selectedView === 'day' ? 'text-brand-600' : isWebLayout ? subtextColor : 'text-white'}`}>
                {t('schedule.day')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-lg py-2 ${selectedView === 'week' ? 'bg-white' : ''}`}
              onPress={() => setSelectedView('week')}>
              <Text
                className={`text-center font-semibold ${selectedView === 'week' ? 'text-brand-600' : isWebLayout ? subtextColor : 'text-white'}`}>
                {t('schedule.week')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-lg py-2 ${selectedView === 'month' ? 'bg-white' : ''}`}
              onPress={() => setSelectedView('month')}>
              <Text
                className={`text-center font-semibold ${selectedView === 'month' ? 'text-brand-600' : isWebLayout ? subtextColor : 'text-white'}`}>
                {t('schedule.month')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View Content */}
        <ScrollView className="flex-1">
          {isLoading ? (
            <View className="items-center justify-center py-16">
              <ActivityIndicator size="large" color={BRAND_GREEN} />
            </View>
          ) : error ? (
            <View className="items-center justify-center py-16">
              <Ionicons
                name="alert-circle-outline"
                size={56}
                color={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
              <Text
                className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-4 px-8 text-center`}>
                {error}
              </Text>
            </View>
          ) : (
            <>
              {selectedView === 'day' && (
                <DayView
                  selectedDate={selectedDate}
                  isDarkMode={isDarkMode}
                  onDateChange={handleDateChange}
                  mode={mode}
                />
              )}
              {selectedView === 'week' && (
                <WeekView
                  selectedDate={selectedDate}
                  isDarkMode={isDarkMode}
                  onDateSelect={handleDateSelect}
                  onDateChange={handleDateChange}
                  mode={mode}
                />
              )}
              {selectedView === 'month' && (
                <MonthView
                  selectedDate={selectedDate}
                  isDarkMode={isDarkMode}
                  onDateSelect={handleDateSelect}
                  onDateChange={handleDateChange}
                  mode={mode}
                />
              )}
            </>
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}
