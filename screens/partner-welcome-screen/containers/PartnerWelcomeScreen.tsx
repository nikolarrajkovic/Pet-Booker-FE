import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useAuth } from '../../../context/AuthContext';
import { useLocale } from '../../../context/LocaleContext';
import { hapticSelection, hapticSuccess } from '../../../services/haptics';
import AnimatedCheckmark from '../../../components/shared/AnimatedCheckmark';
import Confetti from '../components/Confetti';
import RequestsScene from '../components/scenes/RequestsScene';
import ScheduleScene from '../components/scenes/ScheduleScene';
import ServicesScene from '../components/scenes/ServicesScene';
import PromotionsScene from '../components/scenes/PromotionsScene';
import LiveSessionScene from '../components/scenes/LiveSessionScene';
import { useResponsive } from '../../../hooks/useResponsive';
import { getServiceProvider } from '../../../services/service-providers';

const GREEN = '#22C55E';

type Slide = {
  id: string;
  Scene: React.ComponentType;
  titleKey: string;
  subtitleKey: string;
  /** The web design's illustration half — a shade of the scene's own gradient. */
  tint: string;
};

/** The web design draws each scene on a square card of this size, scaled to the window. */
const STAGE = 420;

// The tour, in the order a partner lives it. Slide 0 is the celebration hero
// (rendered specially below); these are the split illustration/card slides.
// Titles/subtitles are translation keys, resolved with t() at render.
const SLIDES: Slide[] = [
  {
    id: 'requests',
    tint: '#fde8e8',
    Scene: RequestsScene,
    titleKey: 'partnerWelcome.slide1Title',
    subtitleKey: 'partnerWelcome.slide1Text',
  },
  {
    id: 'schedule',
    tint: '#ebe7fd',
    Scene: ScheduleScene,
    titleKey: 'partnerWelcome.slide2Title',
    subtitleKey: 'partnerWelcome.slide2Text',
  },
  {
    id: 'services',
    tint: '#f8e3fd',
    Scene: ServicesScene,
    titleKey: 'partnerWelcome.slide3Title',
    subtitleKey: 'partnerWelcome.slide3Text',
  },
  {
    id: 'promotions',
    tint: '#feead3',
    Scene: PromotionsScene,
    titleKey: 'partnerWelcome.slide4Title',
    subtitleKey: 'partnerWelcome.slide4Text',
  },
  {
    id: 'live',
    tint: '#d5f7ef',
    Scene: LiveSessionScene,
    titleKey: 'partnerWelcome.slide5Title',
    subtitleKey: 'partnerWelcome.slide5Text',
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
 * so back can't re-enter.
 *
 * **Opened by the approval notification** (`navigation/notificationRoute.ts`), which exists
 * exactly once — at the moment the decision is made. It used to be triggered at sign-in, on
 * the first render where `isPartner` was true for a user this device held no "seen" flag for:
 * a fact about the device, not the approval, so a partner approved months ago met the confetti
 * again on every fresh browser or reinstall.
 *
 * On the web design the shell unmounts for this route, so the celebration owns the whole
 * window rather than sitting in the content column with the sidebar beside it — see
 * `FULL_BLEED_ROUTES` in `components/layout/AppShell.tsx`.
 */
export default function PartnerWelcomeScreen() {
  const { isWebLayout } = useResponsive();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { resetToTab, resetToScreen } = useAppNavigation();
  const { currentUser } = useAuth();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const indexRef = useRef(0);
  indexRef.current = index;

  const firstName = currentUser?.firstName?.trim() || t('partnerHub.partner');
  const goToHub = () => resetToTab('PartnerHub');

  // A partner with no services yet ends the tour on adding the first one, with Partner Hub behind
  // it for Back (app review G13). Once they have one, the tour ends on the hub as before.
  const providerId = currentUser?.serviceProviderId || null;
  const [hasNoServices, setHasNoServices] = useState(false);
  useEffect(() => {
    let live = true;
    if (!providerId) return;
    getServiceProvider(providerId)
      .then((sp) => live && setHasNoServices(sp.serviceCount === 0))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [providerId]);
  const finish = () =>
    hasNoServices && providerId
      ? resetToScreen(
          'AddEditService',
          { mode: 'add', serviceProviderId: providerId },
          'PartnerHub'
        )
      : goToHub();
  const finishLabel = hasNoServices
    ? t('partnerWelcome.addFirstService')
    : t('partnerWelcome.exploreHub');

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
  const next = () => (isLast ? finish() : goTo(index + 1));

  const renderDots = (align: 'center' | 'flex-start' = 'center') => (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('partnerWelcome.stepOf', { current: index + 1, total: TOTAL })}
      style={{ flexDirection: 'row', justifyContent: align, alignItems: 'center', gap: 6 }}>
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

  const skipButton = !isLast && (
    // Frosted Skip — hidden on the last page.
    <TouchableOpacity
      onPress={goToHub}
      accessibilityRole="button"
      accessibilityLabel={t('partnerWelcome.skipTour')}
      activeOpacity={0.8}
      style={{
        position: 'absolute',
        top: insets.top + (isWebLayout ? 24 : 10),
        right: isWebLayout ? 32 : 16,
        backgroundColor: 'rgba(0,0,0,0.26)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
        {t('partnerWelcome.skip')}
      </Text>
    </TouchableOpacity>
  );

  // ── The web design: the whole window ────────────────────────────────────────────────────────
  // The phone layout (illustration on top, copy and a full-width button pinned under it) centred
  // in a 560px column read as the mobile app pasted into a browser. Here the hero keeps its
  // full-bleed green with the button under the copy, and each slide splits the window: the
  // illustration as a large card on a tinted half, the copy and the controls beside it.
  if (isWebLayout) {
    const stageScale = Math.max(
      1,
      Math.min(1.6, (Math.min(windowWidth * 0.55, windowHeight) * 0.72) / STAGE)
    );
    return (
      <View style={{ flex: 1, backgroundColor: isHero ? GREEN : '#fff' }}>
        {isHero ? (
          <AnimatedPage
            key={index}
            dir={dir}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 48,
            }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <PulsingRing size={190} />
              <AnimatedCheckmark size={132} color="white" ringColor="rgba(255,255,255,0.25)" />
            </View>
            <Text
              accessibilityRole="header"
              style={{
                marginTop: 44,
                textAlign: 'center',
                fontSize: 44,
                fontWeight: '800',
                color: '#fff',
              }}>
              {t('partnerWelcome.approved')}
            </Text>
            <Text
              style={{
                marginTop: 16,
                maxWidth: 620,
                textAlign: 'center',
                fontSize: 19,
                lineHeight: 29,
                color: 'rgba(255,255,255,0.92)',
              }}>
              {t('partnerWelcome.welcomeText', { name: firstName })}
            </Text>
            <TouchableOpacity
              onPress={next}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('partnerWelcome.startTour')}
              style={{
                marginTop: 40,
                minWidth: 280,
                paddingHorizontal: 40,
                backgroundColor: '#fff',
                paddingVertical: 16,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}>
              <Text style={{ color: GREEN, fontSize: 17, fontWeight: '800' }}>
                {t('partnerWelcome.getStarted')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={GREEN} />
            </TouchableOpacity>
            <View style={{ marginTop: 28 }}>{renderDots()}</View>
          </AnimatedPage>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View
              style={{
                flex: 55,
                backgroundColor: slide!.tint,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
              <AnimatedPage key={index} dir={dir}>
                <View
                  style={{
                    width: STAGE,
                    height: STAGE,
                    borderRadius: 28,
                    overflow: 'hidden',
                    transform: [{ scale: stageScale }],
                    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
                  }}>
                  {React.createElement(slide!.Scene)}
                </View>
              </AnimatedPage>
            </View>
            <View style={{ flex: 45, justifyContent: 'center', paddingHorizontal: 64 }}>
              <View style={{ maxWidth: 480 }}>
                <AnimatedPage key={index} dir={dir}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: GREEN }}>
                    {t('partnerWelcome.stepOf', { current: index + 1, total: TOTAL })}
                  </Text>
                  <Text
                    accessibilityRole="header"
                    style={{ marginTop: 10, fontSize: 36, fontWeight: '800', color: '#111827' }}>
                    {t(slide!.titleKey as any)}
                  </Text>
                  <Text style={{ marginTop: 14, fontSize: 18, lineHeight: 28, color: '#6b7280' }}>
                    {t(slide!.subtitleKey as any)}
                  </Text>
                </AnimatedPage>
                <View style={{ marginTop: 40, flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => goTo(index - 1)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t('partnerWelcome.prevStep')}
                    style={{
                      width: 52,
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
                    accessibilityLabel={isLast ? finishLabel : t('partnerWelcome.nextStep')}
                    style={{
                      minWidth: 200,
                      paddingHorizontal: 32,
                      backgroundColor: GREEN,
                      paddingVertical: 16,
                      borderRadius: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                      {isLast ? finishLabel : t('partnerWelcome.next')}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: 32 }}>{renderDots('flex-start')}</View>
              </View>
            </View>
          </View>
        )}
        {skipButton}
        {isHero && <Confetti />}
      </View>
    );
  }

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
                {t('partnerWelcome.approved')}
              </Text>
              <Text
                style={{
                  marginTop: 14,
                  textAlign: 'center',
                  fontSize: 16,
                  lineHeight: 24,
                  color: 'rgba(255,255,255,0.9)',
                }}>
                {t('partnerWelcome.welcomeText', { name: firstName })}
              </Text>
            </View>

            {renderDots()}
            <TouchableOpacity
              onPress={next}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('partnerWelcome.startTour')}
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
              <Text style={{ color: GREEN, fontSize: 17, fontWeight: '800' }}>
                {t('partnerWelcome.getStarted')}
              </Text>
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
                  {t(slide!.titleKey as any)}
                </Text>
                <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: '#6b7280' }}>
                  {t(slide!.subtitleKey as any)}
                </Text>
              </AnimatedPage>

              <View style={{ flex: 1 }} />

              <View style={{ marginBottom: 18 }}>{renderDots()}</View>

              <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => goTo(index - 1)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('partnerWelcome.prevStep')}
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
                  accessibilityLabel={isLast ? finishLabel : t('partnerWelcome.nextStep')}
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
                    {isLast ? finishLabel : t('partnerWelcome.next')}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {skipButton}

      {/* Confetti rains over the celebration hero only. */}
      {isHero && <Confetti />}
    </View>
  );
}
