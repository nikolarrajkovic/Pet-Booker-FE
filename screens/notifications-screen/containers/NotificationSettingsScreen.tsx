import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import { useToast } from '../../../context/ToastContext';
import { usePushPermission } from '../../../hooks/usePushPermission';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import TimePicker from '../../../components/shared/TimePicker';
import { EnableNotificationsCard, NotificationToggle, PushPermissionNotice } from '../components';
import { registerPushDevice, unregisterPushDevice } from '../../../services/push-registration';
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

// "HH:MM:SS" → today at that clock time, which is the shape TimePicker works in.
function timeToDate(value: string | undefined, fallbackHour: number): Date {
  const date = new Date();
  const [h, m] = (value ?? '').split(':').map(Number);
  date.setHours(isNaN(h) ? fallbackHour : h, isNaN(m) ? 0 : m, 0, 0);
  return date;
}

// A picked time back into the API's "HH:MM:SS". Read off the clock fields rather than through
// TimePicker's formatTime24, whose "24:00" end-of-day sentinel has no meaning for a quiet-hours
// window — midnight either way, and 23:59 is what the picker actually holds.
function dateToTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

/** Which end of the quiet-hours window the time picker is editing. */
type QuietEdge = 'start' | 'end';

export default function NotificationSettingsScreen() {
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, textColor, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const { showError } = useToast();
  // The device's own answer, kept live across a trip to the OS settings app.
  const { permission, isRequesting, request, refresh, openSettings } = usePushPermission();

  const [settings, setSettings] = useState<UserNotificationSettingsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEnableModal, setShowEnableModal] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [quietEdge, setQuietEdge] = useState<QuietEdge | null>(null);
  const userId = currentUser?.id;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // The permission can have changed while the screen was in the background stack.
      refresh();
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
    }, [userId, refresh])
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
  const divider = <View className={`h-px ${isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'} mx-4`} />;

  const s = settings ?? defaultNotificationSettings(userId ?? 0);

  // Push is only really on when BOTH sides agree: the account preference and the OS. Showing the
  // stored preference alone is what let the screen claim push was on while the phone silently
  // dropped every notification. While `permission` is still null the preference stands in, so
  // the switch doesn't flick off and back on during the first read.
  const osGranted = permission === null || permission.status === 'granted';
  const pushOn = s.pushEnabled && osGranted;
  const pushUnavailable = permission?.supported === false;
  // 'undetermined' is not a refusal — the switch itself raises the prompt, so no notice yet.
  const pushBlocked = permission?.supported === true && permission.status === 'denied';

  // Granting from the settings app is the one path that leaves this handset registered nowhere:
  // App.tsx registers once at sign-in, and that call came back empty because permission was
  // refused at the time. Observing the grant here is what closes that gap.
  const registeredRef = useRef(false);
  useEffect(() => {
    if (!userId || !s.pushEnabled || permission?.status !== 'granted') return;
    if (registeredRef.current) return;
    registeredRef.current = true;
    registerPushDevice(userId);
  }, [userId, s.pushEnabled, permission?.status]);

  /**
   * The push switch, which is the one setting the app does not get to decide on its own.
   *
   * Turning it ON asks the OS first and only records the preference once permission is actually
   * granted — a stored `true` the device will never honour is exactly the lie this screen had.
   * Turning it OFF retires this handset's token as well as clearing the preference, so a shared
   * or spare device stops buzzing immediately rather than at the next sign-out.
   */
  const setPushEnabled = async (on: boolean) => {
    if (!userId) return;

    if (!on) {
      update({ pushEnabled: false });
      unregisterPushDevice(userId);
      return;
    }

    if (pushUnavailable) return; // nothing to grant here; the notice already says so

    const granted = permission?.status === 'granted' ? permission : await request();
    if (granted.status !== 'granted') {
      // Denied, or the OS has stopped asking. The notice below the row now offers the way out.
      return;
    }

    update({ pushEnabled: true });
    registeredRef.current = true;
    if (!(await registerPushDevice(userId))) {
      showError(t('notificationSettings.pushEnableFailed'));
    }
  };

  const quietTime = (edge: QuietEdge) => (edge === 'start' ? s.dndStartTime : s.dndEndTime);

  // Esc dismisses the time picker — RN's onRequestClose only fires for Android's back button.
  useEscapeToClose(quietEdge !== null, () => setQuietEdge(null));

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
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {showEnableModal && !pushOn && !pushUnavailable && (
            <EnableNotificationsCard
              isDarkMode={isDarkMode}
              onEnable={() => setPushEnabled(true)}
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
                value={pushOn}
                onValueChange={setPushEnabled}
                disabled={pushUnavailable || isRequesting}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              {(pushBlocked || pushUnavailable) && (
                <PushPermissionNotice
                  variant={pushUnavailable ? 'unavailable' : 'blocked'}
                  isDarkMode={isDarkMode}
                  onOpenSettings={openSettings}
                />
              )}
              {divider}
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
              {divider}
              <NotificationToggle
                title={t('notificationSettings.reminders')}
                subtitle={t('notificationSettings.remindersSubtitle')}
                value={s.appointmentReminders}
                onValueChange={(v) => update({ appointmentReminders: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              {divider}
              <NotificationToggle
                title={t('notificationSettings.messages')}
                subtitle={t('notificationSettings.messagesSubtitle')}
                value={s.messages}
                onValueChange={(v) => update({ messages: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              {divider}
              <NotificationToggle
                title={t('notificationSettings.promotions')}
                subtitle={t('notificationSettings.promotionsSubtitle')}
                value={s.promotionsOffers}
                onValueChange={(v) => update({ promotionsOffers: v })}
                isDarkMode={isDarkMode}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              {divider}
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
                  accessibilityLabel={t('notificationSettings.dnd')}
                  value={s.dndEnabled}
                  onValueChange={(v) => update({ dndEnabled: v })}
                  trackColor={{ false: isDarkMode ? '#374151' : '#d1d5db', true: BRAND_GREEN }}
                  thumbColor="white"
                  ios_backgroundColor={isDarkMode ? '#374151' : '#d1d5db'}
                />
              </View>
              {s.dndEnabled && (
                <>
                  {divider}
                  {(['start', 'end'] as QuietEdge[]).map((edge, i) => (
                    <React.Fragment key={edge}>
                      {i > 0 && divider}
                      <TouchableOpacity
                        accessibilityRole="button"
                        className="flex-row items-center justify-between px-4 py-3.5"
                        onPress={() => setQuietEdge(edge)}>
                        <Text className={`text-base ${textColor}`}>
                          {t(
                            edge === 'start'
                              ? 'notificationSettings.quietStart'
                              : 'notificationSettings.quietEnd'
                          )}
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="text-base font-semibold text-brand-500">
                            {formatTime(quietTime(edge)) || (edge === 'start' ? '22:00' : '08:00')}
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={isDarkMode ? '#9ca3af' : '#6b7280'}
                            style={{ marginLeft: 4 }}
                          />
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
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

      {/* Quiet-hours time picker. Same modal wrapper AddEditService uses — TimePicker itself
          renders a plain card and leaves presentation to the caller. */}
      {quietEdge && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setQuietEdge(null)}>
          <View className="flex-1 items-center justify-center bg-black/50 px-6">
            <View className="w-full max-w-sm">
              <TimePicker
                value={timeToDate(quietTime(quietEdge), quietEdge === 'start' ? 22 : 8)}
                onChange={(date) =>
                  update(
                    quietEdge === 'start'
                      ? { dndStartTime: dateToTime(date) }
                      : { dndEndTime: dateToTime(date) }
                  )
                }
                onClose={() => setQuietEdge(null)}
                isDarkMode={isDarkMode}
              />
            </View>
          </View>
        </Modal>
      )}
    </ScreenLayout>
  );
}
