import React, { ReactNode } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BRAND, useThemeColors } from '../../hooks/useThemeColors';
import { useResponsive } from '../../hooks/useResponsive';
import PatternBackground from '../shared/PatternBackground';

type AuthLayoutProps = {
  /** Big line in the brand band — the app name, or the screen's purpose. */
  title: string;
  /** Supporting line under it. */
  subtitle?: string;
  /** The form. */
  children: ReactNode;
};

/**
 * The shell for the signed-out screens: Login, Register, Verify Email.
 *
 * These are the only screens with **no `AppShell` around them** — there is no navigation to offer
 * someone who is not signed in, so a sidebar would be a column of dead links. They therefore have
 * to do their own centring, which is why this exists rather than the screens reaching for
 * `ScreenLayout`.
 *
 * - **Mobile** — exactly what ships today: the green brand band across the top with a rounded
 *   bottom edge, and the form scrolling beneath it.
 * - **Web** — the band and the form become one **centred card**. A sign-in form stretched across
 *   a 1440px window, with a green band the full width of the monitor and two inputs running the
 *   whole way across, is the most obvious "phone app in a browser" tell in the product — and it
 *   is the first screen anybody sees.
 *
 * The band is drawn **here rather than passed in**, because its shape differs between the two
 * designs: the rounded bottom edge exists to sit against the top of a phone screen, and inside a
 * card it reads as a detached green panel floating above the fields. Owning it here also means
 * the brand block cannot drift between the three screens.
 */
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const { isWebLayout } = useResponsive();
  const { isDarkMode, bgColor, hex, borderColor } = useThemeColors();

  const bandBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';

  const band = (
    <View
      className={`${bandBg} items-center px-6 ${
        isWebLayout ? 'pb-8 pt-10' : 'rounded-b-3xl pb-12 pt-16'
      }`}>
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg">
        <MaterialCommunityIcons name="paw" size={40} color={BRAND[600]} />
      </View>
      <Text className="text-2xl font-bold text-white">{title}</Text>
      {!!subtitle && (
        <Text className={`mt-1 ${isDarkMode ? 'text-gray-400' : 'text-brand-100'}`}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  if (!isWebLayout) {
    return (
      <SafeAreaView className={`flex-1 ${bgColor}`}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {band}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <PatternBackground style={{ backgroundColor: hex.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
        keyboardShouldPersistTaps="handled">
        <View
          className={`border ${borderColor} overflow-hidden rounded-3xl`}
          style={{
            width: '100%',
            maxWidth: 440,
            backgroundColor: hex.card,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
          }}>
          {band}
          <View style={{ padding: 24 }}>{children}</View>
        </View>
      </ScrollView>
    </PatternBackground>
  );
}
