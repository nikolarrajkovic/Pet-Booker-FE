import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppNotificationDto, NotificationType } from '../../../services/app-notifications';

type Visual = { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string };

// Per-type icon + accent. Falls back to a generic bell for unknown types.
function notificationVisual(type: number): Visual {
  switch (type) {
    case NotificationType.NewBookingRequest:
      return { icon: 'calendar-outline', color: '#00C870', bg: 'rgba(0,200,112,0.12)' };
    case NotificationType.BookingConfirmed:
      return { icon: 'checkmark-circle-outline', color: '#00C870', bg: 'rgba(0,200,112,0.12)' };
    case NotificationType.ServiceCompleted:
      return { icon: 'checkmark-done-outline', color: '#00C870', bg: 'rgba(0,200,112,0.12)' };
    case NotificationType.ProviderProfileApproved:
      return { icon: 'shield-checkmark-outline', color: '#00C870', bg: 'rgba(0,200,112,0.12)' };
    case NotificationType.CertificateApproved:
      return { icon: 'ribbon-outline', color: '#00C870', bg: 'rgba(0,200,112,0.12)' };
    case NotificationType.ProviderProfileDeclined:
    case NotificationType.CertificateDeclined:
    case NotificationType.BookingDeclined:
      return { icon: 'close-circle-outline', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
    case NotificationType.UpcomingBookingReminder:
      return { icon: 'alarm-outline', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
    default:
      return { icon: 'notifications-outline', color: '#00C870', bg: 'rgba(0,200,112,0.12)' };
  }
}

// ISO date-time → "Just now" / "5m ago" / "3h ago" / "2d ago" / "Jun 3"
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
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
  const { icon, color, bg } = notificationVisual(notification.type);
  const unread = !notification.isRead;
  // Unread rows get a subtle brand tint so they stand out from read ones.
  const rowBg = unread ? (isDarkMode ? 'bg-[#15212e]' : 'bg-brand-50') : cardBg;

  return (
    <TouchableOpacity
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
            {formatRelativeTime(notification.createdAt)}
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
