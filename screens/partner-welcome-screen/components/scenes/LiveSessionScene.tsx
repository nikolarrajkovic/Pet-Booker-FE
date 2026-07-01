import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useFloatY } from './sceneAnim';

const TEAL = '#14b8a6';

// Cubic Bézier sampled into a dotted route across the map (bottom-left → top-right).
const P = [
  { x: 26, y: 138 },
  { x: 74, y: 138 },
  { x: 98, y: 66 },
  { x: 140, y: 46 },
];
const bez = (t: number, k: 'x' | 'y') => {
  const u = 1 - t;
  return (
    u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]
  );
};
const ROUTE = Array.from({ length: 11 }, (_, i) => {
  const t = i / 10;
  return { x: bez(t, 'x'), y: bez(t, 'y') };
});
const END = ROUTE[ROUTE.length - 1];

/** A single route dot that fades+scales in on mount, then stays. */
function DrawDot({ x, y, delay }: { x: number; y: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, { toValue: 1, duration: 220, delay, useNativeDriver: true });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={[
        styles.routeDot,
        { left: x - 2.5, top: y - 2.5, opacity: v, transform: [{ scale: v }] },
      ]}
    />
  );
}

/**
 * Slide 6 illustration — "Run a Live Session".
 * A mini-map whose route draws itself dot-by-dot to a bouncing GPS pin (with an
 * expanding ping ring), a pulsing "LIVE" badge and a floating distance chip.
 */
export default function LiveSessionScene() {
  const pinY = useFloatY(9, 700); // brisk bounce
  const chipY = useFloatY(6, 2600);

  // Ping ring expands + fades, forever.
  const ping = useRef(new Animated.Value(0)).current;
  // LIVE badge opacity pulse.
  const pulse = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const pingAnim = Animated.loop(
      Animated.timing(ping, { toValue: 1, duration: 1800, useNativeDriver: true })
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pingAnim.start();
    pulseAnim.start();
    return () => {
      pingAnim.stop();
      pulseAnim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pingScale = ping.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] });
  const pingOpacity = ping.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <LinearGradient colors={['#f0fdfa', '#ccfbf1']} style={styles.zone}>
      <View style={styles.circle} pointerEvents="none" />

      {/* Map card */}
      <View style={styles.map}>
        {/* Grid */}
        <View style={[styles.gridV, { left: '33%' }]} />
        <View style={[styles.gridV, { left: '66%' }]} />
        <View style={[styles.gridH, { top: '33%' }]} />
        <View style={[styles.gridH, { top: '66%' }]} />
        {/* Buildings */}
        <View style={[styles.building, { left: 44, top: 96, width: 30, height: 24 }]} />
        <View style={[styles.building, { left: 96, top: 52, width: 30, height: 26 }]} />
        <View style={[styles.building, { left: 52, top: 40, width: 22, height: 20 }]} />

        {/* Route dots */}
        {ROUTE.map((p, i) => (
          <DrawDot key={i} x={p.x} y={p.y} delay={i * 110} />
        ))}
        {/* Start dot */}
        <View style={[styles.startDot, { left: ROUTE[0].x - 4, top: ROUTE[0].y - 4 }]} />

        {/* GPS pin + ping */}
        <View style={[styles.pinWrap, { left: END.x - 16, top: END.y - 28 }]} pointerEvents="none">
          <Animated.View
            style={[styles.ping, { opacity: pingOpacity, transform: [{ scale: pingScale }] }]}
          />
          <Animated.View style={{ transform: [{ translateY: pinY }] }}>
            <Ionicons name="location" size={30} color="#22C55E" />
          </Animated.View>
        </View>
      </View>

      {/* LIVE badge */}
      <Animated.View style={[styles.live, { opacity: pulse }]} pointerEvents="none">
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </Animated.View>

      {/* Distance chip */}
      <Animated.View
        style={[styles.chip, { transform: [{ translateY: chipY }] }]}
        pointerEvents="none">
        <Ionicons name="location-outline" size={12} color={TEAL} />
        <Text style={styles.chipText}>1.2 km away</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const MAP = 170;

const styles = StyleSheet.create({
  zone: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 260,
    height: 260,
    marginTop: -130,
    marginLeft: -130,
    borderRadius: 130,
    backgroundColor: 'rgba(153,246,228,0.5)',
  },

  map: {
    width: MAP,
    height: MAP,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#eef2f6' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#eef2f6' },
  building: { position: 'absolute', borderRadius: 4, backgroundColor: '#dcfce7' },

  routeDot: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: TEAL },
  startDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TEAL,
    borderWidth: 2,
    borderColor: '#fff',
  },

  pinWrap: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  ping: {
    position: 'absolute',
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.4)',
  },

  live: {
    position: 'absolute',
    top: '8%',
    right: '12%',
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: '#ef4444',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  chip: {
    position: 'absolute',
    bottom: '15%',
    left: '7%',
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
});
