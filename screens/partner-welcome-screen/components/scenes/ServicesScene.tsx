import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useFloatY, useSlideInRight } from './sceneAnim';

const SERVICES = [
  { name: 'Dog Grooming', price: '$45', color: '#a855f7', bg: '#faf5ff' },
  { name: 'Dog Walking', price: '$25', color: '#22C55E', bg: '#f0fdf4' },
  { name: 'Pet Sitting', price: '$60', color: '#eab308', bg: '#fefce8' },
];

/**
 * Slide 4 illustration — "Set Up Your Services".
 * A "My Services" card whose rows slide in staggered, a snipping scissors badge,
 * and a floating "$25 / session" pill.
 */
export default function ServicesScene() {
  const rows = [useSlideInRight(150), useSlideInRight(280), useSlideInRight(410)];
  const pillY = useFloatY(7, 2800);

  // Scissors "snip": rock open/closed forever.
  const snip = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(snip, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(snip, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const snipRotate = snip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-25deg'] });

  return (
    <LinearGradient colors={['#fdf4ff', '#fae8ff']} style={styles.zone}>
      <View style={styles.circle} pointerEvents="none" />

      {/* Services card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Services</Text>
        {SERVICES.map((s, i) => (
          <Animated.View key={s.name} style={[styles.row, { backgroundColor: s.bg }, rows[i]]}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.rowName}>{s.name}</Text>
            <Text style={[styles.rowPrice, { color: s.color }]}>{s.price}</Text>
          </Animated.View>
        ))}
        <View style={styles.divider} />
        <View style={styles.addRow}>
          <Ionicons name="add-circle-outline" size={12} color="#a855f7" />
          <Text style={styles.addText}>Add service</Text>
        </View>
      </View>

      {/* Scissors badge */}
      <Animated.View
        style={[styles.scissors, { transform: [{ rotate: snipRotate }] }]}
        pointerEvents="none">
        <Ionicons name="cut" size={20} color="#a855f7" />
      </Animated.View>

      {/* Floating price pill */}
      <Animated.View
        style={[styles.pill, { transform: [{ translateY: pillY }] }]}
        pointerEvents="none">
        <Text style={styles.pillText}>$25 / session</Text>
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
    backgroundColor: 'rgba(240,171,252,0.25)',
  },

  card: {
    width: 178,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardTitle: { fontSize: 11, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  rowName: { flex: 1, fontSize: 9.5, fontWeight: '600', color: '#334155' },
  rowPrice: { fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginTop: 2, marginBottom: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addText: { fontSize: 9, fontWeight: '700', color: '#a855f7' },

  scissors: {
    position: 'absolute',
    top: '9%',
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

  pill: {
    position: 'absolute',
    bottom: '14%',
    left: '6%',
    zIndex: 3,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
