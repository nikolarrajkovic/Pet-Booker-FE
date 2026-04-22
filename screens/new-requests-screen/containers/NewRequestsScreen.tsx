import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { RequestCard } from '../components';
import type { ServiceRequest, RequestStatus } from '../components';

const mockRequests: ServiceRequest[] = [
  {
    id: 1,
    clientName: 'Sarah Mitchell',
    clientAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    clientEmail: 'sarah.m@email.com',
    clientPhone: '+1 555 0101',
    postedAgo: '4d ago',
    petName: 'Luna',
    petBreed: 'Golden Retriever',
    petAge: '3 years',
    petWeight: '65 lbs',
    petImage: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=300',
    petSpecialNeeds: 'Needs medication at 2pm',
    petType: 'dog',
    serviceName: 'Dog Walking',
    serviceDate: 'April 16, 2026',
    serviceTime: '10:00 AM',
    serviceLocation: 'Golden Gate Park',
    duration: '1 hour',
    totalPrice: 35,
    additionalServices: ['Photo Updates'],
    notesFromOwner: 'Luna loves to play fetch! Please bring a ball.',
    status: 'new',
  },
  {
    id: 2,
    clientName: 'James Parker',
    clientAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    clientEmail: 'james.p@email.com',
    clientPhone: '+1 555 0202',
    postedAgo: '1d ago',
    petName: 'Whiskers',
    petBreed: 'Persian',
    petAge: '2 years',
    petWeight: '8 lbs',
    petImage: null,
    petSpecialNeeds: null,
    petType: 'cat',
    serviceName: 'Pet Sitting',
    serviceDate: 'April 20, 2026',
    serviceTime: '9:00 AM',
    serviceLocation: "Client's Home",
    duration: '3 hours',
    totalPrice: 60,
    additionalServices: ['Feeding', 'Litter Cleaning'],
    notesFromOwner: 'Whiskers is shy at first but warms up quickly.',
    status: 'new',
  },
  {
    id: 3,
    clientName: 'Olivia Chen',
    clientAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    clientEmail: 'olivia.c@email.com',
    clientPhone: '+1 555 0303',
    postedAgo: '5d ago',
    petName: 'Buddy',
    petBreed: 'Labrador Mix',
    petAge: '5 years',
    petWeight: '72 lbs',
    petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300',
    petSpecialNeeds: null,
    petType: 'dog',
    serviceName: 'Dog Walking',
    serviceDate: 'April 14, 2026',
    serviceTime: '8:00 AM',
    serviceLocation: 'Riverside Trail',
    duration: '1 hour',
    totalPrice: 35,
    additionalServices: [],
    notesFromOwner: '',
    status: 'accepted',
  },
  {
    id: 4,
    clientName: 'Tom Reeves',
    clientAvatar: null,
    clientEmail: 'tom.r@email.com',
    clientPhone: '+1 555 0404',
    postedAgo: '6d ago',
    petName: 'Cleo',
    petBreed: 'Siamese',
    petAge: '4 years',
    petWeight: '9 lbs',
    petImage: null,
    petSpecialNeeds: 'Allergic to certain foods',
    petType: 'cat',
    serviceName: 'Pet Sitting',
    serviceDate: 'April 12, 2026',
    serviceTime: '2:00 PM',
    serviceLocation: "Client's Home",
    duration: '2 hours',
    totalPrice: 45,
    additionalServices: ['Photo Updates'],
    notesFromOwner: 'Please only feed the food I leave out.',
    status: 'declined',
  },
];

type FilterTab = 'new' | 'accepted' | 'declined' | 'all';
const TABS: { key: FilterTab; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'all', label: 'All' },
];

export default function NewRequestsScreen() {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<FilterTab>('new');
  const [requests, setRequests] = useState<ServiceRequest[]>(mockRequests);

  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-[#F5F7FA]';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-100';
  const tabBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';

  const newCount = requests.filter((r) => r.status === 'new').length;

  const filtered = requests.filter((r) => (activeTab === 'all' ? true : r.status === activeTab));

  const handleAccept = (id: number) =>
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'accepted' as RequestStatus } : r)));

  const handleDecline = (id: number) =>
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'declined' as RequestStatus } : r)));

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="New Requests"
      headerSubtitle={`${newCount} pending request${newCount !== 1 ? 's' : ''}`}
      contentBg={contentBg}
      showNotificationButton
    >
      {/* Filter tabs */}
      <View className={`mx-4 mt-4 mb-3 ${tabBg} rounded-2xl p-1 flex-row border ${borderColor}`}>
        {TABS.map((tab) => {
          const count =
            tab.key === 'all'
              ? requests.length
              : requests.filter((r) => r.status === tab.key).length;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
              className={`flex-1 py-2 rounded-xl flex-row items-center justify-center ${isActive ? 'bg-brand-500' : ''}`}
            >
              <Text className={`text-xs font-semibold ${isActive ? 'text-white' : subtextColor}`}>{tab.label}</Text>
              {count > 0 && (
                <View className={`ml-1.5 min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${isActive ? 'bg-white/30' : 'bg-brand-500'}`}>
                  <Text className="text-[10px] font-bold text-white">{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Ionicons name="clipboard-outline" size={64} color={isDarkMode ? '#4B5563' : '#D1D5DB'} />
            <Text className={`${subtextColor} text-center mt-4 text-base`}>No {activeTab === 'all' ? '' : activeTab} requests</Text>
          </View>
        ) : (
          filtered.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isDarkMode={isDarkMode}
              cardBg={cardBg}
              textColor={textColor}
              subtextColor={subtextColor}
              borderColor={borderColor}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
