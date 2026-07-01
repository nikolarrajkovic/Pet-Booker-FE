import React, { useEffect, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#00C870', '#2CE07F', '#F59E0B', '#6366F1', '#EF4444', '#EC4899', '#3B82F6'];

type PieceProps = {
  startX: number;
  fallTo: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
  size: number;
  spin: number;
};

/**
 * A single confetti rectangle that falls from above the top edge, drifting
 * sideways and spinning, then fades out near the end of its run. Pure
 * Reanimated so it animates on the UI thread on native and on web.
 */
function ConfettiPiece({ startX, fallTo, delay, duration, drift, color, size, spin }: PieceProps) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
    // Animate once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift * t.value },
      { translateY: fallTo * t.value },
      { rotateZ: `${spin * t.value}deg` },
    ],
    // Hold full opacity, then fade over the last 15% of the fall.
    opacity: 1 - Math.max(0, (t.value - 0.85) / 0.15),
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -24,
          left: startX,
          width: size,
          height: size * 0.6,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

type Props = {
  /** Number of confetti pieces. */
  count?: number;
};

/**
 * A celebratory confetti burst that rains down across the whole screen.
 * Rendered as a non-interactive overlay (`pointerEvents="none"`), so it never
 * blocks touches on the content underneath. Skipped when the OS "Reduce Motion"
 * setting is on.
 */
export default function Confetti({ count = 18 }: Props) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        startX: Math.random() * width,
        fallTo: height * (0.55 + Math.random() * 0.45),
        delay: Math.random() * 700,
        duration: 1600 + Math.random() * 1400,
        drift: (Math.random() - 0.5) * 140,
        color: COLORS[i % COLORS.length],
        size: 7 + Math.random() * 7,
        spin: (Math.random() - 0.5) * 720,
      })),
    [count, width, height]
  );

  if (reduced) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} {...p} />
      ))}
    </View>
  );
}
