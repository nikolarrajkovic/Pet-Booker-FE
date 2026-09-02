import React, { ReactNode } from 'react';
import { SafeAreaView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useResponsive } from '../../hooks/useResponsive';
import AppHeader from './AppHeader';
import PageHeader from './PageHeader';
import ContentContainer, { type ContentWidth } from './ContentContainer';

type ScreenLayoutProps = {
  // AppHeader props
  headerVariant?: 'large' | 'standard' | 'compact';
  showBackButton?: boolean;
  onBackPress?: () => void;
  headerTitle?: string;
  headerSubtitle?: string;
  headerChildren?: ReactNode;
  showNotificationButton?: boolean;
  onNotificationPress?: () => void;
  rightAction?: ReactNode;

  // Content area props
  children: ReactNode;
  contentRounded?: boolean; // default true

  // Footer (e.g., TabBar)
  footer?: ReactNode;

  // Background colors (can be overridden)
  safeAreaBg?: string;
  contentBg?: string;

  // Keyboard avoidance (default true) — see the note on the KeyboardAvoidingView below.
  avoidKeyboard?: boolean;

  // ── Web design only. All of these are inert on the phone design. ───────────────────────────
  /** How wide the content column may grow on web. See `CONTENT_WIDTHS`. */
  width?: ContentWidth;
  /**
   * Actions for the web page-title row. Falls back to `rightAction`, which on the phone design
   * sits in the coloured header bar — usually the same buttons in a different place.
   */
  webHeaderRight?: ReactNode;
  /**
   * Skip the page header and the width cap — for a screen that owns its whole viewport on web
   * (a full-bleed map, a chat thread).
   */
  webBare?: boolean;
};

/**
 * The root of every screen, in **both** designs.
 *
 * - **Mobile** — unchanged from what ships today: `SafeAreaView` → `KeyboardAvoidingView` →
 *   green `AppHeader` → content sheet pulled up over it with a rounded top → footer.
 * - **Web** — a page: `PageHeader` (plain title + back link) above the body, both centred in a
 *   width-capped column, with no safe-area padding, no coloured slab and no rounded sheet. The
 *   chrome that used to live in the header — the notification bell, the account menu — is in the
 *   persistent `TopBar`, so `showNotificationButton` is deliberately **ignored** on this design;
 *   two bells on one page is worse than none.
 *
 * Which design you get is decided by window width (`hooks/useResponsive.ts`), so a phone browser
 * gets the phone design and a desktop browser gets the web one.
 *
 * Every screen keeps calling this exactly as it did; the web-only props are all optional, and a
 * screen passing none still gets a correct — if plain — web layout.
 *
 * **Two-column screens** use `TwoColumn` inside their own body rather than a prop here: on mobile
 * the side panel has to sit inside the screen's own ScrollView, and a wrapper at this level
 * cannot put it there.
 */
export default function ScreenLayout({
  headerVariant = 'standard',
  showBackButton = false,
  onBackPress,
  headerTitle,
  headerSubtitle,
  headerChildren,
  showNotificationButton = false,
  onNotificationPress,
  rightAction,
  children,
  contentRounded = true,
  footer,
  safeAreaBg,
  contentBg,
  avoidKeyboard = true,
  width = 'default',
  webHeaderRight,
  webBare = false,
}: ScreenLayoutProps) {
  const { bgColor, hex } = useThemeColors();
  const { isWebLayout } = useResponsive();

  const finalSafeAreaBg = safeAreaBg || bgColor;
  const finalContentBg = contentBg || bgColor;

  // ── Web design ─────────────────────────────────────────────────────────────────────────────
  if (isWebLayout) {
    if (webBare) {
      return (
        <View style={{ flex: 1, backgroundColor: hex.bg }}>
          {children}
          {footer}
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: hex.bg }}>
        {/*
          Two containers, not one: the header needs the column's horizontal gutters, but the body
          does not — screens already pad their own ScrollViews (`px-6`), and nesting a padded
          container around that would double every gutter on every screen at once. So the body
          gets the width cap and centring without the padding, and screens keep owning their own.
        */}
        <ContentContainer width={width}>
          <PageHeader
            title={headerTitle}
            subtitle={headerSubtitle}
            showBackButton={showBackButton}
            onBackPress={onBackPress}
            actions={webHeaderRight ?? rightAction}>
            {headerChildren}
          </PageHeader>
        </ContentContainer>

        <ContentContainer width={width} noPadding style={{ flex: 1, minHeight: 0 }}>
          {children}
        </ContentContainer>

        {/* A footer here is a CTA bar, not the TabBar (which renders nothing off the phone
            design). In the flow at the end of the column rather than pinned across the window —
            see the note in StickyFooter. */}
        {footer}
      </View>
    );
  }

  // ── Mobile design (unchanged) ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className={`flex-1 ${finalSafeAreaBg}`}>
      {/*
        Android has drawn edge-to-edge since Expo SDK 54, which makes the manifest's
        `adjustResize` a no-op — the window no longer shrinks when the keyboard opens, so the IME
        covers the focused field instead. Padding the screen by the keyboard's height restores
        that: the body shrinks, and the ScrollView inside it scrolls the focused input into view
        the way it used to. This is a no-op while the keyboard is closed, so it is on for every
        screen; pass `avoidKeyboard={false}` for the rare one that manages the keyboard itself.

        Requires the `KeyboardProvider` mounted in App.tsx — without it this never moves.
      */}
      <KeyboardAvoidingView behavior="padding" enabled={avoidKeyboard} style={{ flex: 1 }}>
        <AppHeader
          variant={headerVariant}
          showBackButton={showBackButton}
          onBackPress={onBackPress}
          title={headerTitle}
          subtitle={headerSubtitle}
          showNotificationButton={showNotificationButton}
          onNotificationPress={onNotificationPress}
          rightAction={rightAction}>
          {headerChildren}
        </AppHeader>

        {/* Content area with rounded top */}
        {contentRounded ? (
          <View
            className={`-mt-8 ${finalContentBg} flex-1 rounded-t-3xl`}
            style={{ overflow: 'hidden' }}>
            {children}
          </View>
        ) : (
          <View className="flex-1">{children}</View>
        )}

        {/* Footer (e.g., TabBar) */}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
