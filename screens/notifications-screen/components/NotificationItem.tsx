import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppNotificationDto, NotificationType } from '../../../services/app-notifications';
import { useLocale } from '../../../context/LocaleContext';

import { BRAND_GREEN } from '../../../hooks/useThemeColors';
type Accent = 'brand' | 'danger' | 'warning' | 'info';
type Visual = { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string };

// Four accents carry the whole feed: something good happened, something went wrong, something
// needs you, something about money. The tinted circle is 12% of the same hue.
const ACCENTS: Record<Accent, { color: string; bg: string }> = {
  brand: { color: BRAND_GREEN, bg: 'rgba(0,200,112,0.12)' },
  danger: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  info: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
};

/**
 * Icon + accent for every notification type the backend can send.
 *
 * Keyed by NAME rather than by value so it is `Record<keyof typeof NotificationType, …>`: adding a
 * type to the enum without giving it a look here is then a compile error, instead of a row that
 * quietly renders as a generic bell. The numeric index the renderer actually uses is derived from
 * it once, below.
 */
const VISUAL_BY_NAME: Record<
  keyof typeof NotificationType,
  { icon: Visual['icon']; accent: Accent }
> = {
  // Booking lifecycle, the happy path.
  BookingRequested: { icon: 'calendar-outline', accent: 'brand' },
  BookingConfirmed: { icon: 'checkmark-circle-outline', accent: 'brand' },
  ServiceStarted: { icon: 'navigate-outline', accent: 'brand' },
  LiveTrackingStarted: { icon: 'navigate-outline', accent: 'brand' },
  ServiceCompleted: { icon: 'checkmark-done-outline', accent: 'brand' },
  // …and the ways it ends early. Same red for all three: to the reader they are one event.
  BookingDeclined: { icon: 'close-circle-outline', accent: 'danger' },
  BookingCancelled: { icon: 'close-circle-outline', accent: 'danger' },
  // Something changed under an agreement already made — both sides have to re-read the terms,
  // so these get the "needs you" amber rather than a neutral tone.
  BookingUpdated: { icon: 'create-outline', accent: 'warning' },
  BookingReminder: { icon: 'alarm-outline', accent: 'warning' },
  // Money. A receipt is information; an amount owed is an action.
  BookingPriceAdjusted: { icon: 'pricetag-outline', accent: 'info' },
  PaymentReceived: { icon: 'card-outline', accent: 'info' },
  PaymentDue: { icon: 'wallet-outline', accent: 'warning' },
  // Partner verification.
  ServiceProviderApproved: { icon: 'shield-checkmark-outline', accent: 'brand' },
  ServiceProviderDeclined: { icon: 'close-circle-outline', accent: 'danger' },
  CertificateApproved: { icon: 'ribbon-outline', accent: 'brand' },
  CertificateDeclined: { icon: 'close-circle-outline', accent: 'danger' },
  // Reviews keep the star whichever way moderation went, so the row reads as being about a
  // review at a glance; the accent says which way.
  ReviewReceived: { icon: 'star-outline', accent: 'warning' },
  ReviewApproved: { icon: 'star-outline', accent: 'brand' },
  ReviewDeclined: { icon: 'star-outline', accent: 'danger' },
  // Never reaches this feed (chat has its own inbox), but a row is cheap and an older backend
  // that doesn't filter would otherwise render a message as a bare bell.
  NewChatMessage: { icon: 'chatbubble-ellipses-outline', accent: 'info' },
};

const VISUAL_BY_TYPE = new Map<number, Visual>(
  Object.entries(VISUAL_BY_NAME).map(([name, { icon, accent }]) => [
    NotificationType[name as keyof typeof NotificationType],
    { icon, ...ACCENTS[accent] },
  ])
);

// Per-type icon + accent. Falls back to a generic bell for a type this build predates.
function notificationVisual(type: number): Visual {
  return VISUAL_BY_TYPE.get(type) ?? { icon: 'notifications-outline', ...ACCENTS.brand };
}

// ISO date-time → "Just now" / "5m ago" / "3h ago" / "2d ago" / "Jun 3".
// Takes the translate fn so the labels follow the active language.
function formatRelativeTime(
  t: (key: any, params?: Record<string, string | number>) => string,
  iso: string
): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return t('notifications.justNow');
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minutesAgo', { m: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('notifications.hoursAgo', { h: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.daysAgo', { d: days });
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type NotificationItemProps = {
  notification: AppNotificationDto;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  onPress: () => void;
};

export default function NotificationItem({
  notification,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
  onPress,
}: NotificationItemProps) {
  const { t } = useLocale();
  const { icon, color, bg } = notificationVisual(notification.type);
  const unread = !notification.isRead;
  // Unread rows get a subtle brand tint so they stand out from read ones.
  const rowBg = unread ? (isDarkMode ? 'bg-[#15212e]' : 'bg-brand-50') : cardBg;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      className={`flex-row items-start ${rowBg} mb-3 rounded-2xl border p-4 ${borderColor}`}
      activeOpacity={0.7}
      onPress={onPress}>
      <View
        className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: bg }}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className={`text-base font-semibold ${textColor} flex-1 pr-2`} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text className={`text-xs ${subtextColor}`}>
            {formatRelativeTime(t, notification.createdAt)}
          </Text>
        </View>
        <Text className={`text-sm ${subtextColor} mt-1`} numberOfLines={3}>
          {notification.message}
        </Text>
      </View>
      {unread && <View className="ml-2 mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />}
    </TouchableOpacity>
  );
}
