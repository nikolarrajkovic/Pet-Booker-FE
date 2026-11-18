import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';
import { formatMoney } from '../../../services/currency';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
// 'expired': a request nobody answered before its start time; it can no longer be accepted.
export type RequestStatus = 'new' | 'accepted' | 'declined' | 'expired';

export interface ServiceRequest {
  id: number;
  // Client info
  clientName: string;
  clientAvatar: string | null;
  clientEmail: string;
  clientPhone: string;
  postedAgo: string;
  // Pet info
  petName: string;
  /** Species, breed, sex, age and weight, the ones known. */
  petFacts: string[];
  petImage: string | null;
  /** The owner marked the pet as having special needs. */
  petHasSpecialNeeds: boolean;
  /** The owner's care notes, labelled. */
  petNotes: { label: string; value: string }[];
  petType: 'dog' | 'cat' | 'other';
  // Service info
  serviceName: string;
  serviceDate: string;
  serviceTime: string;
  /** Where to collect and return the pet, when the booking has a journey. */
  pickupAddress: string;
  dropoffAddress: string;
  /** How it is paid: cash at the service, or by card (with its deposit, when one is asked). */
  paymentLine: string;
  paidInCash: boolean;
  /** For a request still waiting: when it stops being answerable. */
  answerBy: string;
  duration: string;
  totalPrice: number;
  /** The service price alone (the total also carries the extras) — what Adjust price edits. */
  basePrice: number;
  currency: string | null; // the booking's priceCurrency (server-stamped from the provider)
  additionalServices: string[];
  notesFromOwner: string;
  /** A higher total the partner asked for, waiting for the customer; null when none waits. */
  proposedTotal?: number | null;
  status: RequestStatus;
  /** For an expired one: true when it had been accepted but was never started, false when it was never answered. */
  expiredAfterAccepting?: boolean;
}

interface RequestCardProps {
  request: ServiceRequest;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  /** Re-price a request before accepting it; omitted, the action is not offered. */
  onAdjustPrice?: (id: number) => void;
  /** Open this booking's thread with the customer; omitted, the action is not offered. */
  onMessage?: (id: number) => void;
  /** Open the booking's own page; omitted, the link is not offered. */
  onOpen?: (id: number) => void;
}

const petTypeEmoji: Record<string, string> = {
  dog: '🐕',
  cat: '🐈',
  other: '🐾',
};

