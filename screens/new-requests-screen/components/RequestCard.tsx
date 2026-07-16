import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocale } from '../../../context/LocaleContext';

export type RequestStatus = 'new' | 'accepted' | 'declined';

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
  petBreed: string;
  petAge: string;
  petWeight: string;
  petImage: string | null;
  petSpecialNeeds: string | null;
  petType: 'dog' | 'cat' | 'other';
  // Service info
  serviceName: string;
  serviceDate: string;
  serviceTime: string;
  serviceLocation: string;
  duration: string;
  totalPrice: number;
  additionalServices: string[];
  notesFromOwner: string;
  status: RequestStatus;
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
}: RequestCardProps) {
  const { t } = useLocale();
  const sectionBg = isDarkMode ? 'bg-[#243447]' : 'bg-gray-50';
  const specialNeedsBg = isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50';

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
            <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
          </View>
          <View className="flex-1">
            <Text className={`text-base font-bold ${textColor}`}>{request.clientName}</Text>
            <Text className={`text-xs ${subtextColor}`}>{request.postedAgo}</Text>
          </View>
        </View>
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
          <Text className={`text-xs ${subtextColor} mt-0.5`}>
            {request.petBreed} • {request.petAge}
          </Text>
          <Text className={`text-xs ${subtextColor} mt-0.5`}>{request.petWeight}</Text>
        </View>
      </View>

      {/* Special needs */}
      {request.petSpecialNeeds && (
        <View className={`mx-4 mb-3 ${specialNeedsBg} flex-row items-center rounded-xl p-3`}>
          <Ionicons name="warning-outline" size={16} color="#D97706" style={{ marginRight: 8 }} />
          <Text className="flex-1 text-xs font-medium text-yellow-700">
            {t('requests.specialNeeds', { text: request.petSpecialNeeds ?? '' })}
          </Text>
        </View>
      )}

      {/* Service info */}
      <View className="mx-4 mb-3">
        <Text className={`text-xs font-medium ${subtextColor} mb-1`}>
          {t('requests.serviceRequested')}
        </Text>
        <Text className={`text-base font-bold ${textColor} mb-2`}>{request.serviceName}</Text>

        <View className="mb-1.5 flex-row items-center">
          <Ionicons name="calendar-outline" size={14} color="#00C870" style={{ marginRight: 6 }} />
          <Text className={`text-sm ${subtextColor}`}>{request.serviceDate}</Text>
        </View>
        <View className="mb-1.5 flex-row items-center">
          <Ionicons name="time-outline" size={14} color="#00C870" style={{ marginRight: 6 }} />
          <Text className={`text-sm ${subtextColor}`}>{request.serviceTime}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="location-outline" size={14} color="#00C870" style={{ marginRight: 6 }} />
          <Text className={`text-sm ${subtextColor}`}>{request.serviceLocation}</Text>
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
          <Text className="text-sm font-bold text-green-600">${request.totalPrice}</Text>
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

      {/* Action buttons — only shown for new requests */}
      {request.status === 'new' && (
        <View className={`flex-row border-t ${borderColor}`}>
          <TouchableOpacity
            onPress={() => onDecline(request.id)}
            activeOpacity={0.7}
            className="flex-1 flex-row items-center justify-center py-4">
            <Ionicons name="close" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text className="text-sm font-semibold text-red-500">{t('requests.decline')}</Text>
          </TouchableOpacity>
          <View className={`w-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
          <TouchableOpacity
            onPress={() => onAccept(request.id)}
            activeOpacity={0.7}
            className="flex-1 flex-row items-center justify-center rounded-br-2xl bg-brand-500 py-4">
            <Ionicons name="checkmark" size={16} color="white" style={{ marginRight: 6 }} />
            <Text className="text-sm font-semibold text-white">{t('requests.accept')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Status badge for accepted/declined */}
      {request.status !== 'new' && (
        <View
          className={`mx-4 mb-4 items-center rounded-xl py-2 ${
            request.status === 'accepted' ? 'bg-green-50' : 'bg-red-50'
          }`}>
          <Text
            className={`text-sm font-semibold ${
              request.status === 'accepted' ? 'text-green-600' : 'text-red-500'
            }`}>
            {request.status === 'accepted'
              ? t('requests.acceptedBadge')
              : t('requests.declinedBadge')}
          </Text>
        </View>
      )}
    </View>
  );
}
