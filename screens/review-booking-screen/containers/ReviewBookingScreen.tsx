import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import { addonLabel } from '../../../services/service-addons';
import { formatFullDate } from '../../../i18n/dates';
import { durationDisplayLabel } from '../../my-services-screen/serviceModel';
import { getErrorMessage } from '../../../services/http';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import StickyFooter from '../../../components/shared/StickyFooter';
import { useResponsive } from '../../../hooks/useResponsive';
import { PriceBreakdown, PaymentMethodSelector, AddonLine } from '../components';
import type { Appointment, CheckoutSection } from '../../book-service-screen/appointment';
import { useBookingCart } from '../../../context/BookingCartContext';
import { resolveImageUrl } from '../../../services/service-providers';
import { addressLabel } from '../../../services/geocoding';
import { ServiceDto, serviceCurrency, serviceAsksDeposit } from '../../../services/services';
import { DiscountType } from '../../../services/service-discounts';
import { createBookings, parseBookingDate, PaymentType } from '../../../services/bookings';
import { formatMoney } from '../../../services/currency';
import { showAlert } from '../../../services/alert';
import { ensurePaymentMethodId } from '../../../services/payment-methods';
import { usePageGutter } from '../../../hooks/usePageGutter';

type ReviewBookingRouteParams = {
  /** Every service in this checkout (the booking cart plus the form's own). */
  sections?: CheckoutSection[];
  /** One service, as older callers pass it. */
  service?: ServiceDto;
  appointments?: Appointment[];
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
 * One service's share of the bill: the whole (pre-discount) service total, the discount on its own
 * line, the extras aggregated by name, and the total. `a.service.price` is the effective
 * (already-discounted) per-appointment price; each appointment's whole price is its chosen pricing
 * option's base price when one was picked (appointments may mix options), else the service's
 * pricing.basePrice, so base − discount == effective == the booked total.
 */
function priceSection(
  t: (key: any, params?: Record<string, string | number>) => string,
  { service, appointments }: CheckoutSection
) {
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
      .reduce<Record<number, AddonLine>>((acc, ad) => {
        const cur = acc[ad.kind] ?? { kind: ad.kind, price: 0 };
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
        acc[ad.kind] = cur;
        return acc;
      }, {})
  );
  const total = appointments.reduce((s, a) => s + a.total, 0);
  return { serviceTotal, discount, addonLines, total };
}

