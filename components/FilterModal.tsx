import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StatusBar,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '../context/LocaleContext';
import { useResponsive } from '../hooks/useResponsive';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import SearchFilters, { EMPTY_FILTERS, type FilterState } from './shared/SearchFilters';

// FilterState moved to components/shared/SearchFilters, where the controls themselves now live —
// the web design shows them in a sticky rail rather than a sheet. Re-exported so the existing
// import path keeps working.
export type { FilterState };

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterState) => void;
  currentFilters: FilterState;
  /** Upper bound for the price slider — derived from the loaded services. */
  maxPrice: number;
  /**
   * Distinct extra names offered across the loaded services. Extras are provider-named free text
   * now, so there is no fixed catalog to render as chips — the options come from the data.
   */
  availableAddOns?: string[];
}

/**
 * The phone's filter surface: a full-screen sheet with a draft and an Apply button.
 *
 * It holds a **draft** rather than applying as you go, because on a phone the filters cover the
 * results completely — applying each toggle immediately would re-run the search several times
 * against a list nobody can see. The web design has the opposite problem (a rail beside the
 * results, where an Apply button is a pointless second step), so it renders `SearchFilters`
 * directly and applies on change.
 */
export default function FilterModal({
  visible,
  onClose,
  onApplyFilters,
  currentFilters,
  maxPrice,
  availableAddOns = [],
}: FilterModalProps) {
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();

  const [draft, setDraft] = useState<FilterState>(currentFilters);

  // Re-sync when the applied filters change underneath (a route param pinning a service type,
  // or a Clear from the results header).
  useEffect(() => {
    setDraft(currentFilters);
  }, [currentFilters]);

  const handleReset = () => {
    setDraft({ ...EMPTY_FILTERS, priceRange: [0, maxPrice] });
  };

  const handleApply = () => {
    onApplyFilters(draft);
    onClose();
  };

  useEscapeToClose(visible, onClose);

  return (
    <Modal
      visible={visible}
      // A sheet slides up from the bottom edge on a phone; on a desktop the dialog just appears.
      animationType={isWebLayout ? 'fade' : 'slide'}
      transparent={true}
      onRequestClose={onClose}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {/*
        A bottom sheet is a phone form factor: it comes up from the thumb, covers the screen and
        is dismissed by dragging down. Rendered unmodified in a browser it is a full-height panel
        pinned to the bottom of a 1440px window with a 16px strip of page visible above it. On the
        web design the same content becomes a centred dialog with a scrim.
      */}
      <Pressable
        accessible={false}
        focusable={false}
        tabIndex={-1}
        onPress={isWebLayout ? onClose : undefined}
        className={isWebLayout ? 'flex-1 items-center justify-center' : 'flex-1 justify-end'}
        style={{
          backgroundColor: isWebLayout ? 'rgba(0,0,0,0.5)' : isDarkMode ? '#0f1621' : '#ffffff',
          padding: isWebLayout ? 24 : 0,
        }}>
        {!isWebLayout && <View className="absolute inset-0 bg-black/50" />}
        <Pressable
          accessibilityRole="button"
          onPress={
            isWebLayout ? (e: { stopPropagation: () => void }) => e.stopPropagation() : undefined
          }
          className={`${bgColor} ${isWebLayout ? 'overflow-hidden rounded-2xl' : 'mt-16 flex-1'}`}
          style={isWebLayout ? { width: '100%', maxWidth: 560, maxHeight: '85%' } : { flex: 1 }}>
          {/* Header */}
          <View
            className={`flex-row items-center justify-between border-b px-6 py-4 ${borderColor}`}>
            <Text className={`text-xl font-bold ${textColor}`}>{t('shared.filters')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              className="h-8 w-8 items-center justify-center">
              <Ionicons name="close" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 py-4">
            <SearchFilters
              value={draft}
              onChange={setDraft}
              maxPrice={maxPrice}
              availableAddOns={availableAddOns}
            />
            <View className="h-24" />
          </ScrollView>

          {/* Footer Buttons */}
          <View
            className={`flex-row gap-3 border-t px-6 ${borderColor} ${bgColor}`}
            style={{ paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleReset}
              className={`flex-1 rounded-xl border py-3 ${borderColor} ${cardBg} items-center`}>
              <Text className={`${subtextColor} font-semibold`}>{t('shared.reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleApply}
              className="flex-1 items-center rounded-xl bg-brand-500 py-3">
              <Text className="font-semibold text-white">{t('shared.applyFilters')}</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom safe-area background — fills the home-indicator strip under the sheet.
              There is no such strip under a centred dialog, where it would paint a 100px block
              hanging off the bottom edge. */}
          {!isWebLayout && (
            <View
              style={{
                position: 'absolute',
                bottom: -100,
                left: 0,
                right: 0,
                height: 100,
                backgroundColor: isDarkMode ? '#0f1621' : '#ffffff',
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
