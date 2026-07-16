import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
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
} from '../utils/mockScheduleData';
import { getBookings } from '../../../services/bookings';

type ViewType = 'day' | 'week' | 'month';

export default function MyScheduleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser } = useAuth();
  const { isDarkMode, bgColor: contentBg } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  const [selectedView, setSelectedView] = useState<ViewType>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [, setDataVersion] = useState(0); // bumped after live data loads to re-render the views

  // Determine mode from navigation params; default to 'partner' for backward compat
  const mode: ScheduleMode = (route.params as any)?.mode ?? 'partner';

  // Load real bookings into the schedule source on focus; clear on blur.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
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
          if (!cancelled) showError(getErrorMessage(e, t('schedule.loadFailed')));
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
      headerChildren={
        <View className="mb-4 flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="flex-1 text-2xl font-bold text-white">{title}</Text>
        </View>
      }>
      <View className="flex-1">
        {/* Tab Selector */}
        <View className={`${bgColor} px-6 py-4`}>
          <View className="flex-row rounded-xl bg-white/20 p-1">
            <TouchableOpacity
              className={`flex-1 rounded-lg py-2 ${selectedView === 'day' ? 'bg-white' : ''}`}
              onPress={() => setSelectedView('day')}>
              <Text
                className={`text-center font-semibold ${selectedView === 'day' ? 'text-brand-600' : 'text-white'}`}>
                {t('schedule.day')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-lg py-2 ${selectedView === 'week' ? 'bg-white' : ''}`}
              onPress={() => setSelectedView('week')}>
              <Text
                className={`text-center font-semibold ${selectedView === 'week' ? 'text-brand-600' : 'text-white'}`}>
                {t('schedule.week')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-lg py-2 ${selectedView === 'month' ? 'bg-white' : ''}`}
              onPress={() => setSelectedView('month')}>
              <Text
                className={`text-center font-semibold ${selectedView === 'month' ? 'text-brand-600' : 'text-white'}`}>
                {t('schedule.month')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View Content */}
        <ScrollView className="flex-1">
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
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}
