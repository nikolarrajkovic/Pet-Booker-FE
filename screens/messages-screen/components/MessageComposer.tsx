import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BRAND_GREEN, themeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { showAlert } from '../../../services/alert';

/** A picture chosen to go with the next message; uploaded when it is sent. */
export type ComposerPhoto = { uri: string; fileName?: string; mimeType?: string };

/** The most pictures one message carries (the server's ChatMessageLimits.MaxPhotos). */
const MAX_PHOTOS = 6;

export interface MessageComposerProps {
  /** Resolves when the message is accepted; the field clears optimistically before it settles. */
  onSend: (body: string, photos: ComposerPhoto[]) => Promise<void> | void;
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

/**
 * Input row pinned under the thread: a picture button, a rounded field and a circular send
 * button. Pictures were added for the "Photo updates" extra, which could be sold but not
 * delivered while chat was text only (app review 2026-11-13, finding 29).
 */
export default function MessageComposer({
  onSend,
  sending,
  isDarkMode,
  onTypingChange,
}: MessageComposerProps) {
  const { inputBg, inputText, borderColor, placeholderColor, cardBg } = themeColors(isDarkMode);
  const { t } = useLocale();
  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState<ComposerPhoto[]>([]);
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
  const canSend = (trimmed.length > 0 || photos.length > 0) && !sending;

  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('account.permissionNeededTitle'), t('account.permissionPhotoMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;
    const picked = result.assets.map((asset) => ({
      uri: asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri,
      fileName: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? undefined,
    }));
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  };

  const handleSend = async () => {
    if (!canSend) return;
    // Clear first so the field is ready for the next line while the request is in flight —
    // the screen renders the message optimistically, so nothing appears lost if it is slow.
    const toSend = photos;
    setDraft('');
    setPhotos([]);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setTyping(false);
    await onSend(trimmed, toSend);
  };

  /**
   * In a browser, Enter sends and Shift+Enter starts a new line — what every web messenger does.
   *
   * The field is multiline, and a multiline field never fires `onSubmitEditing` on Enter there:
   * Enter (and Shift+Enter) both just added a line, so a message could only be sent with the
   * mouse. Prevented here rather than stripped afterwards, so the newline never lands in the
   * draft. An IME composing a word (`isComposing`) owns Enter until it commits.
   *
   * Phones are left alone: the soft keyboard's return key adds a line, and the send button sends.
   */
  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    const key = e.nativeEvent as TextInputKeyPressEventData & {
      shiftKey?: boolean;
      isComposing?: boolean;
    };
    if (key.key !== 'Enter' || key.shiftKey || key.isComposing) return;
    e.preventDefault();
    void handleSend();
  };

  return (
    <View className={`border-t ${borderColor} ${cardBg}`}>
      {photos.length > 0 ? (
        <View className="flex-row flex-wrap px-3 pt-2" style={{ gap: 8 }}>
          {photos.map((p, i) => (
            <View key={`${p.uri.slice(-24)}-${i}`}>
              <Image source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('messages.removePhoto')}
                onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 rounded-full bg-black/70 p-0.5">
                <Ionicons name="close" size={14} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
      <View className="flex-row items-end px-3 py-2">
        <TouchableOpacity
          onPress={pickPhotos}
          disabled={sending || photos.length >= MAX_PHOTOS}
          accessibilityRole="button"
          accessibilityLabel={t('messages.addPhoto')}
          className="mr-2 h-11 w-11 items-center justify-center rounded-full">
          <Ionicons name="image-outline" size={22} color={BRAND_GREEN} />
        </TouchableOpacity>
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
          onKeyPress={handleKeyPress}
          accessibilityLabel={t('messages.composerPlaceholder')}
          accessibilityHint={Platform.OS === 'web' ? t('messages.composerKeysHint') : undefined}
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
    </View>
  );
}
