import React, { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import BackLink from './BackLink';

type PageHeaderProps = {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  /** Buttons rendered on the title row, right-aligned. */
  actions?: ReactNode;
  /** Extra content under the title — filter tabs, a summary strip. */
  children?: ReactNode;
};

/**
 * The web design's page title block — what replaces the phone's green `AppHeader` slab.
 *
 * The mobile header is a coloured, rounded, safe-area-padded band that the content sheet slides
 * up over. Every part of that is a phone convention: it exists to give the status bar a
 * background, to be reachable by a thumb, and to separate screens that fill the display. On a
 * desktop none of it applies, and reproducing it costs 180px of vertical space on every page to
 * repeat a title the sidebar already tells you.
 *
 * So on web the title is just a title, with a back link where the flow has one. Chrome that used
 * to live here — the notification bell, the account menu — is in the persistent `TopBar` instead,
 * which is why `ScreenLayout` ignores `showNotificationButton` on this design.
 */
export default function PageHeader({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  actions,
  children,
}: PageHeaderProps) {
  const { textColor, subtextColor } = useThemeColors();

  const hasTitleRow = Boolean(title || actions);

  // Nothing to show means nothing to reserve space for. Without this the padding alone renders —
  // 32px above and 24px below of empty column — which pushes a screen's real first element down
  // the page for no reason. Home hit exactly this once its greeting moved into a card and it
  // stopped passing a title.
  if (!hasTitleRow && !showBackButton && !children) return null;

  return (
    <View className="pb-6 pt-8">
      {showBackButton && <BackLink onPress={onBackPress} />}

      {hasTitleRow && (
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            {title && <Text className={`text-3xl font-bold ${textColor}`}>{title}</Text>}
            {subtitle && <Text className={`mt-2 text-base ${subtextColor}`}>{subtitle}</Text>}
          </View>
          {actions && <View className="flex-row items-center gap-2">{actions}</View>}
        </View>
      )}

      {children && <View className={hasTitleRow ? 'mt-6' : ''}>{children}</View>}
    </View>
  );
}
