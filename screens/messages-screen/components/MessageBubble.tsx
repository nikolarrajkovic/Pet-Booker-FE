import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../../../hooks/useThemeColors';

export interface MessageBubbleProps {
  body: string;
  /** Pictures sent with the message, ready to show (resolved URLs). */
  photoUrls?: string[];
  /** True when the signed-in user wrote it — drives side, colour and ticks. */
  isMine: boolean;
  /** Rendered only on the other party's bubbles, as in the design. */
  avatarUrl?: string | null;
  /** Set once the recipient has read it. Ignored on incoming bubbles. */
  isRead?: boolean;
  isDarkMode: boolean;
}

/** Tick colours: grey while sent, blue once read (the lighter blue on the dark ground). */
const TICK = {
  light: { sent: '#9CA3AF', read: '#3B82F6' },
  dark: { sent: '#6B7280', read: '#60A5FA' },
} as const;

/**
 * One chat bubble: the sender's messages sit right in brand green, the other party's sit left on
 * a card background behind their avatar.
 *
 * The corner opposite the speaker is squared off (`rounded-br-md` / `rounded-bl-md`) so the tail
 * points at whoever is talking — that asymmetry is what makes a thread scannable at a glance
 * without reading any of it.
 */
export default function MessageBubble({
  body,
  photoUrls = [],
  isMine,
  avatarUrl,
  isRead,
  isDarkMode,
}: MessageBubbleProps) {
  const { cardBg, textColor, borderColor } = themeColors(isDarkMode);

  return (
    <View className={`mb-1 flex-row items-end ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine &&
        (avatarUrl ? (
          <Image source={{ uri: avatarUrl }} className="mr-2 h-7 w-7 rounded-full" />
        ) : (
          // Keeps the bubble's left edge aligned whether or not an avatar loaded.
          <View className="mr-2 h-7 w-7" />
        ))}

      <View
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
          isMine ? 'rounded-br-md bg-brand-500' : `rounded-bl-md border ${cardBg} ${borderColor}`
        }`}>
        {photoUrls.length > 0 ? (
          <View className="flex-row flex-wrap" style={{ gap: 6, marginBottom: body ? 8 : 0 }}>
            {photoUrls.map((uri, i) => (
              <Image
                key={`${uri}-${i}`}
                source={{ uri }}
                accessibilityLabel="Photo"
                style={{
                  width: photoUrls.length > 1 ? 120 : 220,
                  height: photoUrls.length > 1 ? 120 : 220,
                  borderRadius: 12,
                }}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : null}
        {body ? (
          <Text className={`text-[15px] leading-5 ${isMine ? 'text-white' : textColor}`}>
            {body}
          </Text>
        ) : null}
      </View>

      {isMine && (
        // Single grey tick = sent, double blue tick = read. Sits outside the bubble so a long
        // message never reflows around it. Blue rather than the brand green: the bubble beside
        // it is already that green, so a green "read" tick was only a shade off the bubble and
        // read as decoration — blue is the colour people already take to mean "seen".
        <Ionicons
          name={isRead ? 'checkmark-done' : 'checkmark'}
          size={15}
          color={TICK[isDarkMode ? 'dark' : 'light'][isRead ? 'read' : 'sent']}
          style={{ marginLeft: 4, marginBottom: 2 }}
        />
      )}
    </View>
  );
}
