import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';

type ReviewModalProps = {
  visible: boolean;
  /** Service (or provider) name shown in the prompt, e.g. "How was Dog Walking?". */
  serviceName?: string;
  /** True while the parent persists the review — disables inputs + shows a spinner. */
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
};

// Translation keys per star value, resolved with t() at render.
const RATING_LABEL_KEYS = [
  '',
  'reviewModal.ratingPoor',
  'reviewModal.ratingFair',
  'reviewModal.ratingGood',
  'reviewModal.ratingGreat',
  'reviewModal.ratingExcellent',
];

/**
 * Centered modal for rating a completed service: 1–5 stars + an optional comment.
 * Presentational — the parent owns the API call (passes `submitting`) and decides
 * what booking/provider the review belongs to. Reusable from any "leave a review"
 * entry point (notifications, booking details, etc.).
 */
export default function ReviewModal({
  visible,
  serviceName,
  submitting = false,
  onClose,
  onSubmit,
}: ReviewModalProps) {
  const { isDarkMode, hex, placeholderColor } = useThemeColors();
  const { t } = useLocale();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // Reset the form each time the modal is (re)opened.
  useEffect(() => {
    if (visible) {
      setRating(0);
      setComment('');
    }
  }, [visible]);

  const canSubmit = rating > 0 && !submitting;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Dim backdrop — tap to dismiss (unless mid-submit) */}
        <Pressable
          onPress={submitting ? undefined : onClose}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}>
          {/* Stop backdrop taps from closing when they land on the card */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: hex.card,
              borderRadius: 24,
              padding: 24,
            }}>
            {/* Close button */}
            <TouchableOpacity
              onPress={submitting ? undefined : onClose}
              disabled={submitting}
              style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, padding: 4 }}>
              <Ionicons name="close" size={22} color={hex.subtext} />
            </TouchableOpacity>

            {/* Header icon */}
            <View className="items-center">
              <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <Ionicons name="checkmark-done" size={32} color="#00C870" />
              </View>
              <Text style={{ color: hex.text }} className="text-xl font-bold">
                {t('reviewModal.rateYourExperience')}
              </Text>
              <Text style={{ color: hex.subtext }} className="mt-1 text-center text-sm">
                {serviceName
                  ? t('reviewModal.howWas', { name: serviceName })
                  : t('reviewModal.howWasYourService')}
              </Text>
            </View>

            {/* Stars */}
            <View className="mt-5 flex-row items-center justify-center">
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => !submitting && setRating(value)}
                  activeOpacity={0.7}
                  style={{ paddingHorizontal: 6 }}>
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={38}
                    color={value <= rating ? '#F59E0B' : isDarkMode ? '#4B5563' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text
              style={{ color: rating > 0 ? '#F59E0B' : hex.subtext }}
              className="mt-2 text-center text-sm font-semibold">
              {rating > 0 ? t(RATING_LABEL_KEYS[rating] as any) : t('reviewModal.tapToRate')}
            </Text>

            {/* Comment */}
            <TextInput
              value={comment}
              onChangeText={setComment}
              editable={!submitting}
              placeholder={t('reviewModal.commentPlaceholder')}
              placeholderTextColor={placeholderColor}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{
                marginTop: 18,
                minHeight: 96,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: hex.border,
                backgroundColor: hex.inputBg,
                color: hex.text,
                padding: 12,
                fontSize: 14,
              }}
            />

            {/* Submit */}
            <TouchableOpacity
              onPress={() => canSubmit && onSubmit(rating, comment)}
              disabled={!canSubmit}
              activeOpacity={0.85}
              className="mt-5 flex-row items-center justify-center rounded-2xl bg-brand-500 py-4"
              style={{ opacity: canSubmit ? 1 : 0.5 }}>
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-bold text-white">
                  {t('reviewModal.submitReview')}
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
