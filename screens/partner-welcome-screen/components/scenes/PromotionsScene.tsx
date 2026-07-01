import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import { useFloatY, usePopIn, useSlideInRight, useTwinkle } from './sceneAnim';

const GREEN = '#22C55E';

/** A 4-pointed amber sparkle that twinkles forever. */
function Sparkle({ posStyle, size, delay }: { posStyle: any; size: number; delay: number }) {
  const { opacity, scale } = useTwinkle(delay);
  return (
    <Animated.View
      style={[{ position: 'absolute' }, posStyle, { opacity, transform: [{ scale }] }]}
      pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 12 12">
        <Path d="M6 0L7 5L12 6L7 7L6 12L5 7L0 6L5 5Z" fill="#f97316" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Slide 5 illustration — "Promote Your Services".
 * An offer card whose discount rows slide in (one percentage, one fixed amount),
 * a price-tag badge that pops then wiggles, a floating "20% OFF" pill and sparkles.
 */
export default function PromotionsScene() {
  const row0 = useSlideInRight(150);
  const row1 = useSlideInRight(280);
  const pillY = useFloatY(7, 2800);
  const tagScale = usePopIn(250, 80, 5);

  // Tag wiggle starts after the pop.
  const tagRotate = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(1000),
          Animated.timing(tagRotate, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(tagRotate, { toValue: -1, duration: 600, useNativeDriver: true }),
          Animated.timing(tagRotate, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tagRotateDeg = tagRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  return (
    <LinearGradient colors={['#fff7ed', '#ffedd5']} style={styles.zone}>
      <View style={styles.circle} pointerEvents="none" />

      {/* Offer card */}
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.titleEmoji}>📢</Text>
          <Text style={styles.title}>Promotions</Text>
        </View>

        <Animated.View style={[styles.row, styles.rowOrange, row0]}>
          <View style={[styles.dot, { backgroundColor: '#fb923c' }]} />
          <Text style={styles.name}>Dog Grooming</Text>
          <Text style={styles.strike}>$45</Text>
          <Text style={styles.bold}>$36</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>20% OFF</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.row, styles.rowGreen, row1]}>
          <View style={[styles.dot, { backgroundColor: GREEN }]} />
          <Text style={styles.name}>Dog Walking</Text>
          <Text style={styles.strike}>$25</Text>
          <Text style={styles.bold}>$20</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>$5 OFF</Text>
          </View>
        </Animated.View>

        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Text style={styles.statEmoji}>📈</Text>
          <Text style={styles.statUp}>Bookings ↑ 32%</Text>
          <Text style={styles.statNote}>with offers active</Text>
        </View>
      </View>

      {/* Tag badge */}
      <Animated.View
        style={[styles.tag, { transform: [{ scale: tagScale }, { rotate: tagRotateDeg }] }]}
        pointerEvents="none">
        <Text style={styles.tagEmoji}>🏷️</Text>
      </Animated.View>

      {/* Floating pill */}
      <Animated.View
        style={[styles.pill, { transform: [{ translateY: pillY }] }]}
        pointerEvents="none">
        <Text style={styles.pillText}>20% OFF</Text>
      </Animated.View>

      {/* Sparkles */}
      <Sparkle posStyle={{ top: '14%', left: '8%' }} size={10} delay={0} />
      <Sparkle posStyle={{ top: '28%', right: '7%' }} size={8} delay={550} />
      <Sparkle posStyle={{ bottom: '18%', right: '20%' }} size={12} delay={1100} />
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
    backgroundColor: 'rgba(254,215,170,0.5)',
  },

  card: {
    width: 175,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  titleEmoji: { fontSize: 11 },
  title: { fontSize: 11, fontWeight: '700', color: '#1e293b' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 7,
    borderRadius: 10,
    marginBottom: 6,
  },
  rowOrange: { backgroundColor: '#fff7ed' },
  rowGreen: { backgroundColor: '#f0fdf4' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  name: { flex: 1, fontSize: 9, fontWeight: '600', color: '#475569' },
  strike: { textDecorationLine: 'line-through', color: '#94a3b8', fontSize: 8, marginRight: 3 },
  bold: { fontSize: 10, fontWeight: '800', color: '#1e293b', marginRight: 4 },
  badge: { backgroundColor: GREEN, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 7, fontWeight: '700', color: '#fff' },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 5 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statEmoji: { fontSize: 9 },
  statUp: { fontSize: 9, fontWeight: '700', color: GREEN },
  statNote: { fontSize: 8, color: '#94a3b8' },

  tag: {
    position: 'absolute',
    top: '10%',
    right: '12%',
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
  tagEmoji: { fontSize: 20 },

  pill: {
    position: 'absolute',
    bottom: '13%',
    left: '6%',
    zIndex: 3,
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
