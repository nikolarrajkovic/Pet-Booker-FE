import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { PartnerCard } from '../components';
import type { Partner, PartnerStatus } from '../components';

// ─── Mock data ──────────────────────────────────────────────────────────────────
export const mockPartners: Partner[] = [
  {
    id: 'P-001',
    name: 'Happy Paws Care',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300',
    status: 'active',
    rating: 4.9,
    reviews: 128,
    totalServices: 342,
    services: ['Dog Walking'],
    distance: '0.5 mi',
    joinedDate: 'Jan 2025',
    email: 'happypaws@email.com',
    phone: '(555) 111-2222',
    address: '123 Park Ave, San Francisco, CA 94102',
    bio: 'Professional dog walking service with experienced handlers. We treat every pet like family.',
    startingPrice: 25,
    avgRating: 4.9,
    documents: { profilePhoto: true, governmentId: true, insuranceCertificate: true },
    serviceHistory: [
      { id: 'S-1234', date: 'May 15, 2026', clientName: 'John Smith', service: 'Dog Walking', price: 25, status: 'completed' },
      { id: 'S-1233', date: 'May 14, 2026', clientName: 'Sarah Johnson', service: 'Dog Walking', price: 30, status: 'completed' },
      { id: 'S-1232', date: 'May 13, 2026', clientName: 'Mike Chen', service: 'Dog Walking', price: 25, status: 'cancelled' },
      { id: 'S-1231', date: 'May 12, 2026', clientName: 'Emily Davis', service: 'Dog Walking', price: 35, status: 'completed' },
      { id: 'S-1230', date: 'May 11, 2026', clientName: 'David Wilson', service: 'Dog Walking', price: 25, status: 'refunded' },
    ],
  },
  {
    id: 'P-002',
    name: 'Pampered Pets Grooming',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300',
    status: 'active',
    rating: 4.8,
    reviews: 95,
    totalServices: 287,
    services: ['Grooming'],
    distance: '1.2 mi',
    joinedDate: 'Nov 2024',
    email: 'pamperedpets@email.com',
    phone: '(555) 222-3333',
    address: '456 Oak Street, Oakland, CA 94601',
    bio: 'Award-winning grooming salon with certified groomers. Your pet deserves the best.',
    startingPrice: 45,
    avgRating: 4.8,
    documents: { profilePhoto: true, governmentId: true, insuranceCertificate: true },
    serviceHistory: [
      { id: 'S-2234', date: 'May 15, 2026', clientName: 'Lisa Park', service: 'Grooming', price: 55, status: 'completed' },
      { id: 'S-2233', date: 'May 12, 2026', clientName: 'Tom Reeves', service: 'Grooming', price: 45, status: 'completed' },
      { id: 'S-2232', date: 'May 10, 2026', clientName: 'Anna White', service: 'Grooming', price: 60, status: 'completed' },
    ],
  },
  {
    id: 'P-003',
    name: 'Cozy Pet Hotel',
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300',
    status: 'timeout',
    rating: 4.7,
    reviews: 86,
    totalServices: 198,
    services: ['Pet Sitting'],
    distance: '2.1 mi',
    joinedDate: 'Mar 2025',
    email: 'cozypet@email.com',
    phone: '(555) 333-4444',
    address: '789 Elm Drive, Berkeley, CA 94704',
    bio: 'Cozy home-based pet sitting with personalized attention for every pet.',
    startingPrice: 35,
    avgRating: 4.7,
    documents: { profilePhoto: true, governmentId: true, insuranceCertificate: false },
    serviceHistory: [
      { id: 'S-3234', date: 'Apr 28, 2026', clientName: 'James Parker', service: 'Pet Sitting', price: 35, status: 'completed' },
      { id: 'S-3233', date: 'Apr 25, 2026', clientName: 'Olivia Chen', service: 'Pet Sitting', price: 40, status: 'cancelled' },
    ],
  },
  {
    id: 'P-004',
    name: 'Fur-Ever Friends Sitting',
    image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300',
    status: 'active',
    rating: 4.9,
    reviews: 112,
    totalServices: 201,
    services: ['Dog Walking'],
    distance: '0.8 mi',
    joinedDate: 'Feb 2025',
    email: 'furever@email.com',
    phone: '(555) 444-5555',
    address: '321 Maple Blvd, San Francisco, CA 94110',
    bio: 'Passionate pet sitter with a large safe yard. Dogs and cats welcome.',
    startingPrice: 28,
    avgRating: 4.9,
    documents: { profilePhoto: true, governmentId: true, insuranceCertificate: true },
    serviceHistory: [
      { id: 'S-4234', date: 'May 16, 2026', clientName: 'Rachel Green', service: 'Dog Walking', price: 28, status: 'completed' },
      { id: 'S-4233', date: 'May 14, 2026', clientName: 'Chris Evans', service: 'Dog Walking', price: 28, status: 'completed' },
    ],
  },
  {
    id: 'P-005',
    name: 'Elite Training Center',
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300',
    status: 'active',
    rating: 5.0,
    reviews: 74,
    totalServices: 156,
    services: ['Training'],
    distance: '1.8 mi',
    joinedDate: 'Jun 2024',
    email: 'elitetraining@email.com',
    phone: '(555) 555-6666',
    address: '654 Pine Lane, San Jose, CA 95110',
    bio: 'Certified trainers specializing in behavioral correction and obedience training.',
    startingPrice: 60,
    avgRating: 5.0,
    documents: { profilePhoto: true, governmentId: true, insuranceCertificate: true },
    serviceHistory: [
      { id: 'S-5234', date: 'May 15, 2026', clientName: 'Mark Taylor', service: 'Training', price: 60, status: 'completed' },
    ],
  },
  {
    id: 'P-006',
    name: 'Quick Paws Service',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300',
    status: 'banned',
    rating: 3.2,
    reviews: 18,
    totalServices: 22,
    services: ['Dog Walking'],
    distance: '3.4 mi',
    joinedDate: 'Apr 2025',
    email: 'quickpaws@email.com',
    phone: '(555) 666-7777',
    address: '987 Cedar St, Fremont, CA 94538',
    bio: 'Dog walking service.',
    startingPrice: 15,
    avgRating: 3.2,
    documents: { profilePhoto: false, governmentId: true, insuranceCertificate: false },
    serviceHistory: [
      { id: 'S-6230', date: 'Apr 10, 2026', clientName: 'Nina Ross', service: 'Dog Walking', price: 15, status: 'refunded' },
    ],
  },
];

