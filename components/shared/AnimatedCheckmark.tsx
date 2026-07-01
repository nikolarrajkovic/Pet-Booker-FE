import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Diameter of the circular ring, in px. */
  size?: number;
  /** Stroke / accent color (defaults to brand green). */
  color?: string;
  /** Soft circle fill behind the check. Defaults from `isDarkMode`. */
  ringColor?: string;
  isDarkMode?: boolean;
  /** Fired once the check finishes drawing. */
  onDone?: () => void;
};

// Checkmark vertices in 0..1 fractions of `size` (start → vertex → end).
// Nudged slightly above the geometric centre: a check's visual weight sits at
// the bottom-left vertex, so this reads as optically centred in the circle.
const P1 = { x: 0.3, y: 0.47 };
const P2 = { x: 0.45, y: 0.61 };
const P3 = { x: 0.74, y: 0.31 };

/**
 * A success checkmark that draws itself: the ring springs in, then the two
 * strokes of the check grow into place one after the other. Pure Reanimated
 * (no SVG), so it runs on the UI thread on native and on web.
 *
 * Each stroke draws from its start point to its end point. We keep the bar's
 * rotation around its own centre (the default origin) and resize/reposition the
 * bar each frame so its drawn span is always start → start + progress·(end−start).
 * This deliberately avoids `transformOrigin`, which isn't reliably honored when
 * combined with an animated transform across RN web/native.
 */
export default function AnimatedCheckmark({
  size = 128,
  color = '#00C870',
  ringColor,
  isDarkMode = false,
  onDone,
}: Props) {
  // When the OS/browser "Reduce Motion" setting is on, Reanimated's web driver
  // freezes imperative animations — so instead of trying to force them (which can
  // leave the check collapsed/invisible), we render the final drawn state and skip
  // the animation. Motion-on users get the full draw.
  const reduced = useReducedMotion();
  const initial = reduced ? 1 : 0;
  const ring = useSharedValue(initial); // 0 → 1 pop-in
  const stroke1 = useSharedValue(initial); // short stroke draw progress
  const stroke2 = useSharedValue(initial); // long stroke draw progress

  const strokeWidth = Math.max(4, size * 0.052);

  // Absolute endpoints (px), length, and angle of each stroke.
  const segment = (a: typeof P1, b: typeof P1) => ({
    sx: a.x * size,
    sy: a.y * size,
    ex: b.x * size,
    ey: b.y * size,
    len: Math.hypot((b.x - a.x) * size, (b.y - a.y) * size),
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  });

  const s1 = segment(P1, P2);
  const s2 = segment(P2, P3);

  useEffect(() => {
    if (reduced) return; // already rendered in the final drawn state
    ring.value = withSpring(1, { damping: 11, stiffness: 140, mass: 0.7 });
    stroke1.value = withDelay(
      180,
      withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) })
    );
    stroke2.value = withDelay(
      330,
      withTiming(1, { duration: 230, easing: Easing.out(Easing.quad) }, (finished) => {
        'worklet';
        if (finished && onDone) runOnJS(onDone)();
      })
    );
    // Animate once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value,
    transform: [{ scale: ring.value }],
  }));

  // Grow the bar from its start: box centre tracks the midpoint of the drawn
  // span, width is progress·length, rotation is constant about that centre.
  const stroke1Style = useAnimatedStyle(() => {
    const p = stroke1.value;
    const w = p * s1.len;
    const cx = s1.sx + (p / 2) * (s1.ex - s1.sx);
    const cy = s1.sy + (p / 2) * (s1.ey - s1.sy);
    return {
      width: w,
      left: cx - w / 2,
      top: cy - strokeWidth / 2,
      transform: [{ rotateZ: `${s1.angle}deg` }],
    };
  });
  const stroke2Style = useAnimatedStyle(() => {
    const p = stroke2.value;
    const w = p * s2.len;
    const cx = s2.sx + (p / 2) * (s2.ex - s2.sx);
    const cy = s2.sy + (p / 2) * (s2.ey - s2.sy);
    return {
      width: w,
      left: cx - w / 2,
      top: cy - strokeWidth / 2,
      transform: [{ rotateZ: `${s2.angle}deg` }],
    };
  });
  // Round join at the vertex: a dot (Ø = strokeWidth) centred on P2 merges the two
  // separate bars into one continuous bend (= what stroke-linejoin:round does).
  // Fades in with stroke1 so it lands exactly as the first stroke reaches the vertex.
  const jointStyle = useAnimatedStyle(() => ({ opacity: stroke1.value }));

  const fill = ringColor ?? (isDarkMode ? 'rgba(0,200,112,0.2)' : '#CFF5E3');

  const capRadius = strokeWidth / 2;
  const barBase = {
    position: 'absolute' as const,
    height: strokeWidth,
    backgroundColor: color,
  };
  // Round ONLY the outer tip of each bar and keep the vertex (P2) ends butt, so
  // the two strokes meet flush there. The join dot then rounds the outer corner
  // — exactly what stroke-linejoin:round does. (Rounding the vertex ends too made
  // the bend look doubled/bulbous — the strokes "didn't emerge from one spot".)
  const stroke1Caps = { borderTopLeftRadius: capRadius, borderBottomLeftRadius: capRadius };
  const stroke2Caps = { borderTopRightRadius: capRadius, borderBottomRightRadius: capRadius };

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ringStyle,
      ]}>
      {/* Check strokes live in a square the size of the ring. */}
      <View style={{ width: size, height: size }}>
        <Animated.View style={[barBase, stroke1Caps, stroke1Style]} />
        <Animated.View style={[barBase, stroke2Caps, stroke2Style]} />
        {/* Round join dot centred on the vertex (P2 = s1 end). */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: s1.ex - strokeWidth / 2,
              top: s1.ey - strokeWidth / 2,
              width: strokeWidth,
              height: strokeWidth,
              borderRadius: strokeWidth / 2,
              backgroundColor: color,
            },
            jointStyle,
          ]}
        />
      </View>
    </Animated.View>
  );
}
