import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from './ResponsiveModal';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { setAlertListener, type AlertButton, type AlertRequest } from '../../services/alert-bus';

/**
 * The app's own dialog for `showAlert` on the web build — instead of the browser's
 * `window.alert`/`confirm`, a grey system box at the top of the window that looked like a site
 * error ("Partner added", "Cancel this booking?", every validation message).
 *
 * Mounted once at the root. Requests queue, so a dialog opened from another dialog's button waits
 * its turn rather than replacing it. Button semantics follow `Alert.alert`: none means a single OK,
 * the `cancel` button sits first and dismisses, a `destructive` one is red.
 */
export default function AlertHost() {
  const { cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  const [queue, setQueue] = useState<AlertRequest[]>([]);

  useEffect(() => setAlertListener((request) => setQueue((q) => [...q, request])), []);

  const current = queue[0];
  const close = () => setQueue((q) => q.slice(1));

  if (!current) return null;

  const buttons: AlertButton[] = current.buttons?.length
    ? current.buttons
    : [{ text: t('common.ok'), style: 'default' }];
  const cancel = buttons.find((b) => b.style === 'cancel');
  const ordered = cancel ? [cancel, ...buttons.filter((b) => b !== cancel)] : buttons;

  const press = (button: AlertButton) => {
    close();
    button.onPress?.();
  };

  return (
    <ResponsiveModal
      visible
      onClose={() => (cancel ? press(cancel) : close())}
      mobilePresentation="centered"
      dialogWidth={440}>
      <View className={`${cardBg} p-5`} accessibilityRole="alert">
        <Text className={`text-lg font-bold ${textColor}`}>{current.title}</Text>
        {current.message ? (
          <Text className={`mt-2 text-sm leading-5 ${subtextColor}`}>{current.message}</Text>
        ) : null}
        <View className="mt-5 flex-row flex-wrap justify-end" style={{ gap: 10 }}>
          {ordered.map((button, i) => {
            const isCancel = button.style === 'cancel';
            const isDestructive = button.style === 'destructive';
            return (
              <TouchableOpacity
                key={`${button.text ?? 'ok'}-${i}`}
                accessibilityRole="button"
                onPress={() => press(button)}
                activeOpacity={0.8}
                className={`min-w-[96px] items-center rounded-xl px-4 py-3 ${
                  isCancel ? `border ${borderColor}` : isDestructive ? 'bg-red-500' : 'bg-brand-500'
                }`}>
                <Text className={`font-semibold ${isCancel ? textColor : 'text-white'}`}>
                  {button.text ?? t('common.ok')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ResponsiveModal>
  );
}
