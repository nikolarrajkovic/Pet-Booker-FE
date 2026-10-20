import React, { useState } from 'react';
import { ScrollView, Text, View, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ReviewModal from '../../../components/shared/ReviewModal';
import ReasonPromptModal from '../../../components/shared/ReasonPromptModal';
import ServicePhoto from '../../../components/shared/ServicePhoto';
import { useReviewModal } from '../../../hooks/useReviewModal';
import { useResource } from '../../../hooks/useResource';
import {
  getBooking,
  bookingToViewModel,
  cancelBooking,
  declineBooking,
  markNoShow,
  canMarkNoShow,
  BookingStatusType,
  PaymentType,
  type BookingAdditionalServiceReadDto,
} from '../../../services/bookings';
import { useToast } from '../../../context/ToastContext';
import { getErrorMessage } from '../../../services/http';
import { formatMoney } from '../../../services/currency';
import { resolveImageUrl } from '../../../services/service-providers';
import { addressLabel, mapsSearchUrl } from '../../../services/geocoding';
import { customerName } from '../../../services/users';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { useAuth } from '../../../context/AuthContext';
import BookingPaymentPanel from '../components/BookingPaymentPanel';
import TwoColumn from '../../../components/shared/TwoColumn';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatKm } from '../../../i18n/numbers';

type RouteParams = { bookingId: number };

// statusLabel string → { badge style, BookingState enum value } (label via tEnum).
// 'in-progress' gets the loudest badge — the service is happening right now.
const STATUS_STYLE: Record<string, { bg: string; text: string; state: number }> = {
  upcoming: { bg: 'bg-blue-100', text: 'text-blue-700', state: 0 },
  completed: { bg: 'bg-green-100', text: 'text-green-700', state: 1 },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', state: 2 },
  booked: { bg: 'bg-indigo-100', text: 'text-indigo-700', state: 3 },
  'in-progress': { bg: 'bg-amber-100', text: 'text-amber-700', state: 4 },
  expired: { bg: 'bg-gray-100', text: 'text-gray-600', state: 5 },
};

