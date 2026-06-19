import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type AddOnItem = {
  key: 'pickup' | 'dropoff';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  completed: boolean;
};

type Props = {
  items: AddOnItem[];
  /** Partner taps a row to toggle completion. Omitted/undefined ⇒ read-only (user). */
  onToggle?: (key: AddOnItem['key']) => void;
  readOnly?: boolean;
  isDarkMode: boolean;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
};

/**
 * Pickup / Drop-off completion checklist for a live session. The partner must
 * mark each included add-on complete before the service can be ended (the parent
 * gates the End button on these). The backend has no field to persist this, so
 * completion is local-only state (BACKEND_GAPS B7) — the user view is read-only.
 */
export default function AddOnChecklist({
  items,
  onToggle,
  readOnly,
  isDarkMode,
  cardBg,
  textColor,
  subtextColor,
  borderColor,
}: Props) {
  if (items.length === 0) return null;

  return (
    <View className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
      {items.map((item, index) => {
        const done = item.completed;
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={readOnly ? 1 : 0.7}
            disabled={readOnly}
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
              <Text className={`text-xs ${subtextColor} mt-0.5`}>
                {done ? 'Completed' : readOnly ? 'In progress' : 'Tap to mark complete'}
              </Text>
            </View>
            <Ionicons
              name={done ? 'checkmark-circle' : 'ellipse-outline'}
              size={26}
              color={done ? '#00C870' : isDarkMode ? '#4B5563' : '#D1D5DB'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
