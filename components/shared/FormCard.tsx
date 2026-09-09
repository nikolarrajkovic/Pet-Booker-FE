import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors } from '../../hooks/useThemeColors';

type FormCardProps = {
  children: ReactNode;
};

/**
 * The surface a form sits on, on the web design.
 *
 * The phone design already gives a form a surface: the content sheet slides up over the green
 * header and fills the screen, so the fields are on a panel by definition. On the web there is no
 * sheet — the page is the shell's pattern — so the same markup left labels and inputs floating on
 * wallpaper, which is the one place in the app where content had no surface under it.
 *
 * A pass-through on mobile: it renders no wrapper at all there, so the phone design is unchanged.
 */
export default function FormCard({ children }: FormCardProps) {
  const { isWebLayout } = useResponsive();
  const { cardBg } = useThemeColors();

  if (!isWebLayout) return <>{children}</>;

  return <View className={`${cardBg} rounded-2xl px-6 py-6`}>{children}</View>;
}
