import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useAuth } from '../../../context/AuthContext';
import { hapticSelection, hapticSuccess } from '../../../services/haptics';
import AnimatedCheckmark from '../../../components/shared/AnimatedCheckmark';
import Confetti from '../components/Confetti';
import RequestsScene from '../components/scenes/RequestsScene';
import ScheduleScene from '../components/scenes/ScheduleScene';
import ServicesScene from '../components/scenes/ServicesScene';
import PromotionsScene from '../components/scenes/PromotionsScene';
import LiveSessionScene from '../components/scenes/LiveSessionScene';

const GREEN = '#22C55E';

type Slide = {
  id: string;
  Scene: React.ComponentType;
  title: string;
  subtitle: string;
};

// The tour, in the order a partner lives it. Slide 0 is the celebration hero
// (rendered specially below); these are the split illustration/card slides.
const SLIDES: Slide[] = [
  {
    id: 'requests',
    Scene: RequestsScene,
    title: 'Review Requests',
    subtitle:
      'New booking requests show up under Requests. Accept the ones that work for you, or decline with a quick reason.',
  },
  {
    id: 'schedule',
    Scene: ScheduleScene,
    title: 'Manage Your Schedule',
    subtitle:
      'Every accepted booking lands on My Schedule. Switch between day, week, and month to see what’s coming up.',
  },
  {
    id: 'services',
    Scene: ServicesScene,
    title: 'Set Up Your Services',
    subtitle:
      'Add services, set your prices, add-ons, and working hours under My Services so clients can find and book you.',
  },
  {
    id: 'promotions',
    Scene: PromotionsScene,
    title: 'Promote Your Services',
    subtitle:
      'Run percentage or fixed-amount offers to boost your visibility, fill quiet days, and win more bookings.',
  },
  {
    id: 'live',
    Scene: LiveSessionScene,
    title: 'Run a Live Session',
    subtitle:
      'When it’s time, start a Live Session to track the service from start to finish — right down to pickup and drop-off.',
  },
];

const TOTAL = SLIDES.length + 1; // + the celebration hero

