import React, { useEffect } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { BRAND, useThemeColors } from '../../hooks/useThemeColors';

/**
 * The app's loading indicator: a puppy sitting and waiting, tail going.
 *
 * Replaces the bare `ActivityIndicator` everywhere a **whole list or page** is waiting on the
 * API — the places where the spinner is the only thing on screen. Small in-place spinners
 * (inside a submit button, beside a row) stay `ActivityIndicator`; a dog in a button would be
 * the same joke told twice.
 *
 * ## Drawn from the wallpaper
 *
 * `assets/pattern-bg.png` — the pet pattern behind every page on the web design — is green line
 * art: sitting puppies and cats with floppy ears, one even stroke weight, white-filled shapes
 * that occlude each other, a few soft mint accents. This dog is deliberately the same animal in
 * the same pose, drawn a little bolder because it is foreground rather than texture. Sitting also
 * happens to be the right pose for a loader: a dog waiting for you, not running away.
 *
 * ## How it moves
 *
 * The tail wags continuously, the head tilts slowly side to side, and the eyes blink every few
 * seconds. Three things at three speeds is what makes it read as alive instead of as a looping
 * GIF — and the tilt is the "what's taking so long?" of it.
 *
 * ## Pivots
 *
 * SVG's own `rotate(deg cx cy)` can't be animated from Reanimated, and a `<G>` is not a View. So
 * each moving part is its own full-box `<Svg>` inside a `Pivot`: a box the size of the design
 * grid, positioned so that **its centre lands exactly on the part's pivot point**, with the SVG
 * inside shifted by the opposite amount. Rotating the box then rotates the part about its joint —
 * the tail about where it meets the rump, the head about the base of the neck — and it works the
 * same on native and on react-native-web, which is not true of `transformOrigin`.
 *
 * `Pivot`s nest: the eyes pivot about their own centre line (so a blink closes them in place)
 * while sitting inside the head's pivot, so they tilt with the face.
 *
 * Everything is laid out in a 120x120 design box and scaled by `size`.
 */

/** The design grid every path below is drawn in. */
const BOX = 120;
/** Line weight, in design units — one weight everywhere, like the pattern tile. */
const S = 2.3;

/** Joints. A part rotates about the point it is attached at, nothing else. */
const PIVOT = {
  /** Where the tail meets the rump. */
  tail: { x: 94, y: 96 },
  /** The base of the neck — a head tilts from there, not from its middle. */
  head: { x: 59, y: 60 },
  /** The eye line, so a blink closes the lids in place. */
  eyes: { x: 59, y: 36 },
} as const;

type Point = { x: number; y: number };

type PivotProps = {
  k: number;
  /** The joint this part turns about, in design units. */
  at: Point;
  animatedStyle: StyleProp<ViewStyle>;
  /** A full-box `<Svg>`; it is positioned for you. */
  children: React.ReactNode;
};

function Pivot({ k, at, animatedStyle, children }: PivotProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          // Centre the box on the joint. The same arithmetic works nested, because a Pivot hangs
          // its children inside the offset view below — whose origin is the design origin again.
          left: (at.x - BOX / 2) * k,
          top: (at.y - BOX / 2) * k,
          width: BOX * k,
          height: BOX * k,
          // The artwork sits outside this box — it is a pivot frame, not a viewport. Clipping it
          // (which react-native-web does to a View by default) would erase the part entirely.
          overflow: 'visible',
        },
        animatedStyle,
      ]}>
      <View
        style={{
          position: 'absolute',
          left: (BOX / 2 - at.x) * k,
          top: (BOX / 2 - at.y) * k,
        }}>
        {children}
      </View>
    </Animated.View>
  );
}

export type PetLoaderProps = {
  /** Width and height in px. Default 132. */
  size?: number;
  /** Caption under the dog. Pass a translated string — this component never invents copy. */
  label?: string;
  /**
   * What the outlines are filled with, so overlapping shapes occlude each other. Defaults to the
   * card colour; pass the surface you are actually drawing on if it is something else.
   */
  surface?: string;
  /** Extra padding/positioning for the centred block. */
  style?: StyleProp<ViewStyle>;
};

