import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import TabBar from '../../../components/shared/TabBar';

// ─── Mock data ─────────────────────────────────────────────────────────────────
const STATS_THIS_MONTH = {
  totalRevenue: '$45,280',
  revenueChange: '+16.3%',
  servicesScheduled: '342',
  servicesChange: '+14.8%',
  newPartners: '12',
  newPartnersChange: '+50.0%',
  activePartners: '87',
};

const STATS_THIS_YEAR = {
  totalRevenue: '$524,190',
  revenueChange: '+22.1%',
  servicesScheduled: '3,890',
  servicesChange: '+18.4%',
  newPartners: '64',
  newPartnersChange: '+34.0%',
  activePartners: '87',
};

const REVENUE_THIS_MONTH = [
  { label: 'Dog Walking', value: 15848, display: '$15,848', color: '#3B82F6' },
  { label: 'Grooming', value: 12678, display: '$12,678.4', color: '#8B5CF6' },
  { label: 'Pet Sitting', value: 9961, display: '$9,961.6', color: '#EC4899' },
  { label: 'Boarding', value: 6792, display: '$6,792', color: '#F97316' },
];

const REVENUE_THIS_YEAR = [
  { label: 'Dog Walking', value: 182340, display: '$182,340', color: '#3B82F6' },
  { label: 'Grooming', value: 147820, display: '$147,820', color: '#8B5CF6' },
  { label: 'Pet Sitting', value: 115690, display: '$115,690', color: '#EC4899' },
  { label: 'Boarding', value: 78340, display: '$78,340', color: '#F97316' },
];

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { isDarkMode, hex } = useThemeColors();
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  const stats = period === 'month' ? STATS_THIS_MONTH : STATS_THIS_YEAR;
  const revenueData = period === 'month' ? REVENUE_THIS_MONTH : REVENUE_THIS_YEAR;
  const maxRevenue = Math.max(...revenueData.map((r) => r.value));

  const bgColor = hex.bg;
  const cardBg = hex.card;
  const sectionTitle = hex.text;
  const subText = hex.subtext;
  const borderColor = hex.border;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#00C870' }}>
      {/* ── Header ── */}
      <View
        style={{
          backgroundColor: '#00C870',
          paddingHorizontal: 20,
          paddingTop: 48,
          paddingBottom: 36,
        }}
      >
        <Text style={{ color: 'white', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 }}>
          Admin Dashboard
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 }}>
          Platform overview and statistics
        </Text>
      </View>

      {/* ── Main content ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          marginTop: -20,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Period toggle ── */}
          <View
            style={{
              flexDirection: 'row',
              marginHorizontal: 20,
              marginTop: 24,
              marginBottom: 20,
              backgroundColor: cardBg,
              borderRadius: 14,
              padding: 4,
              borderWidth: 1,
              borderColor,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPeriod('month')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: period === 'month' ? '#00C870' : 'transparent',
              }}
            >
              <Text
                style={{
                  color: period === 'month' ? 'white' : subText,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                This Month
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPeriod('year')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: period === 'year' ? '#00C870' : 'transparent',
              }}
            >
              <Text
                style={{
                  color: period === 'year' ? 'white' : subText,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                This Year
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Stats grid (2x2) ── */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginHorizontal: 16,
              gap: 12,
              marginBottom: 24,
            }}
          >
            {/* Total Revenue */}
            <StatCard
              iconName="cash-outline"
              iconBg="#E8F5EF"
              iconColor="#00C870"
              change={stats.revenueChange}
              changeColor="#00C870"
              value={stats.totalRevenue}
              label="Total Revenue"
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
            {/* Services Scheduled */}
            <StatCard
              iconName="calendar-outline"
              iconBg="#EEF2FF"
              iconColor="#6366F1"
              change={stats.servicesChange}
              changeColor="#6366F1"
              value={stats.servicesScheduled}
              label="Services Scheduled"
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
            {/* New Partners */}
            <StatCard
              iconName="person-add-outline"
              iconBg="#F3E8FF"
              iconColor="#A855F7"
              change={stats.newPartnersChange}
              changeColor="#A855F7"
              value={stats.newPartners}
              label="New Partners"
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
            {/* Active Partners */}
            <StatCard
              iconName="people-outline"
              iconBg="#FEF3C7"
              iconColor="#F59E0B"
              change={undefined}
              changeColor="#F59E0B"
              value={stats.activePartners}
              label="Active Partners"
              cardBg={cardBg}
              sectionTitle={sectionTitle}
              subText={subText}
              borderColor={borderColor}
            />
          </View>

          {/* ── Revenue by Service Type ── */}
          <View
            style={{
              marginHorizontal: 20,
              backgroundColor: cardBg,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor,
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="bar-chart-outline" size={20} color="#00C870" />
              <Text style={{ color: sectionTitle, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                Revenue by Service Type
              </Text>
            </View>
            {revenueData.map((item) => (
              <View key={item.label} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: sectionTitle, fontSize: 13, fontWeight: '500' }}>{item.label}</Text>
                  <Text style={{ color: sectionTitle, fontSize: 13, fontWeight: '600' }}>{item.display}</Text>
                </View>
                <View style={{ height: 8, backgroundColor: isDarkMode ? '#2d3748' : '#F3F4F6', borderRadius: 4 }}>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: item.color,
                      width: `${Math.round((item.value / maxRevenue) * 100)}%`,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* ── Quick Actions ── */}
          <View style={{ marginHorizontal: 20 }}>
            <Text style={{ color: sectionTitle, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Quick Actions
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {/* New Requests */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdminNewRequests')}
                style={{
                  width: '47.5%',
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor,
                  alignItems: 'flex-start',
                }}
              >
                <View style={{ position: 'relative', marginBottom: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#FEF3C7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="document-text-outline" size={24} color="#F59E0B" />
                  </View>
                  <View
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      backgroundColor: '#F97316',
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>4 new</Text>
                  </View>
                </View>
                <Text style={{ color: sectionTitle, fontSize: 14, fontWeight: '700' }}>New Requests</Text>
                <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>Review applications</Text>
              </TouchableOpacity>

              {/* Partners */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdminPartners')}
                style={{
                  width: '47.5%',
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor,
                  alignItems: 'flex-start',
                }}
              >
                <View style={{ position: 'relative', marginBottom: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#E8F5EF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="people-outline" size={24} color="#00C870" />
                  </View>
                  <View
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      backgroundColor: '#00C870',
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>87 active</Text>
                  </View>
                </View>
                <Text style={{ color: sectionTitle, fontSize: 14, fontWeight: '700' }}>Partners</Text>
                <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>Manage partners</Text>
              </TouchableOpacity>

              {/* Add New */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AdminAddPartner')}
                style={{
                  width: '47.5%',
                  backgroundColor: cardBg,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor,
                  alignItems: 'flex-start',
                }}
              >
                <View style={{ marginBottom: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: '#EEF2FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="person-add-outline" size={24} color="#6366F1" />
                  </View>
                </View>
                <Text style={{ color: sectionTitle, fontSize: 14, fontWeight: '700' }}>Add New</Text>
                <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>Add partner manually</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ── Tab bar ── */}
      <TabBar />
    </SafeAreaView>
  );
}

// ─── Stat card sub-component ────────────────────────────────────────────────────
type StatCardProps = {
  iconName: any;
  iconBg: string;
  iconColor: string;
  change?: string;
  changeColor: string;
  value: string;
  label: string;
  cardBg: string;
  sectionTitle: string;
  subText: string;
  borderColor: string;
};

function StatCard({
  iconName,
  iconBg,
  iconColor,
  change,
  changeColor,
  value,
  label,
  cardBg,
  sectionTitle,
  subText,
  borderColor,
}: StatCardProps) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        backgroundColor: cardBg,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        {change && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: `${changeColor}18`,
              borderRadius: 8,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Ionicons name="trending-up" size={11} color={changeColor} />
            <Text style={{ color: changeColor, fontSize: 11, fontWeight: '700', marginLeft: 2 }}>{change}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: sectionTitle, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: subText, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
