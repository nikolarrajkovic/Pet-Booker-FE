import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getServicesForDate, ScheduleMode } from '../utils/scheduleData';
import { useLocale } from '../../../context/LocaleContext';
import { formatFullDate } from '../../../i18n/dates';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { SchedulePanel, ScheduleHeader, ScheduleRow, ScheduleEmpty } from './ScheduleParts';

interface DayViewProps {
  selectedDate: Date;
  isDarkMode: boolean;
  onDateChange: (date: Date) => void;
  mode: ScheduleMode;
}

export default function DayView({ selectedDate, isDarkMode, onDateChange, mode }: DayViewProps) {
  const gutter = usePageGutter();
  const { t } = useLocale();
  const navigation = useNavigation();

  // Get services for the selected date, filtered by mode
  const all = getServicesForDate(selectedDate);
  const servicesForDate =
    mode === 'user' ? all.filter((s) => s.isUserService) : all.filter((s) => !s.isUserService);

  const shiftDay = (by: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + by);
    onDateChange(next);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <View className={`${gutter.px} pb-8 pt-2`}>
      <SchedulePanel isDarkMode={isDarkMode}>
        <ScheduleHeader
          title={formatFullDate(selectedDate)}
          isCurrent={isToday}
          onPrevious={() => shiftDay(-1)}
          onNext={() => shiftDay(1)}
          onToday={() => onDateChange(new Date())}
          previousLabel={t('common.previousDay')}
          nextLabel={t('common.nextDay')}
          isDarkMode={isDarkMode}
        />
        <View className="px-4">
          {servicesForDate.length > 0 ? (
            servicesForDate.map((service, i) => (
              <ScheduleRow
                key={service.id}
                service={service}
                isDarkMode={isDarkMode}
                // The booking itself: where a partner starts, calls off, records cash or a no-show.
                // A row used to do nothing, and an accepted booking had no way in from here.
                onPress={
                  service.bookingId
                    ? () =>
                        (navigation as any).navigate('BookingDetails', {
                          bookingId: service.bookingId,
                        })
                    : undefined
                }
                last={i === servicesForDate.length - 1}
              />
            ))
          ) : (
            <ScheduleEmpty text={t('schedule.noServicesDay')} isDarkMode={isDarkMode} />
          )}
        </View>
      </SchedulePanel>
    </View>
  );
}
