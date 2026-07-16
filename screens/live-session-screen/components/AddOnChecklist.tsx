import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AddressDto } from '../../../services/service-providers';
import { useLocale } from '../../../context/LocaleContext';

export type AddOnItem = {
  key: 'pickup' | 'dropoff' | 'specialNeeds';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  completed: boolean;
  /** Secondary line, e.g. the pickup/drop-off address — "where to go". */
  detail?: string;
  /**
   * Whether the partner can mark this complete (gates End Service). Pickup/
   * Drop-off are toggleable tasks; Special Needs is informational only.
   */
  toggleable?: boolean;
  /** Destination for the "Directions" action (pickup/drop-off location). */
  address?: AddressDto;
};

type Props = {
  items: AddOnItem[];
  /** Partner taps a row to toggle completion. Omitted/undefined ⇒ read-only (user). */
  onToggle?: (key: AddOnItem['key']) => void;
  /**
   * Partner taps "Directions" to navigate to the add-on's location. Shown only
   * for rows that carry an `address`. Omitted ⇒ no directions affordance (user).
   */
  onDirections?: (key: AddOnItem['key']) => void;
  /** The row whose directions are currently being resolved (shows a spinner). */
  directionsLoadingKey?: AddOnItem['key'] | null;
  readOnly?: boolean;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
};

/**
 * Selected add-ons for a live session. Pickup / Drop-off are completion tasks —
 * the partner marks each complete before the service can be ended (the parent
 * gates the End button on these); each shows its address so the provider knows
 * where to go. Special Needs is shown as an informational row (not toggleable).
 * Completion is local-only — the backend has no field for it (BACKEND_GAPS B7).
 */
export default function AddOnChecklist({
  items,
  onToggle,
  onDirections,
  directionsLoadingKey,
  readOnly,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
}: Props) {
  const { t } = useLocale();
  if (items.length === 0) return null;

  return (
    <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
      {items.map((item, index) => {
        const done = item.completed;
        const toggleable = item.toggleable !== false;
        const rowReadOnly = readOnly || !toggleable;
        const statusText = toggleable
          ? done
            ? t('liveSession.completed')
            : readOnly
              ? t('liveSession.inProgressStatus')
              : t('liveSession.tapToComplete')
          : t('liveSession.requested');
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={rowReadOnly ? 1 : 0.7}
            disabled={rowReadOnly}
            onPress={() => onToggle?.(item.key)}
            className={`flex-row items-center px-4 py-4 ${
              index < items.length - 1 ? `border-b ${borderColor}` : ''
            }`}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
                backgroundColor: done ? '#E8F5EF' : isDarkMode ? '#243447' : '#F3F4F6',
              }}>
              <Ionicons name={item.icon} size={20} color={done ? '#00C870' : '#9CA3AF'} />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>{item.label}</Text>
              {item.detail ? (
                <Text className={`text-xs ${subtextColor} mt-0.5`}>{item.detail}</Text>
              ) : null}
              <Text className={`text-xs ${subtextColor} mt-0.5`}>{statusText}</Text>
              {onDirections && item.address ? (
                <TouchableOpacity
                  onPress={() => onDirections(item.key)}
                  activeOpacity={0.7}
                  className="mt-2 flex-row items-center self-start rounded-lg px-2.5 py-1.5"
                  style={{ backgroundColor: isDarkMode ? '#243447' : '#E6FAF0' }}>
                  {directionsLoadingKey === item.key ? (
                    <ActivityIndicator size="small" color="#00C870" />
                  ) : (
                    <>
                      <Ionicons name="navigate" size={14} color="#00A85A" />
                      <Text className="ml-1 text-xs font-bold" style={{ color: '#00A85A' }}>
                        {t('liveSession.directions')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
            {toggleable ? (
              <Ionicons
                name={done ? 'checkmark-circle' : 'ellipse-outline'}
                size={26}
                color={done ? '#00C870' : isDarkMode ? '#4B5563' : '#D1D5DB'}
              />
            ) : (
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
