import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Shared motion helpers for the partner-welcome illustration scenes.
 *
 * All scenes use the legacy `Animated` API (transform/opacity on the native
 * driver) so the per-slide specs translate 1:1. Every loop is stopped on
 * unmount — only the active scene is mounted at a time (the carousel swaps on
 * index), so leaving a slide tears its loops down. When the OS "Reduce Motion"
 * setting is on, one-shot intros render in their final state and loops don't run.
 */

/** A perpetual up/down bob (sine-like). Returns the value for `translateY`. */
export function useFloatY(distance = 7, duration = 2800, delay = 0) {
  const y = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(y, { toValue: -distance, duration, useNativeDriver: true }),
          Animated.timing(y, { toValue: 0, duration, useNativeDriver: true }),
        ])
      ),
    ]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return y;
}

/** One-shot slide-in from the right (translateX + fade). Returns an animated style. */
export function useSlideInRight(delay = 0, fromX = 18) {
  const v = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    opacity: v,
    transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) }],
  };
}

/** One-shot spring pop-in (scale 0 → 1). Returns the value for `scale`. */
export function usePopIn(delay = 0, tension = 80, friction = 6) {
  const s = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      s.setValue(1);
      return;
    }
    const anim = Animated.spring(s, {
      toValue: 1,
      tension,
      friction,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return s;
}

/** A perpetual twinkle (scale + opacity pulse). Returns scale + opacity styles. */
export function useTwinkle(delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, delay, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }),
  };
}
