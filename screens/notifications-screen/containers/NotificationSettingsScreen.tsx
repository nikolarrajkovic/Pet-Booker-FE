import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { EnableNotificationsCard, NotificationToggle } from '../components';
import {
  getNotificationSettings,
  saveNotificationSettings,
  defaultNotificationSettings,
  UserNotificationSettingsDto,
} from '../../../services/notifications';

// "HH:MM:SS" → "22:00" (24-hour)
function formatTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return '';
  return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

export default function NotificationSettingsScreen() {
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor } = useThemeColors();
  const { t } = useLocale();

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
  const dndRange = t('notificationSettings.rangeTo', {
    from: formatTime(s.dndStartTime) || '22:00',
    to: formatTime(s.dndEndTime) || '08:00',
  });

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('notificationSettings.title')}
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
                {t('notificationSettings.saveFailed')}
              </Text>
            </View>
          )}

          {/* Notification Channels */}
          <View className="mt-6 px-4">
            <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>
              {t('notificationSettings.channels')}
            </Text>
            <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
              <NotificationToggle
                icon="phone-portrait-outline"
                title={t('notificationSettings.push')}
                subtitle={t('notificationSettings.pushSubtitle')}
                value={s.pushEnabled}
                onValueChange={(v) => update({ pushEnabled: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                icon="mail-outline"
                title={t('notificationSettings.email')}
                subtitle={t('notificationSettings.emailSubtitle')}
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
              {t('notificationSettings.whatYouReceive')}
            </Text>
            <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
              <NotificationToggle
                title={t('notificationSettings.bookingUpdates')}
                subtitle={t('notificationSettings.bookingUpdatesSubtitle')}
                value={s.bookingUpdates}
                onValueChange={(v) => update({ bookingUpdates: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                title={t('notificationSettings.reminders')}
                subtitle={t('notificationSettings.remindersSubtitle')}
                value={s.appointmentReminders}
                onValueChange={(v) => update({ appointmentReminders: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                title={t('notificationSettings.messages')}
                subtitle={t('notificationSettings.messagesSubtitle')}
                value={s.messages}
                onValueChange={(v) => update({ messages: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                title={t('notificationSettings.promotions')}
                subtitle={t('notificationSettings.promotionsSubtitle')}
                value={s.promotionsOffers}
                onValueChange={(v) => update({ promotionsOffers: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />
              <NotificationToggle
                title={t('notificationSettings.newServices')}
                subtitle={t('notificationSettings.newServicesSubtitle')}
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
            <Text className={`text-sm font-bold ${sectionHeaderColor} mb-3`}>
              {t('notificationSettings.quietHours')}
            </Text>
            <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
              <View className="flex-row items-center justify-between px-4 py-4">
                <View className="flex-1 flex-row items-center">
                  <MaterialIcons
                    name="do-not-disturb-on"
                    size={20}
                    color={isDarkMode ? '#9ca3af' : '#6b7280'}
                  />
                  <View className="ml-3 flex-1">
                    <Text className={`text-base font-semibold ${textColor}`}>
                      {t('notificationSettings.dnd')}
                    </Text>
                    <Text className={`text-sm ${subtextColor} mt-0.5`}>
                      {t('notificationSettings.dndSubtitle', { range: dndRange })}
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
                    <Text className="text-sm font-semibold text-brand-500">
                      {t('notificationSettings.customizeSchedule')}
                    </Text>
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
                {t('notificationSettings.deviceSettingsHint')}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenLayout>
  );
}
