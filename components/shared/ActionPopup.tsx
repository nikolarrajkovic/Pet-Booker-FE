import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';

export type ActionPopupMode = 'confirmation' | 'warning' | 'error';

interface ActionPopupProps {
  visible: boolean;
  mode: ActionPopupMode;
  text: string;
  buttonText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const actionButtonColor: Record<ActionPopupMode, string> = {
  confirmation: 'bg-brand-500',
  warning: 'bg-orange-500',
  error: 'bg-red-500',
};

const actionTextColor: Record<ActionPopupMode, string> = {
  confirmation: 'text-white',
  warning: 'text-white',
  error: 'text-white',
};

export default function ActionPopup({
  visible,
  mode,
  text,
  buttonText,
  onConfirm,
  onCancel,
}: ActionPopupProps) {
  const { isDarkMode, cardBg, textColor } = useThemeColors();

  // Freeze displayed content while the modal is fading out so text/buttons
  // don't change mid-animation when the parent clears its state on cancel.
  const [frozenText, setFrozenText] = useState(text);
  const [frozenButtonText, setFrozenButtonText] = useState(buttonText);
  const [frozenMode, setFrozenMode] = useState(mode);

  useEffect(() => {
    if (visible) {
      setFrozenText(text);
      setFrozenButtonText(buttonText);
      setFrozenMode(mode);
    }
  }, [visible, text, buttonText, mode]);

  const overlayBg = isDarkMode ? 'bg-black/70' : 'bg-black/50';
  const cancelBg = isDarkMode ? 'bg-[#243447]' : 'bg-gray-100';
  const cancelText = isDarkMode ? 'text-gray-300' : 'text-gray-700';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View className={`flex-1 items-center justify-center ${overlayBg}`}>
          <TouchableWithoutFeedback>
            <View className={`${cardBg} rounded-2xl mx-8 p-6 w-80`}>
              <Text className={`text-base ${textColor} text-center leading-6 mb-6`}>
                {frozenText}
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={onCancel}
                  className={`flex-1 py-3 rounded-xl items-center justify-center ${cancelBg}`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-semibold text-sm ${cancelText}`}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onConfirm}
                  className={`flex-1 py-3 rounded-xl items-center justify-center ${actionButtonColor[frozenMode]}`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-semibold text-sm ${actionTextColor[frozenMode]}`}>
                    {frozenButtonText}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
