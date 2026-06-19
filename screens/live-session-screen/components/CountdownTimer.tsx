import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parseBookingDate } from '../../../services/bookings';

type Props = {
  /** Scheduled end of the booking (ISO date-time, e.g. booking.bookingTo). */
  endTime: string;
  isDarkMode: boolean;
};

function format(totalSeconds: number): string {
  const s = Math.abs(Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * Live countdown to the booking's scheduled end. Ticks once a second; once the
 * scheduled end passes it flips to an "Overtime" count-up in a warning colour.
 * The booking has no real `startedAt`/`endedAt`, so this is purely scheduled-end
 * driven (see BACKEND_GAPS B7).
 */
export default function CountdownTimer({ endTime, isDarkMode }: Props) {
  // Booking times are naive wall-clock (see parseBookingDate) — count down to the
  // local wall-clock end, not a UTC-shifted one.
  const end = parseBookingDate(endTime).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = end - now;
  const overtime = remainingMs < 0;
  const seconds = remainingMs / 1000;

  const accent = overtime ? '#F97316' : '#00C870';
  const trackBg = isDarkMode ? '#1a2332' : '#F0FDF4';
  const overtimeBg = isDarkMode ? '#3a2410' : '#FFF7ED';

  return (
    <View
      style={{
        backgroundColor: overtime ? overtimeBg : trackBg,
        borderRadius: 20,
        paddingVertical: 24,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: overtime ? '#FDBA74' : '#86EFAC',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Ionicons name={overtime ? 'alert-circle' : 'time'} size={16} color={accent} />
        <Text style={{ color: accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
          {overtime ? 'OVERTIME' : 'TIME REMAINING'}
        </Text>
      </View>
      <Text style={{ color: accent, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
        {overtime ? '+' : ''}
        {format(seconds)}
      </Text>
      <Text style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280', fontSize: 12, marginTop: 6 }}>
        {overtime ? 'Past the scheduled end time' : 'until the scheduled end'}
      </Text>
    </View>
  );
}
