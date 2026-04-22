import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export type RequestStatus = 'new' | 'accepted' | 'declined';

export interface ServiceRequest {
  id: number;
  clientName: string;
  clientAvatar: string | null;
  clientEmail: string;
  clientPhone: string;
  postedAgo: string;
  petName: string;
  petBreed: string;
  petAge: string;
  petWeight: string;
  petImage: string | null;
  petSpecialNeeds: string | null;
  petType: 'dog' | 'cat' | 'other';
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
  const sectionBg = isDarkMode ? 'bg-[#243447]' : 'bg-gray-50';
  const specialNeedsBg = isDarkMode ? 'bg-yellow-900/30' : 'bg-yellow-50';

  return (
    <View className={`${cardBg} rounded-2xl mb-4 border ${borderColor} overflow-hidden`}>
      {/* Client header */}
      <View className="p-4 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View className="relative mr-3">
            {request.clientAvatar ? (
              <Image source={{ uri: request.clientAvatar }} className="w-12 h-12 rounded-full" resizeMode="cover" />
            ) : (
              <View className={`w-12 h-12 rounded-full ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} items-center justify-center`}>
                <Ionicons name="person" size={24} color="#9CA3AF" />
              </View>
            )}
            <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
          </View>
          <View className="flex-1">
            <Text className={`text-base font-bold ${textColor}`}>{request.clientName}</Text>
            <Text className={`text-xs ${subtextColor}`}>{request.postedAgo}</Text>
          </View>
        </View>
        <Text className="text-2xl">{petTypeEmoji[request.petType]}</Text>
      </View>

      {/* Pet info */}
      <View className={`mx-4 mb-3 ${sectionBg} rounded-xl p-3 flex-row`}>
        {request.petImage ? (
          <Image source={{ uri: request.petImage }} className="w-16 h-16 rounded-xl mr-3" resizeMode="cover" />
        ) : (
          <View className={`w-16 h-16 rounded-xl mr-3 ${isDarkMode ? 'bg-[#1a2332]' : 'bg-gray-200'} items-center justify-center`}>
            <MaterialCommunityIcons name="paw" size={28} color="#9CA3AF" />
          </View>
        )}
        <View className="flex-1 justify-center">
          <Text className={`text-base font-bold ${textColor}`}>{request.petName}</Text>
          <Text className={`text-xs ${subtextColor} mt-0.5`}>{request.petBreed} • {request.petAge}</Text>
          <Text className={`text-xs ${subtextColor} mt-0.5`}>{request.petWeight}</Text>
        </View>
      </View>

      {/* Special needs */}
      {request.petSpecialNeeds && (
        <View className={`mx-4 mb-3 ${specialNeedsBg} rounded-xl p-3 flex-row items-center`}>
          <Ionicons name="warning-outline" size={16} color="#D97706" style={{ marginRight: 8 }} />
          <Text className="text-yellow-700 text-xs font-medium flex-1">Special Needs: {request.petSpecialNeeds}</Text>
        </View>
      )}

      {/* Service info */}
      <View className="mx-4 mb-3">
        <Text className={`text-xs font-medium ${subtextColor} mb-1`}>Service Requested</Text>
        <Text className={`text-base font-bold ${textColor} mb-2`}>{request.serviceName}</Text>
        <View className="flex-row items-center mb-1.5">
          <Ionicons name="calendar-outline" size={14} color="#00C870" style={{ marginRight: 6 }} />
          <Text className={`text-sm ${subtextColor}`}>{request.serviceDate}</Text>
        </View>
        <View className="flex-row items-center mb-1.5">
          <Ionicons name="time-outline" size={14} color="#00C870" style={{ marginRight: 6 }} />
          <Text className={`text-sm ${subtextColor}`}>{request.serviceTime}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="location-outline" size={14} color="#00C870" style={{ marginRight: 6 }} />
          <Text className={`text-sm ${subtextColor}`}>{request.serviceLocation}</Text>
        </View>
      </View>

      {/* Duration & price */}
      <View className={`mx-4 mb-3 ${sectionBg} rounded-xl p-3 flex-row justify-between`}>
        <View>
          <Text className={`text-xs ${subtextColor} mb-0.5`}>Duration</Text>
          <Text className={`text-sm font-bold ${textColor}`}>{request.duration}</Text>
        </View>
        <View className="items-end">
          <Text className={`text-xs ${subtextColor} mb-0.5`}>Total Price</Text>
          <Text className="text-sm font-bold text-green-600">${request.totalPrice}</Text>
        </View>
      </View>

      {/* Additional services */}
      {request.additionalServices.length > 0 && (
        <View className="mx-4 mb-3">
          <Text className={`text-xs font-medium ${subtextColor} mb-2`}>Additional Services</Text>
          <View className="flex-row flex-wrap gap-2">
            {request.additionalServices.map((svc) => (
              <View key={svc} className={`px-3 py-1 rounded-full border ${borderColor} ${isDarkMode ? 'bg-[#243447]' : 'bg-white'}`}>
                <Text className={`text-xs ${textColor}`}>{svc}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Notes */}
      {!!request.notesFromOwner && (
        <View className="mx-4 mb-4">
          <Text className={`text-xs font-medium ${subtextColor} mb-1`}>Notes from owner</Text>
          <Text className={`text-sm ${subtextColor} leading-5`}>{request.notesFromOwner}</Text>
        </View>
      )}

      {/* Accept / Decline */}
      {request.status === 'new' && (
        <View className={`flex-row border-t ${borderColor}`}>
          <TouchableOpacity onPress={() => onDecline(request.id)} activeOpacity={0.7} className="flex-1 py-4 flex-row items-center justify-center">
            <Ionicons name="close" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text className="text-red-500 font-semibold text-sm">Decline</Text>
          </TouchableOpacity>
          <View className={`w-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`} />
          <TouchableOpacity onPress={() => onAccept(request.id)} activeOpacity={0.7} className="flex-1 py-4 flex-row items-center justify-center bg-brand-500 rounded-br-2xl">
            <Ionicons name="checkmark" size={16} color="white" style={{ marginRight: 6 }} />
            <Text className="text-white font-semibold text-sm">Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Status badge */}
      {request.status !== 'new' && (
        <View className={`mx-4 mb-4 py-2 rounded-xl items-center ${request.status === 'accepted' ? 'bg-green-50' : 'bg-red-50'}`}>
          <Text className={`text-sm font-semibold ${request.status === 'accepted' ? 'text-green-600' : 'text-red-500'}`}>
            {request.status === 'accepted' ? '✓ Accepted' : '✕ Declined'}
          </Text>
        </View>
      )}
    </View>
  );
}
