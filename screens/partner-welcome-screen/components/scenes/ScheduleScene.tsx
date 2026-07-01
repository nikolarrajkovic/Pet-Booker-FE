import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFloatY, usePopIn } from './sceneAnim';

const PURPLE = '#6d28d9';
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DATES = Array.from({ length: 30 }, (_, i) => i + 1);
const TINTED = new Set([8, 22, 23]); // soft-lavender days
const HIGHLIGHT = 15; // the booked day that pops

/**
 * Slide 3 illustration — "Manage Your Schedule".
 * A calendar card with a few tinted days; the highlighted booking day pops in.
 * A booking chip and a green check float gently.
 */
export default function ScheduleScene() {
  const popScale = usePopIn(450);
  const chipY = useFloatY(6, 2600);
  const checkY = useFloatY(7, 2200, 400);

  return (
    <LinearGradient colors={['#f5f3ff', '#ede9fe']} style={styles.zone}>
      <View style={styles.circle} pointerEvents="none" />

      {/* Calendar card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerMonth}>JUNE 2025</Text>
          <Text style={styles.headerTitle}>Schedule</Text>
        </View>

        <View style={styles.grid}>
          {DAY_LABELS.map((d, i) => (
            <View key={`l${i}`} style={styles.cell}>
              <Text style={styles.dayLabel}>{d}</Text>
            </View>
          ))}

          {DATES.map((n) => {
            const isHi = n === HIGHLIGHT;
            const isTint = TINTED.has(n);
            const cell = (
              <View style={[styles.dateCell, isTint && styles.dateTint, isHi && styles.dateHi]}>
                <Text style={[styles.dateText, isHi && styles.dateTextHi]}>{n}</Text>
              </View>
            );
            return (
              <View key={n} style={styles.cell}>
                {isHi ? (
                  <Animated.View style={{ transform: [{ scale: popScale }] }}>{cell}</Animated.View>
                ) : (
                  cell
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Floating booking chip */}
      <Animated.View
        style={[styles.eventChip, { transform: [{ translateY: chipY }] }]}
        pointerEvents="none">
        <View style={styles.eventBar} />
        <View>
          <Text style={styles.eventTitle}>Max — Grooming</Text>
          <Text style={styles.eventTime}>10:00 AM · 1h</Text>
        </View>
      </Animated.View>

      {/* Floating green check */}
      <Animated.View
        style={[styles.check, { transform: [{ translateY: checkY }] }]}
        pointerEvents="none">
        <Ionicons name="checkmark" size={18} color="#fff" />
      </Animated.View>
    </LinearGradient>
  );
}

const CARD_W = 190;

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
    backgroundColor: 'rgba(221,214,254,0.55)',
  },

  card: {
    width: CARD_W,
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
  header: { backgroundColor: PURPLE, paddingHorizontal: 14, paddingVertical: 10 },
  headerMonth: { color: 'rgba(255,255,255,0.8)', fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingVertical: 8 },
  cell: { width: (CARD_W - 12) / 7, alignItems: 'center', paddingVertical: 2 },
  dayLabel: { fontSize: 8, fontWeight: '700', color: '#94a3b8' },

  dateCell: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTint: { backgroundColor: '#ede9fe' },
  dateHi: { backgroundColor: PURPLE },
  dateText: { fontSize: 9, color: '#475569', fontWeight: '600' },
  dateTextHi: { color: '#fff', fontWeight: '800' },

  eventChip: {
    position: 'absolute',
    bottom: '17%',
    left: '6%',
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  eventBar: { width: 3, height: 24, borderRadius: 2, backgroundColor: PURPLE },
  eventTitle: { fontSize: 9, fontWeight: '800', color: '#1e293b' },
  eventTime: { fontSize: 8, color: '#94a3b8', marginTop: 1 },

  check: {
    position: 'absolute',
    top: '9%',
    right: '14%',
    zIndex: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
