import React from 'react';
import { Text, View } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

type StepProgressProps = {
  step: number;
  total: number;
};

/**
 * "Step 2 of 3" with its progress bar, for a multi-step form's header (`headerChildren`).
 *
 * The phone header is a green slab, so the bar and label are white on it. The web design's header
 * is the plain page background, where the same white bar and label were invisible — the screen
 * showed a tall empty band between the title and the form. There they are drawn in the brand
 * colour on a neutral track instead.
 */
export default function StepProgress({ step, total }: StepProgressProps) {
  const { isWebLayout } = useResponsive();
  const { isDarkMode, subtextColor } = useThemeColors();
  const { t } = useLocale();
  const width = `${Math.max(0, Math.min(1, step / total)) * 100}%` as const;
  const label = t('partnerWelcome.stepOf', { current: step, total });

  if (isWebLayout) {
    return (
      <View className="mt-3" style={{ maxWidth: 420 }}>
        <View
          className={`h-1.5 overflow-hidden rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <View className="h-full rounded-full bg-brand-500" style={{ width }} />
        </View>
        <Text className={`mt-2 text-sm ${subtextColor}`}>{label}</Text>
      </View>
    );
  }

  return (
    <>
      <View className="mb-2 mt-4">
        <View className="h-2 overflow-hidden rounded-full bg-white/30">
          <View className="h-full rounded-full bg-white" style={{ width }} />
        </View>
      </View>
      {/* mb-6: clears the rounded content sheet, which is pulled 32px up over the header
          (AppHeader's own pb-6 covers 24 of it). */}
      <Text className="mb-6 text-sm text-white">{label}</Text>
    </>
  );
}
