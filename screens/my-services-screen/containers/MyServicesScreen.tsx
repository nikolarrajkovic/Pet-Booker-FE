import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, themeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';

interface PricingTier {
  duration: string;
  price: string;
}

interface AdditionalServiceEntry {
  name: string;
  price: string;
  enabled: boolean;
}

interface WorkingHours {
  [day: string]: { enabled: boolean; startTime: string; endTime: string };
}

interface Service {
  id: string;
  type: string;
  name: string;
  description: string;
  rating: number;
  reviews: number;
  bookings: number;
  images: string[];
  pricingTiers: PricingTier[];
  additionalServices: AdditionalServiceEntry[];
  workingHours: WorkingHours;
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
  Monday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Tuesday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Wednesday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Thursday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Friday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Saturday: { enabled: true, startTime: '08:00 AM', endTime: '06:00 PM' },
  Sunday: { enabled: false, startTime: '08:00 AM', endTime: '06:00 PM' },
};

const MOCK_SERVICES: Service[] = [
  {
    id: '1',
    type: 'Dog Walking',
    name: 'Premium Dog Walking in Golden Gate Park',
    description: "Experienced dog walker with 5+ years caring for dogs of all sizes. I love exploring Golden Gate Park's trails and ensuring your pup gets plenty of exercise and socialization.",
    rating: 4.9,
    reviews: 127,
    bookings: 342,
    images: [],
    pricingTiers: [
      { duration: '30 minutes', price: '25' },
      { duration: '1 hour', price: '35' },
      { duration: '2 hours', price: '60' },
    ],
    additionalServices: [
      { name: 'Pickup', price: '10', enabled: true },
      { name: 'Drop-off', price: '10', enabled: true },
      { name: 'Photo Updates', price: '0', enabled: true },
    ],
    workingHours: DEFAULT_WORKING_HOURS,
  },
  {
    id: '2',
    type: 'Dog Boarding',
    name: 'Comfortable Dog Boarding at My Home',
    description: "Safe and cozy home environment for your dog while you're away. I provide personal attention, daily walks, and photo updates throughout their stay.",
    rating: 4.8,
    reviews: 89,
    bookings: 215,
    images: [],
    pricingTiers: [
      { duration: '2 hours', price: '75' },
      { duration: '3 hours', price: '95' },
    ],
    additionalServices: [
      { name: 'Pickup', price: '15', enabled: true },
      { name: 'Drop-off', price: '15', enabled: true },
      { name: 'Photo Updates', price: '0', enabled: true },
    ],
    workingHours: DEFAULT_WORKING_HOURS,
  },
  {
    id: '3',
    type: 'Pet Sitting',
    name: 'In-Home Pet Sitting & Care',
    description: 'Reliable pet sitter providing personalized care in your home. Perfect for cats, dogs, and small animals.',
    rating: 5.0,
    reviews: 64,
    bookings: 178,
    images: [],
    pricingTiers: [
      { duration: 'Full day', price: '50' },
      { duration: 'Overnight', price: '80' },
    ],
    additionalServices: [
      { name: 'Photo Updates', price: '0', enabled: true },
    ],
    workingHours: DEFAULT_WORKING_HOURS,
  },
];

const ADDITIONAL_SERVICE_ICONS: Record<string, string> = {
  'Pickup': 'car-outline',
  'Drop-off': 'car-outline',
  'Photo Updates': 'camera-outline',
  'Medication Administration': 'medkit-outline',
  'Special Needs Care': 'heart-outline',
};

