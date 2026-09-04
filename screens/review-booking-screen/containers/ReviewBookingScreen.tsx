import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { DAY_KEYS, MONTH_KEYS } from '../../../i18n';
import { durationDisplayLabel } from '../../my-services-screen/serviceModel';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import StickyFooter from '../../../components/shared/StickyFooter';
import { useResponsive } from '../../../hooks/useResponsive';
import { PriceBreakdown, PaymentMethodSelector, AddonLine } from '../components';
import type { BookingAdditionalServiceReadDto } from '../../../services/bookings';
import { resolveImageUrl, AddressDto } from '../../../services/service-providers';
import { addressLabel } from '../../../services/geocoding';
import { ServiceDto, serviceCurrency } from '../../../services/services';
import { DiscountType } from '../../../services/service-discounts';
import { createBooking, parseBookingDate, PaymentType } from '../../../services/bookings';
import {
  getPaymentMethods,
  createPaymentMethod,
  PaymentMethodStatus,
} from '../../../services/payment-methods';

type Appointment = {
  id: number;
  service: { id: number; name: string; price: number };
  pet: { id: number; name: string; image: string };
  // The extras as the SERVER priced them (frozen when the appointment was added). A per-distance
  // line carries the fees and its own leg's distance, which is what the breakdown itemizes.
  addons: BookingAdditionalServiceReadDto[];
  // The catalog ids the booking create sends — the quote priced exactly these.
  addonIds: number[];
  bookingFrom: string;
  bookingTo: string;
  total: number;
  // The chosen pricing option (duration/price variant) — set when the booked
  // service defines options. `pricingOptionBase` is the pre-discount option
  // price (drives the base/discount breakdown lines below).
  pricingOptionId?: number;
  pricingOptionName?: string;
  pricingOptionBase?: number;
  pickupAddress?: AddressDto;
  leaveOverAddress?: AddressDto;
  // The road distance the SERVER measured for each leg when it quoted this appointment,
  // in km. Display only — the booking create never sends a distance back, because a
  // client-supplied one would override the measurement that sets the price.
  pickupDistanceKm?: number | null;
  leaveOverDistanceKm?: number | null;
};

type ReviewBookingRouteParams = {
  service: ServiceDto;
  appointments: Appointment[];
};

// Builds the discount breakdown label, stating the discount type. For a percent
// discount we derive the rate from the amounts so the line reads "Discount
// (20% off)"; a fixed discount reads "Discount (Fixed amount)". Takes the
// translate function so the label follows the active language.
function discountLabel(
  t: (key: any, params?: Record<string, string | number>) => string,
  type: number | null | undefined,
  baseTotal: number,
  discountTotal: number
): string {
  if (type === DiscountType.Percent && baseTotal > 0) {
    const pct = Math.round((discountTotal / baseTotal) * 100);
    return t('reviewBooking.discountPercent', { pct });
  }
  if (type === DiscountType.Fixed) return t('reviewBooking.discountFixed');
  return t('reviewBooking.discount');
}

/**
 * Resolves a usable paymentMethodId for the user. The API requires bookings to
 * reference a real PaymentMethod, so if the user has none we create a default
 * placeholder (real payment UX is future work — see CLAUDE.md).
 */
async function resolvePaymentMethodId(userId: number, isCash: boolean): Promise<number> {
  const existing = await getPaymentMethods(userId);
  if (existing.length) {
    const def = existing.find((m) => m.isDefault) ?? existing[0];
    if (def.id != null) return def.id;
  }
  const created = await createPaymentMethod({
    userId,
    type: isCash ? PaymentType.Cash : PaymentType.Card,
    provider: 'manual',
    providerPaymentMethodId: `manual-${userId}-${Date.now()}`,
    isDefault: true,
    status: PaymentMethodStatus.Active,
    cardHolderName: 'Account Holder',
  });
  if (created.id == null) throw new Error('Could not create a payment method.');
  return created.id;
}

