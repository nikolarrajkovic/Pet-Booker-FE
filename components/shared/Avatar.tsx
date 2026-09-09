import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type AvatarProps = {
  /**
   * Already-resolved image URL (see `resolveImageUrl`) or a locally-picked file uri. Null,
   * undefined or empty means "no photo" — the initial is all that renders.
   */
  uri?: string | null;
  /** Text the initial is taken from: a first name, a display name, an email. */
  name?: string | null;
  /** Diameter in px. */
  size: number;
  /** Classes for the circle behind the photo — its background, and any border. */
  placeholderClassName?: string;
  /** Classes for the initial itself: text size and colour. */
  textClassName?: string;
  /** Classes for the wrapper — margins, mostly. */
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A profile photo with an initial behind it.
 *
 * The initial is **always mounted** and the photo is layered on top, rather than the two swapping
 * places. A swap makes the placeholder blink: it is shown while the user record loads, torn down
 * the moment an `avatarUrl` arrives, and — because the photo needs a round trip of its own, and
 * may 404 at the end of it — replaced by a blank circle until either the image paints or `onError`
 * puts the placeholder back. Layering removes every one of those frames: the initial simply stays
 * put until a photo covers it, and stays if none ever does.
 */
export default function Avatar({
  uri,
  name,
  size,
  placeholderClassName = 'bg-white/25',
  textClassName = 'text-2xl font-bold text-white',
  className = '',
  style,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // A different photo deserves a fresh attempt — otherwise picking a replacement for a broken
  // one would stay hidden behind the previous failure.
  useEffect(() => setFailed(false), [uri]);

  const initial = ((name ?? '').trim()[0] ?? '?').toUpperCase();
  const radius = size / 2;

  return (
    <View
      className={`items-center justify-center overflow-hidden ${placeholderClassName} ${className}`}
      style={[{ width: size, height: size, borderRadius: radius }, style]}>
      <Text className={textClassName}>{initial}</Text>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          // Absolutely filling the circle, so it covers the initial only once it has pixels.
          // The radius is repeated here because `overflow: hidden` over a rounded parent is not
          // reliable on Android.
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        />
      ) : null}
    </View>
  );
}
