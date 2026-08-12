import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';

export interface MessageComposerProps {
  /** Resolves when the message is accepted; the field clears optimistically before it settles. */
  onSend: (body: string) => Promise<void> | void;
  sending?: boolean;
  isDarkMode: boolean;
  /**
   * Typing indicator. Called with `true` on the first keystroke of a burst and `false` once the
   * user pauses — not per character, which would put a hub round trip behind every letter.
   */
  onTypingChange?: (isTyping: boolean) => void;
}

/** How long a pause counts as "stopped typing". */
const TYPING_IDLE_MS = 2500;

/** Input row pinned under the thread: a rounded field and a circular send button. */
export default function MessageComposer({
  onSend,
  sending,
  isDarkMode,
  onTypingChange,
}: MessageComposerProps) {
  const { inputBg, inputText, borderColor, placeholderColor, cardBg } = themeColors(isDarkMode);
  const { t } = useLocale();
  const [draft, setDraft] = useState('');
  const typingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTyping = (value: boolean) => {
    if (typingRef.current === value) return; // only edges cross the wire
    typingRef.current = value;
    onTypingChange?.(value);
  };

  const handleChange = (text: string) => {
    setDraft(text);
    if (!onTypingChange) return;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (text.trim().length === 0) {
      setTyping(false);
      return;
    }
    setTyping(true);
    idleTimerRef.current = setTimeout(() => setTyping(false), TYPING_IDLE_MS);
  };

  // Leaving the screen mid-sentence must not strand the other side on "typing…".
  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (typingRef.current) onTypingChange?.(false);
    },
    [onTypingChange]
  );

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    // Clear first so the field is ready for the next line while the request is in flight —
    // the screen renders the message optimistically, so nothing appears lost if it is slow.
    setDraft('');
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setTyping(false);
    await onSend(trimmed);
  };

  return (
    <View className={`flex-row items-end border-t px-3 py-2 ${borderColor} ${cardBg}`}>
      <TextInput
        value={draft}
        onChangeText={handleChange}
        placeholder={t('messages.composerPlaceholder')}
        placeholderTextColor={placeholderColor}
        multiline
        // Grows with the message but stops before it swallows the thread.
        style={{ maxHeight: 120 }}
        className={`mr-2 flex-1 rounded-2xl px-4 py-2.5 text-[15px] ${inputBg} ${inputText}`}
        onSubmitEditing={handleSend}
        accessibilityLabel={t('messages.composerPlaceholder')}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('messages.send')}
        accessibilityState={{ disabled: !canSend }}
        className={`h-11 w-11 items-center justify-center rounded-full ${
          canSend ? 'bg-brand-500' : isDarkMode ? 'bg-[#243447]' : 'bg-gray-200'
        }`}>
        {sending ? (
          <ActivityIndicator size="small" color={canSend ? 'white' : BRAND_GREEN} />
        ) : (
          <Ionicons name="send" size={18} color={canSend ? 'white' : placeholderColor} />
        )}
      </TouchableOpacity>
    </View>
  );
}
