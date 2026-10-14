import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { useThemeColors } from '../../../hooks/useThemeColors';
import PetLoader from '../../../components/shared/PetLoader';
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
import {
  getAllBookings,
  formatBookingDate,
  BookingState,
  BookingSortBy,
} from '../../../services/bookings';
import { useResponsive } from '../../../hooks/useResponsive';
import { usePageGutter } from '../../../hooks/usePageGutter';

type ViewType = 'day' | 'week' | 'month';

export default function MyScheduleScreen() {
  const gutter = usePageGutter();
  const route = useRoute();
  const { currentUser } = useAuth();
  const { isDarkMode, bgColor: contentBg, subtextColor, cardBg, borderColor } = useThemeColors();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  const [selectedView, setSelectedView] = useState<ViewType>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [, setDataVersion] = useState(0); // bumped after live data loads to re-render the views
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine mode from navigation params; default to 'partner' for backward compat
  const mode: ScheduleMode = (route.params as any)?.mode ?? 'partner';

  // The month on screen. Bookings are fetched for it (plus a week either side, which a week view
  // crossing a month boundary shows) rather than "the first 50 of all time" — which, past an
  // account's 50th booking, left every newer appointment off the calendar.
  const monthKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}`;

  // Load real bookings into the schedule source on focus; clear on blur.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      setError(null);
      (async () => {
        try {
          const [year, month] = monthKey.split('-').map(Number);
          const rangeStart = new Date(year, month, 1 - 7);
          const rangeEnd = new Date(year, month + 1, 1 + 7);
          const window = {
            bookingFrom: formatBookingDate(rangeStart),
            bookingTo: formatBookingDate(rangeEnd),
            sortBy: BookingSortBy.SoonestFirst,
          };
          let bookings;
          if (mode === 'user') {
            bookings = currentUser?.id
              ? await getAllBookings({
                  userId: currentUser.id,
                  // Own requests show too, until they are answered or expire.
                  states: [
                    BookingState.Upcoming,
                    BookingState.Accepted,
                    BookingState.InProgress,
                    BookingState.Completed,
                  ],
                  ...window,
                })
              : [];
          } else {
            const providerId = currentUser?.serviceProviderId || null;
            bookings = providerId
              ? await getAllBookings({
                  serviceProviderId: providerId,
                  // Requests live in New Requests until accepted.
                  states: [BookingState.Accepted, BookingState.InProgress, BookingState.Completed],
                  ...window,
                })
              : [];
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
    }, [mode, currentUser?.id, currentUser?.serviceProviderId, t, monthKey])
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
      // The standard header, as on every other pushed screen: the title centred beside the one
      // back button. This screen used to add its own arrow-and-title row under the header's, so
      // the phone showed two back buttons stacked on top of each other.
      headerVariant="standard"
      contentBg={contentBg}
      // A calendar wants width — a week view squeezed into 720px is why the day view exists.
      width="wide"
      headerTitle={title}
      showBackButton>
      <View className="flex-1">
        {/* Tab Selector. On a phone it sits in the green header; on the web design it is its own
            white card with the chosen view in solid green — it used to be a grey strip on the
            paw pattern with a white pill, which read as unstyled. */}
        <View className={`${isWebLayout ? contentBg : bgColor} ${gutter.px} py-4`}>
          <View
            className={`flex-row rounded-xl p-1 ${
              isWebLayout ? `${cardBg} border ${borderColor}` : 'bg-white/20'
            }`}>
            {(['day', 'week', 'month'] as const).map((view) => {
              const active = selectedView === view;
              const activeBg = isWebLayout ? 'bg-brand-500' : 'bg-white';
              const activeText = isWebLayout ? 'text-white' : 'text-brand-600';
              return (
                <TouchableOpacity
                  key={view}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`flex-1 rounded-lg py-2 ${active ? activeBg : ''}`}
                  onPress={() => setSelectedView(view)}>
                  <Text
                    className={`text-center font-semibold ${
                      active ? activeText : isWebLayout ? subtextColor : 'text-white'
                    }`}>
                    {t(`schedule.${view}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* View Content */}
        <ScrollView className="flex-1">
          {isLoading ? (
            <View className="items-center justify-center py-16">
              <PetLoader label={t('common.loading')} />
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