export default function RequestCard({
  request,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  onAccept,
  onDecline,
  onAdjustPrice,
  onMessage,
  onOpen,
}: RequestCardProps) {
  const { t } = useLocale();
  const sectionBg = isDarkMode ? 'bg-[#243447]' : 'bg-gray-50';
  const specialNeedsBg = isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50';
  const petFacts = request.petFacts.join(' • ');

  return (
    <View className={`${cardBg} mb-4 rounded-2xl border ${borderColor} overflow-hidden`}>
      {/* Client header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-1 flex-row items-center">
          <View className="relative mr-3">
            {request.clientAvatar ? (
              <Image
                source={{ uri: request.clientAvatar }}
                className="h-12 w-12 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <View
                className={`h-12 w-12 rounded-full ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} items-center justify-center`}>
                <Ionicons name="person" size={24} color="#9CA3AF" />
              </View>
            )}
          </View>
          <View className="flex-1">
            <Text className={`text-base font-bold ${textColor}`}>{request.clientName}</Text>
            <Text className={`text-xs ${subtextColor}`}>{request.postedAgo}</Text>
          </View>
        </View>
        {onMessage ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('messages.messageCustomer')}
            onPress={() => onMessage(request.id)}
            hitSlop={8}
            className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-brand-50">
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={BRAND_GREEN} />
          </TouchableOpacity>
        ) : null}
        <Text className="text-2xl">{petTypeEmoji[request.petType]}</Text>
      </View>

      {/* Pet info */}
      <View className={`mx-4 mb-3 ${sectionBg} flex-row rounded-xl p-3`}>
        {request.petImage ? (
          <Image
            source={{ uri: request.petImage }}
            className="mr-3 h-16 w-16 rounded-xl"
            resizeMode="cover"
          />
        ) : (
          <View
            className={`mr-3 h-16 w-16 rounded-xl ${isDarkMode ? 'bg-[#1a2332]' : 'bg-gray-200'} items-center justify-center`}>
            <MaterialCommunityIcons name="paw" size={28} color="#9CA3AF" />
          </View>
        )}
        <View className="flex-1 justify-center">
          <Text className={`text-base font-bold ${textColor}`}>{request.petName}</Text>
          {/* Joined from whatever is known, so a pet with no breed/age on record doesn't render a
              lone "•" under its name. */}
          {petFacts ? <Text className={`text-xs ${subtextColor} mt-0.5`}>{petFacts}</Text> : null}
        </View>
      </View>

      {/* Special needs: the owner's own flag, said before the partner decides. */}
      {request.petHasSpecialNeeds ? (
        <View className={`mx-4 mb-3 ${specialNeedsBg} flex-row items-center rounded-xl p-3`}>
          <Ionicons name="warning-outline" size={16} color="#D97706" style={{ marginRight: 8 }} />
          <Text
            className={`flex-1 text-xs font-medium ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
            {t('requests.specialNeedsFlag')}
          </Text>
        </View>
      ) : null}

      {/* The owner's care notes on the pet. */}
      {request.petNotes.length > 0 ? (
        <View className="mx-4 mb-3">
          {request.petNotes.map((note) => (
            <Text key={note.label} className={`text-xs ${subtextColor} mb-1 leading-4`}>
              <Text className={`font-semibold ${textColor}`}>{note.label}: </Text>
              {note.value}
            </Text>
          ))}
        </View>
      ) : null}

      {/* Service info */}
      <View className="mx-4 mb-3">
        <Text className={`text-xs font-medium ${subtextColor} mb-1`}>
          {t('requests.serviceRequested')}
        </Text>
        <Text className={`text-base font-bold ${textColor} mb-2`}>{request.serviceName}</Text>

        <View className="mb-1.5 flex-row items-center">
          <Ionicons
            name="calendar-outline"
            size={14}
            color={BRAND_GREEN}
            style={{ marginRight: 6 }}
          />
          <Text className={`text-sm ${subtextColor}`}>{request.serviceDate}</Text>
        </View>
        <View className="mb-1.5 flex-row items-center">
          <Ionicons name="time-outline" size={14} color={BRAND_GREEN} style={{ marginRight: 6 }} />
          <Text className={`text-sm ${subtextColor}`}>{request.serviceTime}</Text>
        </View>
        {/* Where the journey goes, when the customer booked one. */}
        {request.pickupAddress ? (
          <View className="mb-1.5 flex-row items-start">
            <Ionicons
              name="car-outline"
              size={14}
              color={BRAND_GREEN}
              style={{ marginRight: 6, marginTop: 2 }}
            />
            <Text className={`flex-1 text-sm ${subtextColor}`}>
              {t('bookingDetails.pickup')}: {request.pickupAddress}
            </Text>
          </View>
        ) : null}
        {request.dropoffAddress ? (
          <View className="mb-1.5 flex-row items-start">
            <Ionicons
              name="home-outline"
              size={14}
              color={BRAND_GREEN}
              style={{ marginRight: 6, marginTop: 2 }}
            />
            <Text className={`flex-1 text-sm ${subtextColor}`}>
              {t('bookingDetails.dropoff')}: {request.dropoffAddress}
            </Text>
          </View>
        ) : null}
        {/* Cash or card: decides whether the partner collects money at the door. */}
        <View className="flex-row items-start">
          <Ionicons
            name={request.paidInCash ? 'cash-outline' : 'card-outline'}
            size={14}
            color={BRAND_GREEN}
            style={{ marginRight: 6, marginTop: 2 }}
          />
          <Text className={`flex-1 text-sm ${subtextColor}`}>{request.paymentLine}</Text>
        </View>
      </View>

      {/* Duration & price */}
      <View className={`mx-4 mb-3 ${sectionBg} flex-row justify-between rounded-xl p-3`}>
        <View>
          <Text className={`text-xs ${subtextColor} mb-0.5`}>{t('requests.duration')}</Text>
          <Text className={`text-sm font-bold ${textColor}`}>{request.duration}</Text>
        </View>
        <View className="items-end">
          <Text className={`text-xs ${subtextColor} mb-0.5`}>{t('requests.totalPrice')}</Text>
          <Text className="text-sm font-bold text-green-600">
            {formatMoney(request.totalPrice, request.currency)}
          </Text>
        </View>
      </View>

      {/* Additional services */}
      {request.additionalServices.length > 0 && (
        <View className="mx-4 mb-3">
          <Text className={`text-xs font-medium ${subtextColor} mb-2`}>
            {t('requests.additionalServices')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {request.additionalServices.map((svc) => (
              <View
                key={svc}
                className={`rounded-full border px-3 py-1 ${borderColor} ${isDarkMode ? 'bg-[#243447]' : 'bg-white'}`}>
                <Text className={`text-xs ${textColor}`}>{svc}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Notes from owner */}
      {request.notesFromOwner ? (
        <View className="mx-4 mb-4">
          <Text className={`text-xs font-medium ${subtextColor} mb-1`}>
            {t('requests.notesFromOwner')}
          </Text>
          <Text className={`text-sm ${subtextColor} leading-5`}>{request.notesFromOwner}</Text>
        </View>
      ) : null}

      {/* A request nobody answers expires at its start time: say so while it can be answered. */}
      {request.status === 'new' && request.answerBy ? (
        <View className="mx-4 mb-3 flex-row items-center">
          <Ionicons name="hourglass-outline" size={14} color="#D97706" style={{ marginRight: 6 }} />
          <Text className={`flex-1 text-xs ${subtextColor}`}>
            {t('requests.answerBy', { when: request.answerBy })}
          </Text>
        </View>
      ) : null}

      {/* A higher price waits for the customer: accepting it confirms the booking for them. */}
      {request.status === 'new' && request.proposedTotal != null ? (
        <View className="mx-4 mb-3 flex-row items-center">
          <Ionicons name="pricetag-outline" size={14} color="#D97706" style={{ marginRight: 6 }} />
          <Text className={`flex-1 text-xs ${subtextColor}`}>
            {t('requests.priceWaiting', {
              price: formatMoney(request.proposedTotal, request.currency),
            })}
          </Text>
        </View>
      ) : null}

      <View className="mx-4 mb-3 flex-row flex-wrap items-center" style={{ gap: 16 }}>
        {/* Re-price before accepting (the server refuses once the booking is confirmed). */}
        {request.status === 'new' && onAdjustPrice ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => onAdjustPrice(request.id)}
            activeOpacity={0.7}
            className="flex-row items-center">
            <Ionicons name="pricetag-outline" size={15} color={BRAND_GREEN} />
            <Text className="ml-1.5 text-sm font-semibold text-brand-600">
              {t('requests.adjustPrice')}
            </Text>
          </TouchableOpacity>
        ) : null}
        {/* The booking's own page: its bill, its payments, calling it off, the no-show. */}
        {onOpen ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => onOpen(request.id)}
            activeOpacity={0.7}
            className="flex-row items-center">
            <Ionicons name="open-outline" size={15} color={BRAND_GREEN} />
            <Text className="ml-1.5 text-sm font-semibold text-brand-600">
              {t('requests.viewBooking')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Action buttons — only shown for new requests */}
      {request.status === 'new' && (
        <View className={`flex-row border-t ${borderColor}`}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => onDecline(request.id)}
            activeOpacity={0.7}
            className="flex-1 flex-row items-center justify-center py-4">
            <Ionicons name="close" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text className="text-sm font-semibold text-red-500">{t('requests.decline')}</Text>
          </TouchableOpacity>
          {/* While a higher price waits, the customer's answer is what confirms (or withdraws) it. */}
          {request.proposedTotal == null ? (
            <View className={`w-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
          ) : null}
          {request.proposedTotal == null ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => onAccept(request.id)}
              activeOpacity={0.7}
              className="flex-1 flex-row items-center justify-center rounded-br-2xl bg-brand-500 py-4">
              <Ionicons name="checkmark" size={16} color="white" style={{ marginRight: 6 }} />
              <Text className="text-sm font-semibold text-white">{t('requests.accept')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Status badge for accepted / declined / expired */}
      {request.status !== 'new' && (
        <View
          className={`mx-4 mb-4 items-center rounded-xl py-2 ${
            request.status === 'accepted'
              ? 'bg-green-50'
              : request.status === 'expired'
                ? 'bg-gray-100'
                : 'bg-red-50'
          }`}>
          <Text
            className={`text-sm font-semibold ${
              request.status === 'accepted'
                ? 'text-green-600'
                : request.status === 'expired'
                  ? 'text-gray-600'
                  : 'text-red-500'
            }`}>
            {request.status === 'accepted'
              ? t('requests.acceptedBadge')
              : request.status === 'expired'
                ? request.expiredAfterAccepting
                  ? t('requests.expiredNotStartedBadge')
                  : t('requests.expiredBadge')
                : t('requests.declinedBadge')}
          </Text>
        </View>
      )}
    </View>
  );
}
