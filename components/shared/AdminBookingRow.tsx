import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { formatMoney } from '../../services/currency';
import { customerName } from '../../services/users';
import { parseBookingDate, type BookingDto } from '../../services/bookings';
import { formatShortDate } from '../../i18n/dates';
import type { linkTo } from '../../navigation/links';

/** BookingState (backend) → the colour a booking's state reads in. */
export const BOOKING_STATE_COLORS: Record<number, string> = {
  0: '#D97706', // Upcoming (awaiting the partner)
  1: BRAND_GREEN, // Completed
  2: '#6B7280', // Cancelled
  3: '#2563EB', // Accepted
  4: '#7C3AED', // In progress
  5: '#9CA3AF', // Expired
};

/**
 * One booking in an admin list (a partner's latest, the Bookings screen, a customer's page): its
 * number and day, who booked what with whom, how much, and where it stands. `hide` leaves out the
 * side the page is already about.
 */
export default function AdminBookingRow({
  booking,
  link,
  hide,
}: {
  booking: BookingDto;
  /** Opens the booking: `linkTo`, so the row is a link on the web. */
  link: ReturnType<typeof linkTo>;
  hide?: 'customer' | 'partner';
}) {
  const { hex } = useThemeColors();
  const { tEnum } = useLocale();
  const when = parseBookingDate(booking.bookingFrom);
  const color = BOOKING_STATE_COLORS[booking.state] ?? hex.subtext;
  const who = [
    hide === 'customer' ? '' : customerName(booking.user, '—'),
    hide === 'partner' ? '' : (booking.serviceProvider?.name ?? ''),
  ]
    .filter(Boolean)
    .join(' → ');
  const what = [booking.service?.name, booking.pet?.name].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity
      {...(link as object)}
      accessibilityRole="link"
      activeOpacity={0.85}
      style={{
        backgroundColor: hex.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: hex.border,
      }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}>
        <Text style={{ color: hex.subtext, fontSize: 11 }}>
          #{booking.id} • {Number.isNaN(when.getTime()) ? '' : formatShortDate(when)}
        </Text>
        <Text style={{ color: hex.text, fontSize: 14, fontWeight: '700' }}>
          {formatMoney(booking.totalPrice, booking.priceCurrency)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: hex.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
            {who || '—'}
          </Text>
          <Text style={{ color: hex.subtext, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
            {what}
          </Text>
        </View>
        <Text style={{ color, fontSize: 13, fontWeight: '600' }}>
          {tEnum('bookingState', booking.state, '')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