export default function ReviewBookingScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ReviewBookingRouteParams }, 'params'>>();
  const params = route.params;
  // A checkout of one service or several (feedback 2026-10-21): the sections the form sends, or
  // the single service older callers pass.
  const sections: CheckoutSection[] =
    params.sections ??
    (params.service ? [{ service: params.service, appointments: params.appointments ?? [] }] : []);
  const cart = useBookingCart();
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const { t, tEnum } = useLocale();
  const imageOf = (service: ServiceDto) =>
    resolveImageUrl(
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
  // What the customer is signing up to: a cash booking is settled in person; a card booking with
  // a deposit can't start until it is paid, and cancelling after paying it keeps it (G3, G5).
  const payingCash = selectedPaymentMethod === 'cash';
  const asksDeposit = !payingCash && sections.some((sec) => serviceAsksDeposit(sec.service));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const priced = sections.map((section) => ({ section, ...priceSection(t, section) }));
  const grandTotal = priced.reduce((sum, p) => sum + p.total, 0);
  const appointmentCount = sections.reduce((n, sec) => n + sec.appointments.length, 0);

  const handleConfirm = async () => {
    if (!currentUser?.id) {
      showAlert(t('reviewBooking.notSignedInTitle'), t('reviewBooking.notSignedInMsg'));
      return;
    }
    setIsSubmitting(true);
    try {
      const isCash = selectedPaymentMethod === 'cash';
      const paymentMethodId = await ensurePaymentMethodId(
        currentUser.id,
        isCash ? PaymentType.Cash : PaymentType.Card
      );

      // Every appointment in one all-or-nothing call: if any is refused (a slot taken meanwhile, a
      // lead time missed) none is kept. They used to be created one by one, so a failure on the
      // second left the first booked while this screen said "booking failed", and retrying
      // booked the first one again.
      await createBookings(
        sections.flatMap(({ service, appointments }) =>
          appointments.map((apt) => ({
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
            note: apt.note,
          }))
        )
      );

      // Booked: what was waiting in the cart is done with.
      cart.clear();
      (navigation as any).navigate('BookingConfirmed', {
        serviceName:
          sections.length === 1
            ? (sections[0].service.name ?? t('reviewBooking.yourService'))
            : t('reviewBooking.nServices', { count: sections.length }),
      });
    } catch (error) {
      showError(getErrorMessage(error, t('reviewBooking.bookingFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const { isWebLayout } = useResponsive();

  // One breakdown per service, each with its own total; several add up to a grand total.
  const many = priced.length > 1;
  const priceBreakdown = (
    <View>
      {priced.map(({ section, serviceTotal, discount, addonLines, total }) => (
        <PriceBreakdown
          key={section.service.id}
          title={many ? (section.service.name ?? undefined) : undefined}
          totalLabel={many ? t('reviewBooking.subtotal') : undefined}
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          borderColor={borderColor}
          serviceTotal={serviceTotal}
          discount={discount}
          addons={addonLines}
          total={total}
          currency={serviceCurrency(section.service)}
        />
      ))}
      {many ? (
        <View className={`border-t ${gutter.px} flex-row justify-between py-4 ${borderColor}`}>
          <Text className={`text-base font-bold ${textColor}`}>
            {t('reviewBooking.grandTotal', { count: appointmentCount })}
          </Text>
          <Text className="text-2xl font-bold text-brand-600">
            {formatMoney(grandTotal, serviceCurrency(sections[0].service))}
          </Text>
        </View>
      ) : null}
    </View>
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
      contentBg={contentBg}>
      {/*
        The checkout shape. On a phone the total and the confirm button are at the bottom of a
        long scroll, with the button pinned so it is reachable at any offset. On a desktop that
        same content fits beside the booking rather than under it: the price stays in view while
        the user checks the dates and add-ons above it, which is what every checkout page does and
        what a pinned bar is a small-screen substitute for.
      */}
      <View style={{ flex: 1, flexDirection: isWebLayout ? 'row' : 'column' }}>
        {/* The main column, beside the aside on the web design. The page flattens every screen
            ScrollView on the web (`flex: none`, styles/document-scroll.web.ts), so in this row the
            scroll view sized itself to its longest line of text and pushed the total and Confirm
            past the right edge of the window. A shrinkable column around it takes the width left
            beside the aside instead. */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: isWebLayout ? 32 : 100 }}>
            {sections.map((section, sectionIndex) => {
              const service = section.service;
              const image = imageOf(service);
              return (
                <View
                  key={service.id ?? sectionIndex}
                  className={sectionIndex > 0 ? `border-t ${borderColor}` : ''}>
                  {/* Service Info */}
                  <View className={`flex-row items-center ${gutter.px} py-5`}>
                    {image ? (
                      <Image
                        source={{ uri: image }}
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
                      <Text className={`text-lg font-bold ${textColor}`}>
                        {service.name ?? 'Service'}
                      </Text>
                      {service.basicServiceName ? (
                        <Text className="mt-1 text-sm text-brand-600">
                          {service.basicServiceName}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Booking Details — one block per appointment */}
                  <View className={`border-t ${gutter.px} py-5 ${borderColor}`}>
                    <Text className={`text-base font-semibold ${textColor} mb-4`}>
                      {t('reviewBooking.bookingDetails')}
                      {section.appointments.length > 1 ? ` (${section.appointments.length})` : ''}
                    </Text>
                    {section.appointments.map((apt, i) => {
                      const start = parseBookingDate(apt.bookingFrom);
                      const clock = (d: Date) =>
                        d.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        });
                      return (
                        <View
                          key={apt.id}
                          className={i > 0 ? `mt-4 border-t pt-4 ${borderColor}` : ''}>
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
                              {formatFullDate(start)}
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
                              {/* The window, not just its start: "10:00 – 11:00", as Booking Details reads. */}
                              {`${clock(start)} – ${clock(parseBookingDate(apt.bookingTo))}`}
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
                              + {apt.addons.map((a) => addonLabel(tEnum, a)).join(', ')}
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
                          {apt.note ? (
                            <View className="mt-1 flex-row items-start">
                              <Ionicons
                                name="chatbox-ellipses-outline"
                                size={14}
                                color={BRAND_GREEN}
                                style={{ marginRight: 6, marginTop: 1 }}
                              />
                              <Text className={`text-xs ${subtextColor} flex-1`}>
                                {t('reviewBooking.noteLine', { note: apt.note })}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {!isWebLayout && priceBreakdown}

            <PaymentMethodSelector
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
              borderColor={borderColor}
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={setSelectedPaymentMethod}
            />
            {/* Choosing "online" charges nothing here; the pay sheet is on the booking, once the
              provider has confirmed. Without this the next screen's "sent to the provider" read
              as if a payment had gone missing. */}
            <Text className={`${gutter.px} -mt-2 pb-4 text-xs ${subtextColor}`}>
              {payingCash ? t('reviewBooking.cashNote') : t('reviewBooking.payLaterNote')}
              {asksDeposit ? ` ${t('reviewBooking.depositNote')}` : ''}
            </Text>

            {/* Cancellation Policy */}
            <View className={`border-t ${gutter.px} py-5 ${borderColor}`}>
              <Text className={`text-base font-semibold ${textColor} mb-3`}>
                {t('reviewBooking.cancellationPolicy')}
              </Text>
              <Text className={`text-sm ${subtextColor} leading-6`}>
                {asksDeposit
                  ? t('reviewBooking.cancellationPolicyDeposit')
                  : t('reviewBooking.cancellationPolicyText')}
              </Text>
              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => (navigation as any).navigate('Legal', { doc: 'terms' })}
                className="mt-2 self-start">
                <Text className="text-sm font-semibold text-brand-600">{t('legal.fullTerms')}</Text>
              </TouchableOpacity>
            </View>

            {/* What happens after Confirm. "Request sent" used to be the last thing the checkout
              said, and nothing told the customer that the provider still has to accept, when they
              pay, or where to talk to them. */}
            <View className={`border-t ${gutter.px} py-5 ${borderColor}`}>
              <Text className={`text-base font-semibold ${textColor} mb-3`}>
                {t('reviewBooking.nextStepsTitle')}
              </Text>
              {[
                t('reviewBooking.nextStep1'),
                payingCash ? t('reviewBooking.nextStep2Cash') : t('reviewBooking.nextStep2Card'),
                t('reviewBooking.nextStep3'),
              ].map((step, i) => (
                <View key={i} className="mb-3 flex-row items-start">
                  <View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-brand-500">
                    <Text className="text-xs font-bold text-white">{i + 1}</Text>
                  </View>
                  <Text className={`flex-1 text-sm leading-5 ${subtextColor}`}>{step}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {isWebLayout && (
          <View
            // mr-8: the page gutter on the window side, as every page has (the column pads itself).
            className={`${cardBg} border ${borderColor} mr-8 rounded-2xl`}
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
        <StickyFooter className={`${cardBg} border-t ${borderColor} ${gutter.px} py-4`}>
          {confirmButton}
        </StickyFooter>
      )}
    </ScreenLayout>
  );
}