export default function PetLoader({ size = 132, label, surface, style }: PetLoaderProps) {
  const { isDarkMode, subtextColor, hex } = useThemeColors();
  const k = size / BOX;

  // With the OS "Reduce Motion" setting on, Reanimated's web driver freezes imperative
  // animations — a dog stuck mid-blink with its head cocked would look broken rather than still.
  // Parking the values renders it sitting squarely, eyes open.
  const reduced = useReducedMotion();
  const tilt = useSharedValue(reduced ? 0.5 : 0);
  const wag = useSharedValue(reduced ? 0.5 : 0);
  const blink = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    tilt.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    wag.value = withRepeat(
      withTiming(1, { duration: 230, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    // Held open for a beat, then shut and open fast — a blink is not a fade.
    blink.value = withRepeat(
      withSequence(
        withDelay(2300, withTiming(0.08, { duration: 70 })),
        withTiming(1, { duration: 110 })
      ),
      -1
    );
    // Starts once; the shared values are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const headStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${-7 + 14 * tilt.value}deg` }],
  }));
  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${-6 + 20 * wag.value}deg` }],
  }));
  const blinkStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));

  const ink = isDarkMode ? BRAND[400] : BRAND[600];
  /** Second-tier lines — toes, the muzzle crease. Full weight there would read as outline. */
  const soft = isDarkMode ? 'rgba(44,224,127,0.45)' : 'rgba(0,168,90,0.42)';
  const accent = isDarkMode ? 'rgba(44,224,127,0.2)' : BRAND[50];
  const dot = isDarkMode ? 'rgba(44,224,127,0.22)' : 'rgba(0,168,90,0.16)';
  const fill = surface ?? hex.card;

  // Every closed shape: filled with the surface so the outline behind it is hidden, then stroked.
  const line = {
    fill,
    stroke: ink,
    strokeWidth: S,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
  } as const;
  const box = { width: size, height: size, viewBox: `0 0 ${BOX} ${BOX}` };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      accessibilityLabel={label}
      style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={{ width: size, height: size }}>
        {/* Tail first — it passes behind the rump. */}
        <Pivot k={k} at={PIVOT.tail} animatedStyle={tailStyle}>
          <Svg {...box}>
            <Path
              d="M 92,100 C 105,99 114,87 111,74 C 109,66 101,64 99,71 C 97,78 101,82 93,89 Z"
              {...line}
            />
          </Svg>
        </Pivot>

        {/* Everything that doesn't move: ground, rump, chest, front legs, collar. */}
        <Svg {...box} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Ellipse cx="60" cy="114" rx="34" ry="4" fill={dot} />
          {/* the pattern tile's scattered dots, so the drawing carries the same furniture */}
          <Circle cx="14" cy="18" r="2.4" fill={dot} />
          <Circle cx="26" cy="9" r="1.5" fill={dot} />
          <Circle cx="108" cy="26" r="1.8" fill={dot} />

          <Ellipse cx="82" cy="92" rx="16" ry="18" {...line} />
          <Path
            d="M 70,110 C 70,104 92,103 95,108 C 97,112 88,113 80,113 C 74,113 70,113 70,110 Z"
            {...line}
          />
          <Path
            d="M 45,52 C 36,68 31,88 33,100 C 35,110 45,113 57,113 C 70,113 80,109 82,99 C 84,85 79,64 71,52 Z"
            {...line}
          />
          <Path
            d="M 39,86 C 36,95 36,105 38,109 C 40,113 50,113 52,109 C 54,103 53,93 52,86 Z"
            {...line}
          />
          <Path
            d="M 58,86 C 55,95 55,105 57,109 C 59,113 69,113 71,109 C 73,103 72,93 71,86 Z"
            {...line}
          />
          <Path
            d="M 42,105 L 42,110 M 46,105 L 46,110 M 61,105 L 61,110 M 65,105 L 65,110"
            fill="none"
            stroke={soft}
            strokeWidth={S * 0.8}
            strokeLinecap="round"
          />
          <Path
            d="M 43,58 C 49,68 69,68 75,58"
            fill="none"
            stroke={ink}
            strokeWidth={S}
            strokeLinecap="round"
          />
          <Circle cx="59" cy="69" r="4" fill={accent} stroke={ink} strokeWidth={S * 0.85} />
        </Svg>

        {/* The head, and the eyes nested inside it so a blink tilts with the face. */}
        <Pivot k={k} at={PIVOT.head} animatedStyle={headStyle}>
          <Svg {...box}>
            <Path
              d="M 36,22 C 20,26 13,44 17,58 C 20,68 31,70 38,62 C 44,54 43,32 36,22 Z"
              {...line}
            />
            <Path
              d="M 82,22 C 98,26 105,44 101,58 C 98,68 87,70 80,62 C 74,54 75,32 82,22 Z"
              {...line}
            />
            <Path
              d="M 59,11 C 43,11 31,22 31,38 C 31,54 43,65 59,65 C 75,65 87,54 87,38 C 87,22 75,11 59,11 Z"
              {...line}
            />
            {/* crown tuft */}
            <Path
              d="M 48,15 C 52,10 56,10 59,13 C 62,10 66,10 70,15"
              fill="none"
              stroke={ink}
              strokeWidth={S * 0.85}
              strokeLinecap="round"
            />
            {/* muzzle crease */}
            <Path
              d="M 47,48 C 47,58 71,58 71,48"
              fill="none"
              stroke={soft}
              strokeWidth={S * 0.7}
              strokeLinecap="round"
            />
            <Path
              d="M 52,45 C 52,42 66,42 66,45 C 66,50 61,54 59,54 C 57,54 52,50 52,45 Z"
              fill={ink}
            />
            <Path
              d="M 59,54 L 59,57 M 51,57 C 54,62 59,61 59,57 C 59,61 64,62 67,57"
              fill="none"
              stroke={ink}
              strokeWidth={S * 0.8}
              strokeLinecap="round"
            />
            <Path
              d="M 55,59 C 55,67 63,67 63,59 Z"
              fill={accent}
              stroke={ink}
              strokeWidth={S * 0.8}
              strokeLinejoin="round"
            />
          </Svg>

          <Pivot k={k} at={PIVOT.eyes} animatedStyle={blinkStyle}>
            <Svg {...box}>
              <Ellipse cx="48" cy="36" rx="3.6" ry="4.6" fill={ink} />
              <Ellipse cx="70" cy="36" rx="3.6" ry="4.6" fill={ink} />
            </Svg>
          </Pivot>
        </Pivot>
      </View>

      {label ? <Text className={`mt-3 text-center text-sm ${subtextColor}`}>{label}</Text> : null}
    </View>
  );
}
