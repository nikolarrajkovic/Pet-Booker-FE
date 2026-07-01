import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useFloatY, useSlideInRight } from './sceneAnim';

const GREEN = '#22C55E';
const ROW_DOTS = ['#f87171', '#4ade80', '#60a5fa'];

/** One request row inside the phone: colored dot + label bars + green status square. */
function RequestRow({ color, style }: { color: string; style: any }) {
  return (
    <Animated.View style={[styles.reqRow, style]}>
      <View style={[styles.reqDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <View style={[styles.bar, { width: '70%' }]} />
        <View style={[styles.bar, styles.barFaint, { width: '45%', marginTop: 3 }]} />
      </View>
      <View style={styles.statusSquare} />
    </Animated.View>
  );
}

/**
 * Slide 2 illustration — "Review Requests".
 * A phone mockup whose three booking-request rows slide in staggered, a shaking
 * bell with a "3" badge, and Accept / Decline pills bobbing out of phase.
 */
export default function RequestsScene() {
  const row0 = useSlideInRight(0);
  const row1 = useSlideInRight(130);
  const row2 = useSlideInRight(260);

  const acceptY = useFloatY(6, 1400);
  const declineY = useFloatY(6, 1400, 700);

  // Bell shake: a quick wiggle every ~1.6s.
  const shake = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bellRotate = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <LinearGradient colors={['#fff5f5', '#ffeaea']} style={styles.zone}>
      <View style={styles.circle} pointerEvents="none" />

      {/* Phone mockup */}
      <View style={styles.phone}>
        <View style={styles.notch} />
        <View style={styles.screen}>
          <RequestRow color={ROW_DOTS[0]} style={row0} />
          <RequestRow color={ROW_DOTS[1]} style={row1} />
          <RequestRow color={ROW_DOTS[2]} style={row2} />
        </View>
      </View>

      {/* Bell with unread badge */}
      <Animated.View
        style={[styles.bell, { transform: [{ rotate: bellRotate }] }]}
        pointerEvents="none">
        <Ionicons name="notifications" size={20} color="#334155" />
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>3</Text>
        </View>
      </Animated.View>

      {/* Accept / Decline */}
      <Animated.View
        style={[styles.accept, { transform: [{ translateY: acceptY }] }]}
        pointerEvents="none">
        <Ionicons name="checkmark" size={13} color="#fff" />
        <Text style={styles.acceptText}>Accept</Text>
      </Animated.View>
      <Animated.View
        style={[styles.decline, { transform: [{ translateY: declineY }] }]}
        pointerEvents="none">
        <Ionicons name="close" size={13} color="#ef4444" />
        <Text style={styles.declineText}>Decline</Text>
      </Animated.View>
    </LinearGradient>
  );
}

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
    backgroundColor: 'rgba(254,215,215,0.45)',
  },

  phone: {
    width: 130,
    height: 200,
    backgroundColor: '#1e293b',
    borderRadius: 22,
    paddingHorizontal: 7,
    paddingBottom: 9,
    paddingTop: 6,
    zIndex: 2,
    shadowColor: '#1e293b',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  notch: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#0f172a',
    marginBottom: 4,
  },
  screen: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 8, gap: 7 },

  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 7,
    padding: 6,
  },
  reqDot: { width: 9, height: 9, borderRadius: 4.5 },
  bar: { height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },
  barFaint: { backgroundColor: '#e2e8f0' },
  statusSquare: { width: 12, height: 12, borderRadius: 3, backgroundColor: GREEN },

  bell: {
    position: 'absolute',
    top: '8%',
    right: '13%',
    zIndex: 4,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  accept: {
    position: 'absolute',
    bottom: '13%',
    left: '7%',
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  acceptText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  decline: {
    position: 'absolute',
    bottom: '13%',
    right: '7%',
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  declineText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },
});
