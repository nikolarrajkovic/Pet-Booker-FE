import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

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
  const enableModalBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-green-50';

  return (
    <View className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <SafeAreaView className="bg-brand-500">
        <View className="px-4 py-16 flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-3 w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-white">Notifications</Text>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Enable Push Notifications Card */}
        {showEnableModal && !pushNotifications && (
          <View className={`${enableModalBg} mx-4 mt-4 rounded-2xl p-6 border ${isDarkMode ? 'border-[#243447]' : 'border-green-100'}`}>
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-brand-500 items-center justify-center mb-3">
                <Ionicons name="notifications" size={28} color="white" />
              </View>
              <Text className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-[#1a365d]'} mb-2`}>
                Enable Push Notifications
              </Text>
              <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center`}>
                Stay updated with booking confirmations, reminders, and messages from your pet care providers.
              </Text>
            </View>
            
            <TouchableOpacity 
              className="bg-brand-500 py-3 rounded-xl mb-2"
              onPress={() => setPushNotifications(true)}
            >
              <Text className="text-white text-center font-semibold text-base">
                Enable Notifications
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setShowEnableModal(false)}
              className="py-2"
            >
              <Text className={`text-center font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notification Channels */}
        <View className="px-4 mt-6">
          <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>
            Notification Channels
          </Text>

          <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
            {/* Push Notifications */}
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Ionicons name="phone-portrait-outline" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                <View className="ml-3 flex-1">
                  <Text className={`text-base font-semibold ${textColor}`}>
                    Push Notifications
                  </Text>
                  <Text className={`text-sm ${subtextColor} mt-0.5`}>
                    Receive notifications on this device
                  </Text>
                </View>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                thumbColor="white"
                ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
              />
            </View>

            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />

            {/* Email Notifications */}
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Ionicons name="mail-outline" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                <View className="ml-3 flex-1">
                  <Text className={`text-base font-semibold ${textColor}`}>
                    Email Notifications
                  </Text>
                  <Text className={`text-sm ${subtextColor} mt-0.5`}>
                    Receive updates via email
                  </Text>
                </View>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                thumbColor="white"
                ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
              />
            </View>
          </View>
        </View>

        {/* What You'll Receive */}
        <View className="px-4 mt-6">
          <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>
            What You'll Receive
          </Text>

          <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
            {/* Booking Updates */}
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className={`text-base font-semibold ${textColor}`}>
                  Booking Updates
                </Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>
                  Confirmations, cancellations, and changes
                </Text>
              </View>
              <Switch
                value={bookingUpdates}
                onValueChange={setBookingUpdates}
                trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                thumbColor="white"
                ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
              />
            </View>

            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />

            {/* Appointment Reminders */}
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className={`text-base font-semibold ${textColor}`}>
                  Appointment Reminders
                </Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>
                  Get reminded before your appointments
                </Text>
              </View>
              <Switch
                value={appointmentReminders}
                onValueChange={setAppointmentReminders}
                trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                thumbColor="white"
                ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
              />
            </View>

            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />

            {/* Messages */}
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className={`text-base font-semibold ${textColor}`}>
                  Messages
                </Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>
                  New messages from pet care providers
                </Text>
              </View>
              <Switch
                value={messages}
                onValueChange={setMessages}
                trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                thumbColor="white"
                ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
              />
            </View>

            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />

            {/* Promotions & Offers */}
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className={`text-base font-semibold ${textColor}`}>
                  Promotions & Offers
                </Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>
                  Special deals and discounts
                </Text>
              </View>
              <Switch
                value={promotions}
                onValueChange={setPromotions}
                trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                thumbColor="white"
                ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
              />
            </View>

            <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />

            {/* New Services */}
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className={`text-base font-semibold ${textColor}`}>
                  New Services
                </Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>
                  New pet care services in your area
                </Text>
              </View>
              <Switch
                value={newServices}
                onValueChange={setNewServices}
                trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                thumbColor="white"
                ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
              />
            </View>
          </View>
        </View>

        {/* Quiet Hours */}
        <View className="px-4 mt-6 mb-6">
          <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>
            Quiet Hours
          </Text>

          <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
            {/* Do Not Disturb */}
            <View className="px-4 py-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <MaterialIcons name="do-not-disturb-on" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
                <View className="ml-3 flex-1">
                  <Text className={`text-base font-semibold ${textColor}`}>
                    Do Not Disturb
                  </Text>
                  <Text className={`text-sm ${subtextColor} mt-0.5`}>
                    Mute non-urgent notifications from 10:00 PM to 8:00 AM
                  </Text>
                </View>
              </View>
              <Switch
                value={doNotDisturb}
                onValueChange={setDoNotDisturb}
                trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                thumbColor="white"
                ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
              />
            </View>

            {doNotDisturb && (
              <>
                <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
                <TouchableOpacity className="px-4 py-3">
                  <Text className="text-brand-500 font-semibold text-sm">
                    Customize Schedule
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Info Text */}
          <View className="flex-row mt-4 px-3">
            <Ionicons name="information-circle" size={16} color="#60a5fa" style={{ marginTop: 2 }} />
            <Text className={`text-xs ${subtextColor} ml-2 flex-1`}>
              You can manage notification permissions in your device settings at any time.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
