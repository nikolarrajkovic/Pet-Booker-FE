import React, { RefObject, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useResponsive } from '../../hooks/useResponsive';
import { useLocale } from '../../context/LocaleContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import AnchoredPopover, { type PopoverAnchor } from './AnchoredPopover';

export type SelectMenuOption = {
  key: string;
  label: string;
  selected?: boolean;
  onSelect: () => void;
};

type SelectMenuProps = {
  visible: boolean;
  onClose: () => void;
  /** The field it opens from (see `anchorOf`): the list opens under it on the web design. */
  anchor: PopoverAnchor | RefObject<unknown>;
  /** The phone sheet's heading. */
  title: string;
  options: SelectMenuOption[];
  minWidth?: number;
  /** Line the list up with the field's end — for a wide row whose value sits on the right. */
  align?: 'start' | 'end';
  /** Narrower than the field — for a wide row (a settings row) rather than a form field. */
  maxWidth?: number;
};

/**
 * Choosing one value from a short list: a dropdown under its field on the web design, and the
 * bottom sheet it has always been on a phone (feedback 2026-10-21: on a desktop the sheet covered
 * the whole window, see-through, to pick a service type).
 */
export default function SelectMenu({
  visible,
  onClose,
  anchor,
  title,
  options,
  minWidth,
  align,
  maxWidth,
}: SelectMenuProps) {
  const { isWebLayout } = useResponsive();
  const { isDarkMode, cardBg, textColor, borderColor } = useThemeColors();
  const { t } = useLocale();
  // The dropdown handles Esc itself (AnchoredPopover); this is the sheet's.
  useEscapeToClose(visible && !isWebLayout, onClose);
  const choose = (option: SelectMenuOption) => {
    option.onSelect();
    onClose();
  };

  if (isWebLayout) {
    return (
      <AnchoredPopover
        visible={visible}
        onClose={onClose}
        anchor={anchor}
        minWidth={minWidth}
        maxWidth={maxWidth}
        align={align}>
        <View className="py-1">
          {options.map((option) => (
            <MenuRow key={option.key} option={option} onPress={() => choose(option)} />
          ))}
        </View>
      </AnchoredPopover>
    );
  }

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        accessible={false}
        focusable={false}
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 justify-end bg-black/50">
        <TouchableOpacity activeOpacity={1} className={`${cardBg} rounded-t-3xl`}>
          <View className="p-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className={`text-xl font-bold ${textColor}`}>{title}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={onClose}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>

            {options.map((option) => (
              <TouchableOpacity
                accessibilityRole="button"
                key={option.key}
                onPress={() => choose(option)}
                className={`border-b py-4 ${borderColor}`}>
                <View className="flex-row items-center justify-between">
                  <Text className={`text-base ${textColor}`}>{option.label}</Text>
                  {option.selected && <Ionicons name="checkmark" size={24} color={BRAND_GREEN} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/** One row of the desktop list, highlighted under the pointer as a select's options are. */
function MenuRow({ option, onPress }: { option: SelectMenuOption; onPress: () => void }) {
  const { isDarkMode, textColor } = useThemeColors();
  const [hovered, setHovered] = useState(false);
  const tint = isDarkMode ? 'bg-[#243447]' : 'bg-brand-50';
  return (
    <Pressable
      accessibilityRole="menuitem"
      aria-selected={!!option.selected}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className={`flex-row items-center justify-between px-4 py-2.5 ${
        hovered || option.selected ? tint : ''
      }`}>
      <Text
        className={`flex-1 text-sm ${option.selected ? 'font-semibold text-brand-600' : textColor}`}
        numberOfLines={1}>
        {option.label}
      </Text>
      {option.selected ? <Ionicons name="checkmark" size={16} color={BRAND_GREEN} /> : null}
    </Pressable>
  );
}