export default function BookingDetailsScreen() {
  const gutter = usePageGutter();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { bookingId } = route.params;
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const { t, tEnum } = useLocale();

  const { showError, showSuccess } = useToast();
  const { currentUser } = useAuth();
  const navigation = useNavigation();

  // Read through the shared cache rather than a private `useState` seeded once on mount. This
  // screen is pushed over the list and stays mounted while you go deeper (a live session, the
  // review form), so a mount-only fetch showed the booking exactly as it was when it opened —
  // through a provider confirming it, starting the service, or re-pricing it. It now refreshes
  // on focus, on returning to the app, and the moment any write touches bookings.
  const {
    data: dto,
    isLoading,
    error,
    refresh,
    setData: setDto,
  } = useResource(['bookings', bookingId], () => getBooking(bookingId), {
    errorFallback: t('bookingDetails.loadFailed'),
  });
  const [isCancelling, setIsCancelling] = useState(false);
  // Re-fetch after a review is submitted so the recap shows the new rating.
  const review = useReviewModal(() => refresh());

  const vm = dto ? bookingToViewModel(dto) : null;
  const heroImage = vm?.image || '';
  const status = STATUS_STYLE[vm?.statusLabel ?? 'upcoming'] ?? STATUS_STYLE.upcoming;
  const pickup = dto?.pickupAddress;
  const dropoff = dto?.leaveOverAddress;
  // Where the service happens (its own address, else the partner's). The page had no "where" at
  // all unless a pickup or drop-off was booked (app review G8).
  const serviceAddress = dto?.serviceAddress ?? null;
  // The booking's frozen bill lines. On READ these come back enriched (name / price / baseFee /
  // perKmFee / distanceKm); the id-only write shape has no `name`, so narrow to the read one
  // rather than rendering "undefined" for a booking that was just submitted.
  const addOnLines = (dto?.additionalServices ?? []).filter(
    (line): line is BookingAdditionalServiceReadDto => 'name' in line
  );
  const reviewRating = dto?.review?.rating ?? null;
  const isNoShow = dto?.currentStatus === BookingStatusType.CustomerNoShow;
  const isCompleted = vm?.statusLabel === 'completed';
  // The partner opens this screen too (accepting a group request lands here), and every action
  // on it is the customer's: a partner was offered "Cancel booking", which the API refuses them,
  // and "Leave a review" on their own work. The partner sees who the booking is for instead.
  const isCustomer = currentUser?.id != null && dto != null && currentUser.id === dto.userId;
  const isProvider =
    !!currentUser?.serviceProviderId &&
    dto != null &&
    currentUser.serviceProviderId === dto.serviceProviderId;
  // Either side can open the booking's thread (the server decides whether it is still writable).
  // A partner had no way at all to reach a customer; a customer only had the Upcoming card.
  // Not for an admin reading someone else's booking, and not once it was called off.
  const canMessage =
    (isCustomer || isProvider) && vm != null && vm.statusLabel !== 'cancelled' && !dto?.isExpired;
  const openChat = () => {
    if (!dto) return;
    (navigation as any).navigate('Chat', {
      bookingId: dto.id ?? bookingId,
      subtitle: vm?.serviceName,
    });
  };

  // The owner may call off a booking any time before the provider starts the service — the same
  // window CancelBookingCommand allows server-side. Once it is ServiceStarted or later the API
  // refuses, so offering the button there would only produce an error.
  const CANCELLABLE_STATUSES: number[] = [
    BookingStatusType.ServiceRequestedByUser,
    BookingStatusType.ServiceConfirmedByProvider,
    BookingStatusType.PrePayment,
  ];
  // An expired booking is over without having happened — nothing left to call off.
  const canCancel =
    isCustomer &&
    dto != null &&
    !dto.isExpired &&
    CANCELLABLE_STATUSES.includes(dto.currentStatus ?? -1);
  const [isCancelPromptOpen, setIsCancelPromptOpen] = useState(false);
  // Paid the deposit, so cancelling now keeps it (G5): said in the prompt, before they confirm.
  const cancelKeepsDeposit =
    dto != null &&
    dto.currentStatus === BookingStatusType.PrePayment &&
    dto.paymentType !== PaymentType.Cash &&
    (dto.depositAmount ?? 0) > 0;

  // The partner's own ways out of a booking they accepted (G4, G6): call it off before it starts,
  // the customer refunded in full; or, once it was due, record that the customer never came.
  const canCallOff =
    isProvider &&
    dto != null &&
    !dto.isExpired &&
    (dto.currentStatus === BookingStatusType.ServiceConfirmedByProvider ||
      dto.currentStatus === BookingStatusType.PrePayment);
  const canRecordNoShow = isProvider && dto != null && canMarkNoShow(dto);
  const [providerPrompt, setProviderPrompt] = useState<'callOff' | 'noShow' | null>(null);
  const [isProviderActing, setIsProviderActing] = useState(false);
  const confirmProviderAction = async (reason: string) => {
    if (!dto?.id || !providerPrompt) return;
    const action = providerPrompt;
    setIsProviderActing(true);
    try {
      if (action === 'callOff') await declineBooking(dto.id, reason);
      else await markNoShow(dto.id, reason);
      setProviderPrompt(null);
      // Re-read rather than take the transition's response: it carries no pet, user or service.
      refresh();
      showSuccess(
        t(action === 'callOff' ? 'bookingDetails.callOffSuccess' : 'bookingDetails.noShowSuccess')
      );
    } catch (e) {
      showError(
        getErrorMessage(
          e,
          t(action === 'callOff' ? 'bookingDetails.callOffFailed' : 'bookingDetails.noShowFailed')
        )
      );
    } finally {
      setIsProviderActing(false);
    }
  };

  // Asks why first: the reason is stored on the booking and shown to the provider. The app used to
  // send a fixed English sentence, so a provider never learned why a booking was called off.
  const handleCancel = () => {
    if (dto) setIsCancelPromptOpen(true);
  };
  const confirmCancel = async (reason: string) => {
    if (!dto) return;
    setIsCancelling(true);
    try {
      const updated = await cancelBooking(dto, reason);
      setDto(updated);
      setIsCancelPromptOpen(false);
      showSuccess(t('bookingDetails.cancelSuccess'));
    } catch (e) {
      showError(getErrorMessage(e, t('bookingDetails.cancelFailed')));
    } finally {
      setIsCancelling(false);
    }
  };
  const petImage = resolveImageUrl(
    dto?.pet?.photos?.find((p) => p.isSelected)?.src ?? dto?.pet?.photos?.[0]?.src
  );

  const Row = ({
    icon,
    label,
    value,
    media,
  }: {
    icon: string;
    label: string;
    value: string;
    /** Drawn just before the value — the pet's photo beside its name. */
    media?: React.ReactNode;
  }) => (
    <View className={`flex-row items-center justify-between border-b py-3 ${borderColor}`}>
      <View className="mr-3 flex-1 flex-row items-center">
        <Ionicons name={icon as any} size={18} color={BRAND_GREEN} />
        <Text className={`text-sm ${subtextColor} ml-3`}>{label}</Text>
      </View>
      <View className="flex-1 flex-row items-center justify-end">
        {media}
        <Text className={`text-sm font-semibold ${textColor} shrink text-right`} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );

  // The page's sections, laid out per design below.
  const header =
    dto && vm ? (
      <>
        {/* Service / provider header */}
        <View className={`flex-row items-center ${gutter.px} pt-5`}>
          <ServicePhoto uri={heroImage} thumbWidth={240} iconSize={30} className="mr-4 h-20 w-20" />
          <View className="flex-1">
            <Text className={`text-lg font-bold ${textColor}`}>{vm.serviceName}</Text>
            <Text className={`text-sm ${subtextColor} mt-0.5`}>{vm.providerName}</Text>
            <View className={`mt-2 self-start rounded-full px-2.5 py-1 ${status.bg}`}>
              <Text className={`text-xs font-semibold ${status.text}`}>
                {isNoShow ? t('bookingDetails.noShowBadge') : tEnum('bookingState', status.state)}
              </Text>
            </View>
          </View>
        </View>

        {isNoShow ? (
          <View className={`mt-4 ${gutter.px}`}>
            <View
              className={`flex-row items-center rounded-xl px-4 py-3 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
              <Ionicons
                name="person-remove-outline"
                size={18}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
              <Text
                className={`ml-2 flex-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {isCustomer
                  ? t('bookingDetails.noShowNotice')
                  : t('bookingDetails.noShowNoticeProvider')}
              </Text>
            </View>
          </View>
        ) : null}

        {dto.isExpired ? (
          <View className={`mt-4 ${gutter.px}`}>
            <View
              className={`flex-row items-center rounded-xl px-4 py-3 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'}`}>
              <Ionicons name="time-outline" size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <Text
                className={`ml-2 flex-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('bookingDetails.expiredNotice')}
              </Text>
            </View>
          </View>
        ) : null}
      </>
    ) : null;
  const appointment =
    dto && vm ? (
      <>
        {/* Appointment */}
        <View className={`mt-6 ${gutter.px}`}>
          <Text className={`text-base font-bold ${textColor} mb-1`}>
            {t('bookingDetails.appointment')}
          </Text>
          <Row icon="calendar-outline" label={t('bookingDetails.date')} value={vm.date} />
          <Row icon="time-outline" label={t('bookingDetails.time')} value={vm.timeRange} />
          {/* The pet's photo sits in its own row; it used to repeat below the section with
                  the name again, unlabelled. ServicePhoto layers a paw behind a photo that 404s. */}
          <Row
            icon="paw-outline"
            label={t('bookingDetails.pet')}
            value={dto.pet?.name ?? vm.petName}
            media={
              petImage ? (
                <ServicePhoto
                  uri={petImage}
                  radiusClass="rounded-lg"
                  iconSize={14}
                  fit="cover"
                  className="mr-2 h-8 w-8"
                />
              ) : null
            }
          />
          {isCustomer ? (
            <Row
              icon="person-outline"
              label={t('bookingDetails.provider')}
              value={vm.providerName}
            />
          ) : (
            <Row
              icon="person-outline"
              label={t('bookingDetails.customer')}
              value={customerName(dto.user, '—')}
            />
          )}
          {canMessage ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={openChat}
              activeOpacity={0.85}
              className="mt-4 flex-row items-center justify-center rounded-2xl border-2 border-brand-500 py-3">
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={BRAND_GREEN} />
              <Text className="ml-2 text-base font-semibold text-brand-600">
                {isCustomer ? t('messages.messageProvider') : t('messages.messageCustomer')}
              </Text>
            </TouchableOpacity>
          ) : null}
          {/* Why it was called off, as the person who did it wrote it. */}
          {vm.statusLabel === 'cancelled' && dto.cancelReason ? (
            <Row
              icon="chatbox-ellipses-outline"
              label={t('bookingDetails.cancelReasonLabel')}
              value={dto.cancelReason}
            />
          ) : null}
        </View>
      </>
    ) : null;
  const location =
    dto && vm ? (
      <>
        {/* Location */}
        {(serviceAddress || pickup || dropoff) && (
          <View className={`mt-6 ${gutter.px}`}>
            <Text className={`text-base font-bold ${textColor} mb-1`}>
              {t('bookingDetails.location')}
            </Text>
            {serviceAddress ? (
              <>
                <Row
                  icon="location-outline"
                  label={t('bookingDetails.where')}
                  value={addressLabel(serviceAddress)}
                />
                <TouchableOpacity
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(mapsSearchUrl(serviceAddress)).catch(() => {})}
                  className="flex-row items-center self-end py-2">
                  <Ionicons name="map-outline" size={16} color={BRAND_GREEN} />
                  <Text className="ml-1.5 text-sm font-semibold text-brand-600">
                    {t('bookingDetails.openInMaps')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
            {pickup ? (
              <Row
                icon="car-outline"
                label={t('bookingDetails.pickup')}
                value={addressLabel(pickup)}
              />
            ) : null}
            {dropoff ? (
              <Row
                icon="home-outline"
                label={t('bookingDetails.dropoff')}
                value={addressLabel(dropoff)}
              />
            ) : null}
          </View>
        )}
      </>
    ) : null;
  const payment =
    dto && vm ? (
      <>
        {/* Payment */}
        <View className={`mt-6 ${gutter.px}`}>
          <Text className={`text-base font-bold ${textColor} mb-1`}>
            {t('bookingDetails.payment')}
          </Text>
          <Row
            icon="card-outline"
            label={t('bookingDetails.method')}
            value={dto.paymentType != null ? tEnum('paymentType', dto.paymentType, '—') : '—'}
          />
          <View className={`flex-row items-center justify-between border-b py-3 ${borderColor}`}>
            <Text className={`text-sm ${subtextColor}`}>{t('bookingDetails.subtotal')}</Text>
            <Text className={`text-sm ${textColor}`}>
              {formatMoney(dto.basePrice, dto.priceCurrency)}
            </Text>
          </View>
          {dto.discountAmount > 0 && (
            <View className={`flex-row items-center justify-between border-b py-3 ${borderColor}`}>
              <Text className={`text-sm ${subtextColor}`}>{t('bookingDetails.discount')}</Text>
              <Text className="text-sm text-brand-600">
                - {formatMoney(dto.discountAmount, dto.priceCurrency)}
              </Text>
            </View>
          )}

          {/*
                The extras the booking was actually charged for. Without these the screen jumped
                straight from a base price to a total that could be several times larger with no
                explanation — on a per-distance extra the add-ons are most of the bill. The lines
                are the server's own, frozen when the booking was priced, so a per-distance one
                already carries the fees and its measured distance: render them rather than
                recomputing the surcharge formula (which must never be mirrored client-side).
              */}
          {addOnLines.map((line, i) => {
            const perKmCharge = line.price - (line.baseFee ?? 0);
            return (
              <View key={line.id ?? `${line.name}-${i}`} className={`border-b py-3 ${borderColor}`}>
                <View className="flex-row items-center justify-between">
                  <Text className={`text-sm ${subtextColor} flex-1 pr-2`}>{line.name}</Text>
                  <Text className={`text-sm ${textColor}`}>
                    {formatMoney(line.price, dto.priceCurrency)}
                  </Text>
                </View>
                {line.baseFee != null && line.distanceKm != null && (
                  <View className={`ml-1 mt-1.5 border-l pl-3 ${borderColor}`}>
                    <View className="mb-1 flex-row justify-between">
                      <Text className={`text-xs ${subtextColor}`}>
                        {t('reviewBooking.addonStartFee')}
                      </Text>
                      <Text className={`text-xs ${subtextColor}`}>
                        {formatMoney(line.baseFee, dto.priceCurrency)}
                      </Text>
                    </View>
                    {perKmCharge > 0 && (
                      <View className="flex-row justify-between">
                        <Text className={`text-xs ${subtextColor} flex-1 pr-2`}>
                          {t('reviewBooking.addonDistance', {
                            km: formatKm(line.distanceKm, 2),
                            rate: formatMoney(line.perKmFee ?? 0, dto.priceCurrency),
                          })}
                        </Text>
                        <Text className={`text-xs ${subtextColor}`}>
                          {formatMoney(perKmCharge, dto.priceCurrency)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <View className="flex-row items-center justify-between py-3">
            <Text className={`text-base font-bold ${textColor}`}>{t('bookingDetails.total')}</Text>
            <Text className="text-xl font-bold text-brand-600">
              {formatMoney(dto.totalPrice, dto.priceCurrency)}
            </Text>
          </View>

          {/* Paid / refunded / owed, and the customer's Pay buttons. */}
          <BookingPaymentPanel
            bookingId={dto.id ?? bookingId}
            currentStatus={dto.currentStatus ?? -1}
            isExpired={!!dto.isExpired}
            paymentType={dto.paymentType}
            isCustomer={isCustomer}
            isProvider={isProvider}
            userId={dto.userId}
            onPaid={refresh}
          />
        </View>
      </>
    ) : null;
  const reviewBlock =
    dto && vm ? (
      <>
        {/* Review — show the existing rating, or a CTA for completed bookings */}
        {reviewRating != null ? (
          <View className={`mt-6 ${gutter.px}`}>
            <Text className={`text-base font-bold ${textColor} mb-2`}>
              {isCustomer ? t('bookingDetails.yourReview') : t('bookingDetails.customersReview')}
            </Text>
            <View className="flex-row items-center">
              {[1, 2, 3, 4, 5].map((v) => (
                <Ionicons
                  key={v}
                  name={v <= reviewRating ? 'star' : 'star-outline'}
                  size={22}
                  color="#F59E0B"
                  style={{ marginRight: 4 }}
                />
              ))}
            </View>
          </View>
        ) : isCompleted && isCustomer ? (
          <View className={`mt-6 ${gutter.px}`}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() =>
                review.open({
                  bookingId: dto.id ?? bookingId,
                  serviceProviderId: dto.serviceProviderId,
                  serviceId: dto.serviceId,
                  serviceName: vm.serviceName,
                })
              }
              activeOpacity={0.85}
              className="flex-row items-center justify-center rounded-2xl bg-brand-500 py-4">
              <Ionicons name="star" size={18} color="white" />
              <Text className="ml-2 text-base font-bold text-white">
                {t('bookingDetails.leaveAReview')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </>
    ) : null;
  const cancelBlock =
    dto && vm ? (
      <>
        {/* Cancel — the owner's own way out, available until the service starts. */}
        {canCancel ? (
          <View className={`mt-6 ${gutter.px}`}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('bookingDetails.cancelBooking')}
              disabled={isCancelling}
              onPress={handleCancel}
              activeOpacity={0.85}
              className={`flex-row items-center justify-center rounded-2xl border-2 border-red-500 py-4 ${
                isCancelling ? 'opacity-50' : ''
              }`}>
              {isCancelling ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                  <Text className="ml-2 text-base font-bold text-red-500">
                    {t('bookingDetails.cancelBooking')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* The partner's: record a no-show once it was due, or call off what they accepted. */}
        {canRecordNoShow || canCallOff ? (
          <View className={`mt-6 ${gutter.px}`} style={{ gap: 10 }}>
            {canRecordNoShow ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isProviderActing}
                onPress={() => setProviderPrompt('noShow')}
                activeOpacity={0.85}
                className="flex-row items-center justify-center rounded-2xl border-2 border-amber-500 py-4">
                <Ionicons name="person-remove-outline" size={18} color="#F59E0B" />
                <Text className="ml-2 text-base font-bold text-amber-600">
                  {t('bookingDetails.noShow')}
                </Text>
              </TouchableOpacity>
            ) : null}
            {canCallOff ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isProviderActing}
                onPress={() => setProviderPrompt('callOff')}
                activeOpacity={0.85}
                className="flex-row items-center justify-center rounded-2xl border-2 border-red-500 py-4">
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text className="ml-2 text-base font-bold text-red-500">
                  {t('bookingDetails.cancelBooking')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </>
    ) : null;

  return (
    <>
      <ScreenLayout
        headerVariant="standard"
        showBackButton
        headerTitle={t('bookingDetails.title')}
        contentBg={bgColor}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color={BRAND_GREEN} />
          </View>
        ) : error || !dto || !vm ? (
          <View className={`flex-1 items-center justify-center ${gutter.px} py-20`}>
            <Ionicons
              name="alert-circle-outline"
              size={56}
              color={isDarkMode ? '#6B7280' : '#9CA3AF'}
            />
            <Text className={`${subtextColor} mt-4 text-center`}>
              {error ?? t('bookingDetails.notFound')}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
            {isWebLayout ? (
              // A recap beside its bill: the booking on the left, what it costs and the ways to
              // pay or call it off in a sticky card on the right. One column stretched a two-word
              // label and its value across the whole window.
              <View className={`${gutter.px} pt-5`}>
                <TwoColumn
                  asideWidth={400}
                  aside={
                    <View className={`${cardBg} rounded-2xl border ${borderColor} pb-5`}>
                      {payment}
                      {cancelBlock}
                    </View>
                  }>
                  <View className={`${cardBg} rounded-2xl border ${borderColor} pb-5`}>
                    {header}
                    {appointment}
                    {location}
                    {reviewBlock}
                  </View>
                </TwoColumn>
              </View>
            ) : (
              <>
                {header}
                {appointment}
                {location}
                {payment}
                {reviewBlock}
                {cancelBlock}
              </>
            )}
          </ScrollView>
        )}
      </ScreenLayout>

      <ReasonPromptModal
        visible={isCancelPromptOpen}
        title={t('bookingDetails.cancelReasonTitle')}
        subtitle={
          cancelKeepsDeposit && dto
            ? `${t('bookingDetails.cancelReasonSubtitle')}\n\n${t(
                'bookingDetails.cancelKeepsDeposit',
                {
                  amount: formatMoney(dto.depositAmount ?? 0, dto.priceCurrency),
                }
              )}`
            : t('bookingDetails.cancelReasonSubtitle')
        }
        placeholder={t('bookingDetails.cancelReasonPlaceholder')}
        tooShortMessage={t('bookingDetails.cancelReasonTooShort')}
        confirmLabel={t('bookingDetails.cancelConfirm')}
        submitting={isCancelling}
        onClose={() => setIsCancelPromptOpen(false)}
        onConfirm={confirmCancel}
      />

      <ReasonPromptModal
        visible={providerPrompt !== null}
        title={
          providerPrompt === 'noShow'
            ? t('bookingDetails.noShowTitle')
            : t('bookingDetails.callOffTitle')
        }
        subtitle={
          providerPrompt === 'noShow'
            ? t('bookingDetails.noShowSubtitle')
            : t('bookingDetails.callOffSubtitle')
        }
        placeholder={
          providerPrompt === 'noShow'
            ? t('bookingDetails.noShowPlaceholder')
            : t('bookingDetails.callOffPlaceholder')
        }
        tooShortMessage={t('bookingDetails.cancelReasonTooShort')}
        confirmLabel={
          providerPrompt === 'noShow'
            ? t('bookingDetails.noShowConfirm')
            : t('bookingDetails.cancelBooking')
        }
        submitting={isProviderActing}
        onClose={() => setProviderPrompt(null)}
        onConfirm={confirmProviderAction}
      />

      <ReviewModal
        visible={review.target !== null}
        serviceName={review.target?.serviceName}
        submitting={review.submitting}
        onClose={review.close}
        onSubmit={review.submit}
      />
    </>
  );
}
