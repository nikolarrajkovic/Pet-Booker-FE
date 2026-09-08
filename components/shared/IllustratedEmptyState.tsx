import React from 'react';
import { View, Text, Image, Pressable, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';

type IllustratedEmptyStateProps = {
  /** The artwork. Authored with a transparent background so it sits on the card, not in a box. */
  image: ImageSourcePropType;
  title: string;
  /** One line on why the screen is empty and what to do about it. */
  body?: string;
  /** Label for the primary action. Omit to render the state with no button. */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * The empty state for a screen whose whole job is a list the user has not filled yet.
 *
 * `ListState`'s `MessageState` is the compact version — an icon badge and a line of text, right
 * for a filter that matched nothing or a list that is *usually* full. This is the other case: a
 * first-run screen, where the emptiness is the normal beginning rather than a dead end, and the
 * page has nothing else on it. There, a line of grey text reads as an error; artwork and a
 * single obvious button read as an invitation.
 *
 * Like `MessageState` it paints a card. These screens are drawn over the pet pattern, and an
 * uncontained block of text on that ground reads as part of the wallpaper.
 */
export default function IllustratedEmptyState({
  image,
  title,
  body,
  actionLabel,
  onAction,
}: IllustratedEmptyStateProps) {
  const { textColor, subtextColor, cardBg } = useThemeColors();

  return (
    <View className="items-center justify-center py-10">
      <View className={`${cardBg} w-full items-center rounded-2xl px-6 py-12`}>
        <Image
          source={image}
          // `contain` with a capped box: the art is wider than it is tall, and letting it grow to
          // the card's width would make it the page rather than the invitation on it.
          resizeMode="contain"
          style={{ width: '100%', maxWidth: 280, height: 200 }}
          accessible={false}
        />

        <Text className={`mt-8 text-center text-xl font-bold ${textColor}`}>{title}</Text>
        {body && (
          <Text className={`mt-2 max-w-md text-center text-base ${subtextColor}`}>{body}</Text>
        )}

        {actionLabel && onAction && (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ hovered, pressed }: any) => ({
              marginTop: 28,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 999,
              backgroundColor: pressed ? '#00A05C' : hovered ? '#00B368' : '#00C870',
              cursor: 'pointer',
            })}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text className="ml-2 text-base font-semibold text-white">{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
