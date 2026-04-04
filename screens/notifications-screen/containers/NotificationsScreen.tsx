import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { EnableNotificationsCard, NotificationToggle } from '../components';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const [showEnableModal, setShowEnableModal] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [bookingUpdates, setBookingUpdates] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [messages, setMessages] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [newServices, setNewServices] = useState(false);
  const [doNotDisturb, setDoNotDisturb] = useState(false);

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-[#243447]' : 'border-gray-200';
  const sectionHeaderColor = isDarkMode ? 'text-white' : 'text-[#1a365d]';

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Notifications"
      contentBg={bgColor}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {showEnableModal && !pushNotifications && (
          <EnableNotificationsCard
            isDarkMode={isDarkMode}
            onEnable={() => setPushNotifications(true)}
            onDismiss={() => setShowEnableModal(false)}
          />
        )}

        {/* Notification Channels */}
        <View className="px-4 mt-6">
          <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>Notification Channels</Text>
          <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
            <NotificationToggle
              icon="phone-portrait-outline"
              title="Push Notifications"
              subtitle="Receive notifications on this device"
              value={pushNotifications}
              onValueChange={setPushNotifications}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
            />
            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
            <NotificationToggle
              icon="mail-outline"
              title="Email Notifications"
              subtitle="Receive updates via email"
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
            />
          </View>
        </View>

        {/* What You'll Receive */}
        <View className="px-4 mt-6">
          <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>What You'll Receive</Text>
          <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
            <NotificationToggle title="Booking Updates" subtitle="Confirmations, cancellations, and changes" value={bookingUpdates} onValueChange={setBookingUpdates} isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
            <NotificationToggle title="Appointment Reminders" subtitle="Get reminded before your appointments" value={appointmentReminders} onValueChange={setAppointmentReminders} isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
            <NotificationToggle title="Messages" subtitle="New messages from pet care providers" value={messages} onValueChange={setMessages} isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
            <NotificationToggle title="Promotions & Offers" subtitle="Special deals and discounts" value={promotions} onValueChange={setPromotions} isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
            <NotificationToggle title="New Services" subtitle="New pet care services in your area" value={newServices} onValueChange={setNewServices} isDarkMode={isDarkMode} textColor={textColor} subtextColor={subtextColor} />
          </View>
        </View>

        {/* Quiet Hours */}
        <View className="px-4 mt-6 mb-6">
          <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>Quiet Hours</Text>
          <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <MaterialIcons name="do-not-disturb-on" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                <View className="ml-3 flex-1">
                  <Text className={`text-base font-semibold ${textColor}`}>Do Not Disturb</Text>
                  <Text className={`text-sm ${subtextColor} mt-0.5`}>Mute non-urgent notifications from 10:00 PM to 8:00 AM</Text>
                </View>
              </View>
              <Switch value={doNotDisturb} onValueChange={setDoNotDisturb} trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }} thumbColor="white" ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'} />
            </View>
            {doNotDisturb && (
              <>
                <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
                <TouchableOpacity className="px-4 py-3">
                  <Text className="text-brand-500 font-semibold text-sm">Customize Schedule</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <View className="flex-row mt-4 px-3">
            <Ionicons name="information-circle" size={16} color="#60a5fa" style={{ marginTop: 2 }} />
            <Text className={`text-xs ${subtextColor} ml-2 flex-1`}>You can manage notification permissions in your device settings at any time.</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
