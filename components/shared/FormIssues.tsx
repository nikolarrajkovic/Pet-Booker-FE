import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

export type FormIssue = {
  /** The field or step it is about, when the message alone doesn't say ("This field is required"). */
  label?: string;
  message: string;
};

type Props = {
  /** What stands between the user and the next step. Nothing renders when there is none. */
  issues: (FormIssue | string)[];
  /**
   * One line naming what is missing ("To continue: Full name, Phone"), for a pinned footer where a
   * list would cover the form. The fields' own messages say the rest.
   */
  compact?: boolean;
  className?: string;
};

/**
 * "To continue: …" — what is still missing, listed beside the button it blocks.
 *
 * A form that marks a bad field in red only helps when that field is on screen. On a long form the
 * field is usually scrolled away when the button is pressed, so the press appeared to do nothing,
 * and a button greyed out until the form is valid said even less. This names each problem where
 * the user is looking. Render it next to the submit button, from the same checks that block it;
 * the fields keep their own inline messages.
 */
export default function FormIssues({ issues, compact = false, className = '' }: Props) {
  const { isDarkMode, textColor } = useThemeColors();
  const { t } = useLocale();
  if (issues.length === 0) return null;

  if (compact) {
    const names = issues.map((i) => (typeof i === 'string' ? i : (i.label ?? i.message)));
    return (
      <View accessibilityRole="alert" aria-live="polite" className={`flex-row ${className}`}>
        <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginTop: 1 }} />
        <Text className={`ml-1.5 flex-1 text-xs ${textColor}`} numberOfLines={2}>
          <Text className="font-semibold text-red-600">{t('common.toContinue')} </Text>
          {names.join(', ')}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="alert"
      aria-live="polite"
      className={`rounded-xl border px-3 py-3 ${
        isDarkMode ? 'border-red-900 bg-red-500/10' : 'border-red-200 bg-red-50'
      } ${className}`}>
      <View className="flex-row items-center">
        <Ionicons name="alert-circle" size={18} color="#EF4444" />
        <Text className="ml-2 text-sm font-semibold text-red-600">{t('common.toContinue')}</Text>
      </View>
      {issues.map((issue, i) => {
        const { label, message } =
          typeof issue === 'string' ? { label: undefined, message: issue } : issue;
        return (
          <View key={`${label ?? ''}${message}${i}`} className="ml-[26px] mt-1 flex-row">
            <Text className={`text-sm ${textColor}`}>{'•  '}</Text>
            <Text className={`flex-1 text-sm ${textColor}`}>
              {label ? <Text className="font-semibold">{label}: </Text> : null}
              {message}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
