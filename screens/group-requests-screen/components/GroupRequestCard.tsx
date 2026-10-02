import React from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { resolveImageUrl } from '../../../services/service-providers';
import { addressLabel } from '../../../services/geocoding';
import {
  GroupBookingResponse,
  type GroupBookingRequestDto,
} from '../../../services/group-booking-requests';
import { formatRequestWindow, sentAgo } from '../groupRequestFormat';

type Props = {
  request: GroupBookingRequestDto;
  busy?: boolean;
  /** Absent on the history tabs — there is nothing left to decide. */
  onAccept?: (request: GroupBookingRequestDto) => void;
  onDecline?: (request: GroupBookingRequestDto) => void;
  onOpenBooking?: (bookingId: number) => void;
};

/**
 * One group request as a provider sees it: the pet, when, roughly where, and the owner's note —
 * what they need to decide — plus whether they were named personally or matched an open request.
 * The street address is not on it until they have accepted (the server withholds it).
 */
export default function GroupRequestCard({
  request: r,
  busy,
  onAccept,
  onDecline,
  onOpenBooking,
}: Props) {
  const { isDarkMode, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t, tEnum } = useLocale();
  // The provider sees only their own recipient row; `isInvited` on it means the owner named them.
  const named = r.recipients.some((x) => x.isInvited);
  const canAccept = r.myEligibleServices.length > 0;
  const photo = resolveImageUrl(r.petPhotoUrl);

  return (
    <View className={`mb-3 rounded-2xl border p-4 ${borderColor} ${cardBg}`}>
      <View className="flex-row items-start">
        {photo ? (
          <Image source={{ uri: photo }} className="h-14 w-14 rounded-xl" resizeMode="cover" />
        ) : (
          <View
            className={`h-14 w-14 items-center justify-center rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <Ionicons name="paw" size={22} color="#9CA3AF" />
          </View>
        )}
        <View className="ml-3 flex-1">
          <Text className={`text-base font-semibold ${textColor}`}>
            {r.petName ?? t('requests.pet')}
            {r.petSpecies ? (
              <Text className={`text-sm font-normal ${subtextColor}`}>
                {' · '}
                {tEnum('petSpeciesType', r.petSpecies)}
                {r.petBreed ? `, ${r.petBreed}` : ''}
              </Text>
            ) : null}
          </Text>
          <Text className="mt-0.5 text-sm text-brand-600">
            {tEnum('serviceProviderType', r.serviceType)}
          </Text>
          <Text className={`mt-0.5 text-xs ${subtextColor}`}>
            {r.userFirstName ? `${r.userFirstName} · ` : ''}
            {sentAgo(t, r)}
          </Text>
        </View>
        <View
          className={`rounded-full px-2.5 py-1 ${named ? 'bg-brand-500' : isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`}>
          <Text className={`text-[11px] font-semibold ${named ? 'text-white' : 'text-brand-600'}`}>
            {named ? t('groupRequest.badgeNamed') : t('groupRequest.badgeOpen')}
          </Text>
        </View>
      </View>

      <View className="mt-3" style={{ gap: 6 }}>
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={15} color={BRAND_GREEN} />
          <Text className={`ml-2 flex-1 text-sm ${textColor}`}>
            {formatRequestWindow(t, r.bookingFrom, r.bookingTo)}
          </Text>
        </View>
        {(r.address || r.city) && (
          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={15} color={BRAND_GREEN} />
            <Text numberOfLines={2} className={`ml-2 flex-1 text-sm ${textColor}`}>
              {r.address ? addressLabel(r.address) : r.city}
            </Text>
          </View>
        )}
        {r.note ? (
          <View className={`mt-1 rounded-xl p-3 ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'}`}>
            <Text className={`text-xs font-semibold ${subtextColor}`}>
              {t('groupRequest.noteFromOwner')}
            </Text>
            <Text className={`mt-1 text-sm ${textColor}`}>{r.note}</Text>
          </View>
        ) : null}
      </View>

      {r.myResponse === GroupBookingResponse.Declined && r.recipients[0]?.declineReason ? (
        <Text className={`mt-3 text-xs italic ${subtextColor}`}>
          {r.recipients[0].declineReason}
        </Text>
      ) : null}

      {onAccept && onDecline ? (
        <View className="mt-4">
          {!canAccept && (
            <Text className="mb-2 text-xs text-amber-600">
              {t('groupRequest.noFittingService')}
            </Text>
          )}
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onDecline(r)}
              className={`flex-1 items-center rounded-xl border py-3 ${borderColor}`}>
              <Text className={`font-semibold ${textColor}`}>{t('requests.decline')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy || !canAccept}
              onPress={() => onAccept(r)}
              className={`flex-1 items-center rounded-xl py-3 ${canAccept ? 'bg-brand-500' : 'bg-gray-300'}`}>
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-semibold text-white">{t('requests.accept')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : r.bookingId && onOpenBooking ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onOpenBooking(r.bookingId!)}
          className="mt-4 flex-row items-center self-start">
          <Text className="text-sm font-semibold text-brand-600">
            {t('groupRequest.viewBooking')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={BRAND_GREEN} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
