import React, { useCallback } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useBottomInset } from '../../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../../context/LocaleContext';
import { usePagedList } from '../../../hooks/usePagedList';
import { useResource } from '../../../hooks/useResource';
import { usePageGutter } from '../../../hooks/usePageGutter';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import LoadMoreFooter from '../../../components/shared/LoadMoreFooter';
import AdminBookingRow from '../../../components/shared/AdminBookingRow';
import { linkTo } from '../../../navigation/links';
import { getUser, type UserDto } from '../../../services/users';
import { getPets, petFacts } from '../../../services/pets';
import { BookingSortBy, getBookingsPage, type BookingDto } from '../../../services/bookings';
import { resolveImageUrl } from '../../../services/service-providers';
import { addressLabel } from '../../../services/geocoding';
import { formatShortDate } from '../../../i18n/dates';
import { fullName } from './AdminCustomersScreen';

/**
 * One customer for support (app review 2026-11-13, finding 41): who they are and how to reach
 * them, their bookings newest first (each opens the booking), and their pets. Opened from the
 * Customers list, or from its own address (`admin/customers/:userId`).
 */
export default function AdminCustomerDetailsScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { leaveTo } = useAppNavigation();
  const { hex } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const bottomInset = useBottomInset();
  const { t, tEnum } = useLocale();

  const passed: UserDto | undefined = route.params?.user;
  const userId = Number(passed?.id ?? route.params?.userId ?? 0) || 0;
  const { data: loaded, isLoading } = useResource(['user', userId], () => getUser(userId), {
    enabled: userId > 0,
  });
  const user = loaded ?? passed;
  const { data: pets } = useResource(['pets', userId], () => getPets(userId), {
    enabled: userId > 0,
  });
  const fetchBookings = useCallback(
    (page: number) =>
      getBookingsPage({ userId, sortBy: BookingSortBy.NewestFirst, perPage: 10 }, page),
    [userId]
  );
  const bookings = usePagedList<BookingDto>(fetchBookings, {
    enabled: userId > 0,
    errorFallback: t('adminCustomers.loadFailed'),
    resource: 'bookings',
  });

  const card = {
    backgroundColor: hex.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: hex.border,
  } as const;
  const heading = (icon: React.ComponentProps<typeof Ionicons>['name'], text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <Ionicons name={icon} size={16} color={BRAND_GREEN} />
      <Text style={{ color: hex.text, fontSize: 15, fontWeight: '700', marginLeft: 8 }}>
        {text}
      </Text>
    </View>
  );
  const line = (icon: React.ComponentProps<typeof Ionicons>['name'], text?: string | null) =>
    text ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Ionicons name={icon} size={14} color={hex.subtext} />
        <Text style={{ color: hex.subtext, fontSize: 13, marginLeft: 8, flexShrink: 1 }}>
          {text}
        </Text>
      </View>
    ) : null;

  const joined = user?.createdAt ? new Date(user.createdAt) : null;
  const avatar = resolveImageUrl(user?.avatarUrl);

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={() => leaveTo('AdminCustomers')}
      headerTitle={user ? fullName(user) : t('adminCustomers.title')}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: gutter.value,
          paddingTop: 16,
          paddingBottom: 32 + (isWebLayout ? 0 : bottomInset),
        }}>
        {!user && isLoading ? (
          <ActivityIndicator color={BRAND_GREEN} />
        ) : !user ? (
          <Text style={{ color: hex.subtext }}>{t('adminCustomers.notFound')}</Text>
        ) : (
          <View style={{ maxWidth: 760, width: '100%' }}>
            <View style={card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    overflow: 'hidden',
                    backgroundColor: 'rgba(0,168,90,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={{ width: 56, height: 56 }} />
                  ) : (
                    <Ionicons name="person" size={24} color={BRAND_GREEN} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: hex.text, fontSize: 17, fontWeight: '700' }}>
                    {fullName(user)}
                  </Text>
                  <Text style={{ color: hex.subtext, fontSize: 12, marginTop: 2 }}>
                    #{user.id}
                    {user.userName ? ` · @${user.userName}` : ''}
                    {joined && !isNaN(joined.getTime())
                      ? ` · ${t('adminCustomers.joined', { date: formatShortDate(joined) })}`
                      : ''}
                  </Text>
                </View>
              </View>
              {line('mail-outline', user.email)}
              {line('call-outline', user.phone)}
              {line('home-outline', user.address ? addressLabel(user.address) : null)}
            </View>

            <View style={card}>
              {heading('paw-outline', t('adminCustomers.pets'))}
              {pets == null ? (
                <ActivityIndicator color={BRAND_GREEN} style={{ alignSelf: 'flex-start' }} />
              ) : pets.length === 0 ? (
                <Text style={{ color: hex.subtext, fontSize: 13 }}>
                  {t('adminCustomers.noPets')}
                </Text>
              ) : (
                pets.map((pet) => (
                  <View
                    key={pet.id}
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    {pet.photoUrl ? (
                      <Image
                        source={{ uri: resolveImageUrl(pet.photoUrl) }}
                        style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }}
                      />
                    ) : (
                      <Ionicons
                        name="paw"
                        size={18}
                        color={BRAND_GREEN}
                        style={{ marginRight: 10 }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: hex.text, fontSize: 14, fontWeight: '600' }}>
                        {pet.name}
                      </Text>
                      <Text style={{ color: hex.subtext, fontSize: 12 }} numberOfLines={1}>
                        {petFacts(t, tEnum, pet).filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={card}>
              {heading('calendar-outline', t('adminCustomers.bookings'))}
              {bookings.isLoading ? (
                <ActivityIndicator color={BRAND_GREEN} style={{ alignSelf: 'flex-start' }} />
              ) : bookings.items.length === 0 ? (
                <Text style={{ color: hex.subtext, fontSize: 13 }}>{t('admin.noBookingsYet')}</Text>
              ) : (
                <>
                  {bookings.items.map((booking) => (
                    <AdminBookingRow
                      key={booking.id}
                      booking={booking}
                      hide="customer"
                      link={linkTo(navigation, 'BookingDetails', { bookingId: booking.id })}
                    />
                  ))}
                  <LoadMoreFooter
                    loaded={bookings.items.length}
                    total={bookings.totalItems}
                    hasMore={bookings.hasMore}
                    isLoadingMore={bookings.isLoadingMore}
                    onLoadMore={bookings.loadMore}
                  />
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