export default function ReviewBookingScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ReviewBookingRouteParams }, 'params'>>();
  const { service, appointments } = route.params;
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const { t } = useLocale();
  const serviceImage = resolveImageUrl(
    service.imageUrl ?? (service.photos?.find((p) => p.isSelected) ?? service.photos?.[0])?.src
  );
  const {
    isDarkMode,
    cardBg,
    bgColor: contentBg,
    textColor,
    subtextColor,
    borderColor,
  } = useThemeColors();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('online');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // `a.service.price` is the effective (already-discounted) per-appointment
  // price. We show the WHOLE (pre-discount) service total and the discount on
  // its own line, so the breakdown reads base → minus discount → total. Each
  // appointment's whole price is its chosen pricing option's base price when
  // one was picked (appointments may mix options), else the service's
  // pricing.basePrice; the discount is the difference, which keeps
  // base − discount == effective == the booked total.
  const effectiveServiceTotal = appointments.reduce((s, a) => s + a.service.price, 0);
  const baseUnit = service.pricing?.basePrice ?? 0;
  const serviceTotal = appointments.reduce(
    (s, a) => s + (a.pricingOptionBase ?? (baseUnit > 0 ? baseUnit : a.service.price)),
    0
  );
  const discountTotal = Math.max(0, serviceTotal - effectiveServiceTotal);
  const discount =
    discountTotal > 0
      ? {
          label: discountLabel(t, service.appliedDiscountType, serviceTotal, discountTotal),
          amount: discountTotal,
        }
      : null;
  // Aggregate add-ons by name across all appointments so each one is its own
  // breakdown line. For per-km location add-ons the distance-pricing components
  // (start fee / per-km charge / free-km credit) are summed too, so the line can
  // show an itemized sub-breakdown that reconciles to the add-on total.
  const addonLines: AddonLine[] = Object.values(
    appointments
      .flatMap((a) => a.addons)
      .reduce<Record<string, AddonLine>>((acc, ad) => {
        const cur = acc[ad.name] ?? { name: ad.name, price: 0 };
        cur.price += ad.price;
        // A per-distance line reports the fees and the leg's distance behind its amount. The
        // per-km portion is derived as price − baseFee so the sub-lines always reconcile to what
        // is charged, rather than re-deriving the surcharge formula here.
        if (ad.baseFee != null && ad.perKmFee != null) {
          const agg = cur.breakdown ?? {
            baseFee: 0,
            perKmFee: ad.perKmFee,
            distanceKm: 0,
            distanceCharge: 0,
            count: 0,
          };
          agg.baseFee += ad.baseFee;
          agg.perKmFee = ad.perKmFee;
          agg.distanceKm += ad.distanceKm ?? 0;
          agg.distanceCharge += Math.max(0, ad.price - ad.baseFee);
          agg.count += 1;
          cur.breakdown = agg;
        }
        acc[ad.name] = cur;
        return acc;
      }, {})
  );
  const grandTotal = appointments.reduce((s, a) => s + a.total, 0);

  const handleConfirm = async () => {
    if (!currentUser?.id) {
      Alert.alert(t('reviewBooking.notSignedInTitle'), t('reviewBooking.notSignedInMsg'));
      return;
    }
    setIsSubmitting(true);
    try {
      const isCash = selectedPaymentMethod === 'cash';
      const paymentMethodId = await resolvePaymentMethodId(currentUser.id, isCash);

      // One booking per appointment (the API creates a single booking per call).
      for (const apt of appointments) {
        await createBooking({
          userId: currentUser.id,
          serviceProviderId: service.serviceProviderId,
          serviceId: apt.service.id,
          petId: apt.pet.id,
          paymentMethodId,
          bookingFrom: apt.bookingFrom,
          // For option bookings the server derives bookingTo/basePrice from the
          // option — the values below are sent but ignored in that case.
          bookingTo: apt.bookingTo,
          basePrice: apt.service.price,
          discountAmount: 0,
          totalPrice: apt.total,
          pricingOptionId: apt.pricingOptionId,
          paymentType: isCash ? PaymentType.Cash : PaymentType.Card,
          pickupAddress: apt.pickupAddress,
          leaveOverAddress: apt.leaveOverAddress,
          // Ids only — the server re-resolves each extra's price from the service's catalog and
          // re-measures each trip leg from the addresses above. No distance is sent: a
          // client-supplied one would override the measurement that sets the price.
          additionalServiceIds: apt.addonIds,
        });
      }

      (navigation as any).navigate('BookingConfirmed', {
        serviceName: service.name ?? t('reviewBooking.yourService'),
      });
    } catch (error) {
      showError(getErrorMessage(error, t('reviewBooking.bookingFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const { isWebLayout } = useResponsive();

  const priceBreakdown = (
    <PriceBreakdown
      isDarkMode={isDarkMode}
      textColor={textColor}
      subtextColor={subtextColor}
      borderColor={borderColor}
      serviceTotal={serviceTotal}
      discount={discount}
      addons={addonLines}
      total={grandTotal}
      currency={serviceCurrency(service)}
    />
  );

  const confirmButton = (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={isSubmitting}
      onPress={handleConfirm}
      className="items-center rounded-2xl bg-brand-500 py-4"
      style={{ opacity: isSubmitting ? 0.7 : 1 }}>
      {isSubmitting ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className="text-lg font-bold text-white">{t('reviewBooking.confirmBooking')}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('reviewBooking.title')}
      contentBg={contentBg}
      contentRounded={false}
      width="wide">
      {/*
        The checkout shape. On a phone the total and the confirm button are at the bottom of a
        long scroll, with the button pinned so it is reachable at any offset. On a desktop that
        same content fits beside the booking rather than under it: the price stays in view while
        the user checks the dates and add-ons above it, which is what every checkout page does and
        what a pinned bar is a small-screen substitute for.
      */}
      <View style={{ flex: 1, flexDirection: isWebLayout ? 'row' : 'column' }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: isWebLayout ? 32 : 100 }}>
          {/* Service Info */}
          <View className="flex-row items-center px-6 py-5">
            {serviceImage ? (
              <Image
                source={{ uri: serviceImage }}
                className="mr-4 h-16 w-16 rounded-xl"
                resizeMode="cover"
              />
            ) : (
              <View
                className={`mr-4 h-16 w-16 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
                <Ionicons name="paw" size={26} color="#9CA3AF" />
              </View>
            )}
            <View className="flex-1">
              <Text className={`text-lg font-bold ${textColor}`}>{service.name ?? 'Service'}</Text>
              {service.basicServiceName ? (
                <Text className="mt-1 text-sm text-brand-600">{service.basicServiceName}</Text>
              ) : null}
            </View>
          </View>

          {/* Booking Details — one block per appointment */}
          <View className={`border-t px-6 py-5 ${borderColor}`}>
            <Text className={`text-base font-semibold ${textColor} mb-4`}>
              {t('reviewBooking.bookingDetails')}
              {appointments.length > 1 ? ` (${appointments.length})` : ''}
            </Text>
            {appointments.map((apt, i) => {
              const start = parseBookingDate(apt.bookingFrom);
              return (
                <View key={apt.id} className={i > 0 ? `mt-4 border-t pt-4 ${borderColor}` : ''}>
                  <Text className={`text-base font-semibold ${textColor}`}>
                    {apt.service.name}{' '}
                    <Text className={`${subtextColor} font-normal`}>
                      {t('bookService.forPet', { name: apt.pet.name })}
                    </Text>
                  </Text>
                  <View className="mt-1.5 flex-row items-center">
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={BRAND_GREEN}
                      style={{ marginRight: 6 }}
                    />
                    <Text className={`text-sm ${subtextColor}`}>
                      {`${t(DAY_KEYS[start.getDay()])}, ${t(MONTH_KEYS[start.getMonth()])} ${start.getDate()}, ${start.getFullYear()}`}
                    </Text>
                  </View>
                  <View className="mt-1 flex-row items-center">
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={BRAND_GREEN}
                      style={{ marginRight: 6 }}
                    />
                    <Text className={`text-sm ${subtextColor}`}>
                      {start.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </Text>
                  </View>
                  {apt.pricingOptionName && (
                    <View className="mt-1 flex-row items-center">
                      <Ionicons
                        name="pricetag-outline"
                        size={14}
                        color={BRAND_GREEN}
                        style={{ marginRight: 6 }}
                      />
                      <Text className={`text-sm ${subtextColor}`}>
                        {t('bookService.option', {
                          name: durationDisplayLabel(t, apt.pricingOptionName),
                        })}
                      </Text>
                    </View>
                  )}
                  {apt.addons.length > 0 && (
                    <Text className={`text-xs ${subtextColor} mt-1`}>
                      + {apt.addons.map((a) => a.name).join(', ')}
                    </Text>
                  )}
                  {apt.pickupAddress ? (
                    <View className="mt-1 flex-row items-start">
                      <Ionicons
                        name="car-outline"
                        size={14}
                        color={BRAND_GREEN}
                        style={{ marginRight: 6, marginTop: 1 }}
                      />
                      <Text className={`text-xs ${subtextColor} flex-1`}>
                        {t('reviewBooking.pickupLine', {
                          address: addressLabel(apt.pickupAddress),
                        })}
                      </Text>
                    </View>
                  ) : null}
                  {apt.leaveOverAddress ? (
                    <View className="mt-1 flex-row items-start">
                      <Ionicons
                        name="home-outline"
                        size={14}
                        color={BRAND_GREEN}
                        style={{ marginRight: 6, marginTop: 1 }}
                      />
                      <Text className={`text-xs ${subtextColor} flex-1`}>
                        {t('reviewBooking.dropoffLine', {
                          address: addressLabel(apt.leaveOverAddress),
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {!isWebLayout && priceBreakdown}

          <PaymentMethodSelector
            isDarkMode={isDarkMode}
            textColor={textColor}
            subtextColor={subtextColor}
            borderColor={borderColor}
            selectedMethod={selectedPaymentMethod}
            onSelectMethod={setSelectedPaymentMethod}
          />

          {/* Cancellation Policy */}
          <View className={`border-t px-6 py-5 ${borderColor}`}>
            <Text className={`text-base font-semibold ${textColor} mb-3`}>
              {t('reviewBooking.cancellationPolicy')}
            </Text>
            <Text className={`text-sm ${subtextColor} leading-6`}>
              {t('reviewBooking.cancellationPolicyText')}
            </Text>
          </View>
        </ScrollView>

        {isWebLayout && (
          <View
            className={`${cardBg} border ${borderColor} rounded-2xl`}
            style={{
              width: 360,
              marginLeft: 24,
              marginTop: 20,
              padding: 20,
              alignSelf: 'flex-start',
            }}>
            {priceBreakdown}
            <View className="mt-4">{confirmButton}</View>
          </View>
        )}
      </View>

      {!isWebLayout && (
        <StickyFooter className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
          {confirmButton}
        </StickyFooter>
      )}
    </ScreenLayout>
  );
}
