import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useBookingCart } from '../../context/BookingCartContext';
import { useLocale } from '../../context/LocaleContext';
import { useResponsive } from '../../hooks/useResponsive';

/**
 * "Your booking · 3 appointments · Review" — what is waiting in the booking cart (feedback
 * 2026-10-21), on the screens a customer browses while adding the next service: Home, Search, a
 * service and a provider. Renders nothing while the cart is empty.
 *
 * Floats across the bottom of the screen, above the tab bar. The phone design only: on the web
 * the booking form goes straight to Review (feedback 2026-10-21), so nothing waits in a cart.
 */
export default function BookingCartPill({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const cart = useBookingCart();
  const navigation = useNavigation();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  // The web design has no cart: its booking form checks out what is selected, straight away.
  if (cart.count === 0 || isWebLayout) return null;

  const position = {
    position: 'absolute' as const,
    bottom: 16 + bottomOffset,
    left: 16,
    right: 16,
  };

  return (
    <View style={[position, { zIndex: 50, elevation: 12 }]} pointerEvents="box-none">
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => (navigation as any).navigate('ReviewBooking', { sections: cart.sections })}
        className="flex-row items-center justify-center rounded-full bg-brand-500 px-5 py-3"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}>
        <Ionicons name="cart-outline" size={18} color="white" />
        <Text className="ml-2 text-sm font-bold text-white">
          {t('bookService.cartPill', { count: cart.count })}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="white" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );
}
