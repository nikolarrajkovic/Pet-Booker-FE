import React from 'react';
import { Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

type BackLinkProps = {
  /** Overrides the default pop. Use for a flow that has to leave somewhere specific. */
  onPress?: () => void;
};

/**
 * The web design's back affordance — the one and only one.
 *
 * On a desktop the way back sits in the page flow above the title, as a labelled link rather
 * than a thumb-sized circular icon button in a bar: there is no thumb, and an unlabelled arrow
 * on a light ground is a guess. The phone design keeps its white arrow on the green `AppHeader`
 * slab, which is a different surface with a different rule.
 *
 * Shared because it was not shared: `PageHeader` drew this link, while the admin screens that
 * hand-roll their own header drew a bordered circle beside the title instead. Same action, two
 * shapes, decided by which screen you happened to be on.
 *
 * Falls back to Home when there is no history — a deep link or a reload lands with an empty
 * stack, and a back control that does nothing is worse than one that goes somewhere sensible.
 */
export default function BackLink({ onPress }: BackLinkProps) {
  const navigation = useNavigation();
  const { subtextColor, hex } = useThemeColors();
  const { t } = useLocale();

  const handlePress = () => {
    if (onPress) return onPress();
    if (navigation.canGoBack()) return navigation.goBack();
    (navigation as any).navigate('MainTabs', { screen: 'Home' });
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      style={({ hovered }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 12,
        opacity: hovered ? 0.7 : 1,
        cursor: 'pointer',
      })}>
      <Ionicons name="arrow-back" size={18} color={hex.subtext} />
      <Text className={`ml-2 text-sm font-medium ${subtextColor}`}>{t('common.back')}</Text>
    </Pressable>
  );
}
