import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { EnableNotificationsCard, NotificationToggle } from '../components';
import {
  getNotificationSettings,
  saveNotificationSettings,
  defaultNotificationSettings,
  UserNotificationSettingsDto,
} from '../../../services/notifications';

// "HH:MM:SS" → "10:00 PM"
function formatTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

export default function NotificationSettingsScreen() {
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor } = useThemeColors();

  const [settings, setSettings] = useState<UserNotificationSettingsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEnableModal, setShowEnableModal] = useState(true);
  const [saveError, setSaveError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const userId = currentUser?.id;
      if (!userId) {
        setIsLoading(false);
        return;
      }
      (async () => {
        setIsLoading(true);
        try {
          const record = await getNotificationSettings(userId);
          if (!cancelled) setSettings(record ?? defaultNotificationSettings(userId));
        } catch {
          if (!cancelled) setSettings(defaultNotificationSettings(userId));
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [currentUser?.id])
  );

  // Apply a change locally (responsive) and persist it. Persisting may fail for
  // accounts missing a domain Users row (see BACKEND_GAPS N1) — handled gracefully.
  const update = (partial: Partial<UserNotificationSettingsDto>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      saveNotificationSettings(next)
        .then((saved) => {
          setSaveError(false);
          setSettings((cur) => (cur ? { ...cur, id: saved.id ?? cur.id } : cur));
        })
        .catch(() => setSaveError(true));
      return next;
    });
  };

  const bgColor = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const borderColor = isDarkMode ? 'border-[#243447]' : 'border-gray-200';
  const sectionHeaderColor = isDarkMode ? 'text-white' : 'text-[#1a365d]';

  const s = settings ?? defaultNotificationSettings(currentUser?.id ?? 0);
  const dndRange = `${formatTime(s.dndStartTime) || '10:00 PM'} to ${formatTime(s.dndEndTime) || '8:00 AM'}`;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle="Notification Settings"
      contentBg={bgColor}>
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#00C870" />
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {showEnableModal && !s.pushEnabled && (
            <EnableNotificationsCard
              isDarkMode={isDarkMode}
              onEnable={() => update({ pushEnabled: true })}
              onDismiss={() => setShowEnableModal(false)}
            />
          )}

          {saveError && (
            <View className="mx-4 mt-4 flex-row items-center rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
              <Ionicons
                name="warning-outline"
                size={16}
                color="#D97706"
                style={{ marginRight: 8 }}
              />
              <Text className="flex-1 text-xs text-yellow-700">
                Couldn’t save your last change. It’s applied on this device only.
              </Text>
            </View>
          )}

          {/* Notification Channels */}
          <View className="mt-6 px-4">
            <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>
              Notification Channels
            </Text>
            <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
              <NotificationToggle
                icon="phone-portrait-outline"
                title="Push Notifications"
                subtitle="Receive notifications on this device"
                value={s.pushEnabled}
                onValueChange={(v) => update({ pushEnabled: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                icon="mail-outline"
                title="Email Notifications"
                subtitle="Receive updates via email"
                value={s.emailEnabled}
                onValueChange={(v) => update({ emailEnabled: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
            </View>
          </View>

          {/* What You'll Receive */}
          <View className="mt-6 px-4">
            <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>
              What You’ll Receive
            </Text>
            <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
              <NotificationToggle
                title="Booking Updates"
                subtitle="Confirmations, cancellations, and changes"
                value={s.bookingUpdates}
                onValueChange={(v) => update({ bookingUpdates: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                title="Appointment Reminders"
                subtitle="Get reminded before your appointments"
                value={s.appointmentReminders}
                onValueChange={(v) => update({ appointmentReminders: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                title="Messages"
                subtitle="New messages from pet care providers"
                value={s.messages}
                onValueChange={(v) => update({ messages: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                title="Promotions & Offers"
                subtitle="Special deals and discounts"
                value={s.promotionsOffers}
                onValueChange={(v) => update({ promotionsOffers: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                title="New Services"
                subtitle="New pet care services in your area"
                value={s.newServices}
                onValueChange={(v) => update({ newServices: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
            </View>
          </View>

          {/* Quiet Hours */}
          <View className="mb-6 mt-6 px-4">
            <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>Quiet Hours</Text>
            <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
              <View className="flex-row items-center justify-between px-4 py-4">
                <View className="flex-1 flex-row items-center">
                  <MaterialIcons
                    name="do-not-disturb-on"
                    size={20}
                    color={isDarkMode ? '#9ca3af' : '#6b7280'}
                  />
                  <View className="ml-3 flex-1">
                    <Text className={`text-base font-semibold ${textColor}`}>Do Not Disturb</Text>
                    <Text className={`text-sm ${subtextColor} mt-0.5`}>
                      Mute non-urgent notifications from {dndRange}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={s.dndEnabled}
                  onValueChange={(v) => update({ dndEnabled: v })}
                  trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: '#00C870' }}
                  thumbColor="white"
                  ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
                />
              </View>
              {s.dndEnabled && (
                <>
                  <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
                  <TouchableOpacity className="px-4 py-3">
                    <Text className="text-sm font-semibold text-brand-500">Customize Schedule</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <View className="mt-4 flex-row px-3">
              <Ionicons
                name="information-circle"
                size={16}
                color="#60a5fa"
                style={{ marginTop: 2 }}
              />
              <Text className={`text-xs ${subtextColor} ml-2 flex-1`}>
                You can manage notification permissions in your device settings at any time.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenLayout>
  );
}