export default function MyServicesScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useThemeColors();
  const [services, setServices] = useState<Service[]>(MOCK_SERVICES);

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Service',
      'Are you sure you want to delete this service? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setServices(prev => prev.filter(s => s.id !== id)),
        },
      ]
    );
  };

  const handleEdit = (service: Service) => {
    (navigation as any).navigate('AddEditService', { mode: 'edit', service });
  };

  const addNewButton = (
    <TouchableOpacity
      onPress={() => (navigation as any).navigate('AddEditService', { mode: 'add' })}
      className="bg-white/20 rounded-full px-3 py-1.5 flex-row items-center"
    >
      <Ionicons name="add" size={16} color="white" />
      <Text className="text-white font-semibold ml-1 text-sm">Add New</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenLayout
      showBackButton
      headerTitle="My Services"
      headerSubtitle={`${services.length} active services`}
      rightAction={addNewButton}
      contentBg={isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50'}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-4" style={{ gap: 16 }}>
          {services.map(service => (
            <ServiceListCard
              key={service.id}
              service={service}
              isDarkMode={isDarkMode}
              onEdit={() => handleEdit(service)}
              onDelete={() => handleDelete(service.id)}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

function ServiceListCard({
  service,
  isDarkMode,
  onEdit,
  onDelete,
}: {
  service: Service;
  isDarkMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { cardBg, textColor, subtextColor, inputBg: pricingBg } = themeColors(isDarkMode);

  const enabledAdditional = service.additionalServices.filter(s => s.enabled);

  return (
    <View
      className={`${cardBg} rounded-2xl overflow-hidden`}
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
    >
      {/* Image Area */}
      <View className="relative bg-gray-200" style={{ height: 180 }}>
        <View className="flex-1 items-center justify-center">
          <Ionicons name="paw-outline" size={52} color="#C4C9D4" />
        </View>

        {/* Edit / Delete overlay buttons */}
        <View className="absolute top-3 right-3 flex-row" style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={onEdit}
            className="w-9 h-9 bg-white rounded-full items-center justify-center"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 }}
          >
            <Ionicons name="pencil" size={15} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            className="w-9 h-9 bg-red-500 rounded-full items-center justify-center"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 }}
          >
            <Ionicons name="trash-outline" size={15} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Content */}
      <View className="p-4">
        {/* Service type badge */}
        <View className="self-start rounded-full px-3 py-0.5 mb-2" style={{ backgroundColor: '#E6F9F1', borderWidth: 1, borderColor: '#86EFAC' }}>
          <Text style={{ color: '#16A34A', fontSize: 11, fontWeight: '600' }}>{service.type}</Text>
        </View>

        {/* Name */}
        <Text className={`text-base font-bold ${textColor} mb-1`}>{service.name}</Text>

        {/* Description */}
        <Text className={`text-sm ${subtextColor} mb-3`} numberOfLines={2}>{service.description}</Text>

        {/* Rating row */}
        <View className="flex-row items-center mb-3">
          <Ionicons name="star" size={14} color="#FBBF24" />
          <Text className={`text-sm font-semibold ${textColor} ml-1`}>{service.rating}</Text>
          <Text className={`text-sm ${subtextColor} ml-0.5`}>({service.reviews})</Text>
          <View className="w-1 h-1 bg-gray-400 rounded-full mx-2" />
          <Text className={`text-sm ${subtextColor}`}>{service.bookings} bookings</Text>
        </View>

        {/* Pricing section */}
        <View className={`${pricingBg} rounded-xl p-3 mb-3`}>
          <Text className={`text-xs font-semibold ${subtextColor} mb-2`}>Pricing Options</Text>
          <View className="flex-row flex-wrap" style={{ gap: 4 }}>
            {service.pricingTiers.map((tier, i) => (
              <Text key={i} className={`text-sm ${textColor}`}>
                {tier.duration}:{' '}
                <Text className="text-brand-500 font-semibold">${tier.price}</Text>
                {i < service.pricingTiers.length - 1 ? (
                  <Text className={subtextColor}>{'  \u2022'}</Text>
                ) : null}
              </Text>
            ))}
          </View>
        </View>

        {/* Additional Services */}
        {enabledAdditional.length > 0 && (
          <View>
            <Text className={`text-xs font-semibold ${subtextColor} mb-2`}>Additional Services</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {enabledAdditional.map((svc, i) => (
                <View key={i} className={`flex-row items-center ${pricingBg} rounded-lg px-2 py-1`}>
                  <Ionicons
                    name={(ADDITIONAL_SERVICE_ICONS[svc.name] || 'checkmark-circle-outline') as any}
                    size={13}
                    color="#6B7280"
                  />
                  <Text className={`text-xs ${subtextColor} ml-1`}>
                    {svc.name}{parseFloat(svc.price) > 0 ? ` $${svc.price}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