/** Wraps a page so it slides in (direction-aware) + fades on mount. */
function AnimatedPage({
  dir,
  style,
  children,
}: {
  dir: number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    const a = Animated.timing(t, {
      toValue: 1,
      duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [dir * 44, 0] });
  return (
    <Animated.View style={[style, { opacity: t, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

/** Soft pulsing ring behind the celebration checkmark. */
function PulsingRing({ size }: { size: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.08] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: size,
        height: size,
        marginTop: -size / 2,
        marginLeft: -size / 2,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.18)',
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/**
 * Celebration + mini-tour shown once, right after a partner application is
 * approved. Slide 0 is the confetti/checkmark "You're Approved!" hero; slides
 * 1–5 are the split illustration/card tour (animated scenes in `components/scenes`).
 *
 * Only the active page is mounted (swapped on `index`) — a moving track and a
 * horizontal ScrollView both mis-render on this RN-Web build, whereas a single
 * page that animates in always lays out correctly. Pagination dots, Back/Next
 * and a frosted Skip drive it; pages can also be swiped.
 *
 * Terminal screen: the CTA and Skip both reset the stack onto the PartnerHub tab
 * so back can't re-enter. Triggered from `App.tsx` when `isPartner` first
 * becomes true for a user who hasn't seen it (see `services/onboarding.ts`).
 */
export default function PartnerWelcomeScreen() {
  const { resetToTab } = useAppNavigation();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const indexRef = useRef(0);
  indexRef.current = index;

  const firstName = currentUser?.firstName?.trim() || 'Partner';
  const goToHub = () => resetToTab('PartnerHub');

  useEffect(() => {
    hapticSuccess();
  }, []);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(TOTAL - 1, i));
    if (clamped !== indexRef.current) {
      hapticSelection();
      setDir(clamped > indexRef.current ? 1 : -1);
      setIndex(clamped);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -50 || g.vx <= -0.3) goTo(indexRef.current + 1);
        else if (g.dx >= 50 || g.vx >= 0.3) goTo(indexRef.current - 1);
      },
    })
  ).current;

  const isHero = index === 0;
  const isLast = index === TOTAL - 1;
  const slide = isHero ? null : SLIDES[index - 1];
  const next = () => (isLast ? goToHub() : goTo(index + 1));

  const renderDots = () => (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${TOTAL}`}
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: TOTAL }).map((_, i) => {
        const active = i === index;
        return (
          <View
            key={i}
            style={{
              width: active ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: active
                ? isHero
                  ? '#fff'
                  : GREEN
                : isHero
                  ? 'rgba(255,255,255,0.35)'
                  : '#e5e7eb',
            }}
          />
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: isHero ? GREEN : '#fff' }}>
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        {isHero ? (
          /* ── Celebration hero ── */
          <AnimatedPage
            key={index}
            dir={dir}
            style={{
              flex: 1,
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 18,
              paddingHorizontal: 30,
              alignItems: 'center',
            }}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <PulsingRing size={150} />
                <AnimatedCheckmark size={104} color="white" ringColor="rgba(255,255,255,0.25)" />
              </View>
              <Text
                accessibilityRole="header"
                style={{
                  marginTop: 36,
                  textAlign: 'center',
                  fontSize: 30,
                  fontWeight: '800',
                  color: '#fff',
                }}>
                You’re Approved! 🎉
              </Text>
              <Text
                style={{
                  marginTop: 14,
                  textAlign: 'center',
                  fontSize: 16,
                  lineHeight: 24,
                  color: 'rgba(255,255,255,0.9)',
                }}>
                Welcome to the team, {firstName}. Your partner account is ready to go — here’s a
                quick tour of what you can do now.
              </Text>
            </View>

            {renderDots()}
            <TouchableOpacity
              onPress={next}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Start the tour"
              style={{
                marginTop: 22,
                alignSelf: 'stretch',
                backgroundColor: '#fff',
                paddingVertical: 16,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}>
              <Text style={{ color: GREEN, fontSize: 17, fontWeight: '800' }}>Get Started</Text>
              <Ionicons name="chevron-forward" size={18} color={GREEN} />
            </TouchableOpacity>
          </AnimatedPage>
        ) : (
          /* ── Split illustration / content card ── */
          <View style={{ flex: 1 }}>
            <View style={{ height: '54%', overflow: 'hidden' }}>
              <AnimatedPage key={index} dir={dir} style={{ flex: 1 }}>
                {React.createElement(slide!.Scene)}
              </AnimatedPage>
            </View>

            <View
              style={{
                flex: 1,
                paddingHorizontal: 28,
                paddingTop: 22,
                paddingBottom: insets.bottom + 18,
              }}>
              <AnimatedPage key={index} dir={dir}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827' }}>
                  {slide!.title}
                </Text>
                <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: '#6b7280' }}>
                  {slide!.subtitle}
                </Text>
              </AnimatedPage>

              <View style={{ flex: 1 }} />

              <View style={{ marginBottom: 18 }}>{renderDots()}</View>

              <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => goTo(index - 1)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Previous step"
                  style={{
                    width: 48,
                    borderRadius: 16,
                    backgroundColor: '#f3f4f6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="chevron-back" size={20} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={next}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? 'Explore Partner Hub' : 'Next step'}
                  style={{
                    flex: 1,
                    backgroundColor: GREEN,
                    paddingVertical: 16,
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                    {isLast ? 'Explore Partner Hub' : 'Next'}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Frosted Skip — hidden on the last page. */}
      {!isLast && (
        <TouchableOpacity
          onPress={goToHub}
          accessibilityRole="button"
          accessibilityLabel="Skip the tour and go to Partner Hub"
          activeOpacity={0.8}
          style={{
            position: 'absolute',
            top: insets.top + 10,
            right: 16,
            backgroundColor: 'rgba(0,0,0,0.26)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 999,
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Confetti rains over the celebration hero only. */}
      {isHero && <Confetti />}
    </View>
  );
}