type FilterTab = 'all' | PartnerStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'timeout', label: 'Timeout' },
  { key: 'banned', label: 'Banned' },
];

export default function AdminPartnersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, hex } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [partners, setPartners] = useState<Partner[]>(mockPartners);

  // Receive status update back from PartnerDetailsScreen
  useFocusEffect(
    useCallback(() => {
      const updatedId = route.params?.updatedId;
      const updatedStatus = route.params?.updatedStatus as PartnerStatus | undefined;
      if (updatedId && updatedStatus) {
        setPartners((prev) =>
          prev.map((p) => (p.id === updatedId ? { ...p, status: updatedStatus } : p))
        );
        navigation.setParams({ updatedId: undefined, updatedStatus: undefined });
      }
    }, [route.params?.updatedId, route.params?.updatedStatus])
  );

  const bgColor = hex.bg;
  const cardBg = hex.card;
  const textColor = hex.text;
  const subTextColor = hex.subtext;
  const borderColor = hex.border;
  const inputBg = isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)';

  const counts: Record<FilterTab, number> = {
    all: partners.length,
    active: partners.filter((p) => p.status === 'active').length,
    timeout: partners.filter((p) => p.status === 'timeout').length,
    banned: partners.filter((p) => p.status === 'banned').length,
  };

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      const matchesTab = activeTab === 'all' || p.status === activeTab;
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [partners, activeTab, search]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#00C870' }}>
      {/* ── Header ── */}
      <View style={{ backgroundColor: '#00C870', paddingHorizontal: 20, paddingTop: insets.top > 0 ? 8 : 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'AdminDashboard' })}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>Partners</Text>
        </View>

        {/* Search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Ionicons name="search-outline" size={18} color={isDarkMode ? 'rgba(255,255,255,0.6)' : '#6B7280'} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search partners..."
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : '#9CA3AF'}
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: isDarkMode ? 'white' : '#111827' }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={isDarkMode ? 'rgba(255,255,255,0.5)' : '#9CA3AF'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      <View style={{ flex: 1, backgroundColor: bgColor, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -8 }}>
        {/* Filter tabs */}
        <View style={{ height: 60 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isActive ? '#00C870' : cardBg,
                  borderWidth: 1.5,
                  borderColor: isActive ? '#00C870' : borderColor,
                }}
              >
                <Text style={{ color: isActive ? 'white' : subTextColor, fontSize: 13, fontWeight: '600' }}>
                  {tab.label}
                </Text>
                <View
                  style={{
                    marginLeft: 6,
                    backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : (isDarkMode ? '#374151' : '#E5E7EB'),
                    borderRadius: 8,
                    minWidth: 20,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: isActive ? 'white' : subTextColor, fontSize: 11, fontWeight: '700' }}>
                    {counts[tab.key]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Ionicons name="people-outline" size={64} color={isDarkMode ? '#4B5563' : '#D1D5DB'} />
              <Text style={{ color: subTextColor, marginTop: 16, fontSize: 15, textAlign: 'center' }}>
                No partners found
              </Text>
            </View>
          ) : (
            filtered.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                isDarkMode={isDarkMode}
                cardBg={cardBg}
                textColor={textColor}
                subTextColor={subTextColor}
                borderColor={borderColor}
                onPress={() => navigation.navigate('PartnerDetails', { partner })}
              />
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
