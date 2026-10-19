import React from 'react';
import { View, Image, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';

type ServicePhotoProps = {
  /** Already-resolved absolute URL, or null/empty when there is no photo. */
  uri?: string | null;
  /** Corner radius utility, matched to whatever the photo sits in. */
  radiusClass?: string;
  /** Size of the placeholder glyph. */
  iconSize?: number;
  /**
   * How the photo meets its frame.
   *
   * `contain` (the default) shows the WHOLE photo, on a blurred, enlarged copy of itself that
   * fills the rest of the frame. Service frames are wide (a 200×128 card, a 208×184 row, a hero
   * the width of the page) and partners upload phone photos, which are mostly portrait: `cover`
   * kept only the middle band of those — the dog's ears and paws were cut off on every card, and
   * on the desktop hero a portrait photo lost two thirds of its height. The blurred fill keeps the
   * frame solid rather than letterboxing it with grey bars.
   *
   * `cover` fills the frame by cropping, which is right for an avatar-sized thumbnail of a pet,
   * where the face is the point and the frame is square.
   */
  fit?: 'contain' | 'cover';
  className?: string;
  style?: ViewStyle;
  /** Badges and ribbons positioned over the photo. */
  children?: React.ReactNode;
};

/**
 * A service photo with a placeholder **layered behind it**, never swapped for it.
 *
 * This is the `Avatar` rule applied to service imagery, and it exists because the fallback a card
 * computes (`resolveImageUrl(src) || FALLBACK_IMAGE`) only covers the case where there is **no**
 * src. It does nothing for a src that exists and does not load — a photo whose file was cleaned
 * up, a provider's stale external URL, a phone that is briefly offline — because a broken string
 * is still a truthy string. Those cards rendered a blank rectangle the size of the image, which
 * reads as the row having failed rather than as a listing with no photo yet. (It surfaced on the
 * Home "Near You" rail, whose services carry a `cdn.example.com` URL that resolves nowhere, while
 * the rail beside it had no photos at all and so fell back correctly — the same data looking like
 * two different bugs.)
 *
 * Layering rather than swapping also stops the placeholder blinking: swapped, it shows while the
 * image loads, is torn down the instant it arrives, and comes back via `onError` if it 404s. A
 * photo that never loads takes its blurred fill with it, so the paw still shows.
 */
export default function ServicePhoto({
  uri,
  radiusClass = 'rounded-2xl',
  iconSize = 34,
  fit = 'contain',
  className = '',
  style,
  children,
}: ServicePhotoProps) {
  const { isDarkMode } = useThemeColors();

  return (
    <View
      className={`relative items-center justify-center overflow-hidden ${radiusClass} ${
        isDarkMode ? 'bg-white/5' : 'bg-gray-100'
      } ${className}`}
      style={style}>
      <Ionicons name="paw" size={iconSize} color={isDarkMode ? '#374151' : '#D1D5DB'} />
      {/* Decorative: the card that owns this photo already carries the service's name. */}
      {uri && fit === 'contain' ? (
        <>
          {/* Enlarged so the blur's soft edge falls outside the frame (overflow is hidden). */}
          <Image
            source={{ uri }}
            accessibilityRole="none"
            alt=""
            blurRadius={18}
            className="absolute inset-0 h-full w-full"
            style={{ transform: [{ scale: 1.2 }] }}
            resizeMode="cover"
          />
          <View
            pointerEvents="none"
            className={`absolute inset-0 ${isDarkMode ? 'bg-black/30' : 'bg-black/10'}`}
          />
          <Image
            source={{ uri }}
            accessibilityRole="none"
            alt=""
            className="absolute inset-0 h-full w-full"
            resizeMode="contain"
          />
        </>
      ) : uri ? (
        <Image
          source={{ uri }}
          accessibilityRole="none"
          alt=""
          className="absolute inset-0 h-full w-full"
          resizeMode="cover"
        />
      ) : null}
      {children}
    </View>
  );
}
