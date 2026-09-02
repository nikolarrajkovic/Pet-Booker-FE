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
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

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
 * The API's minimum length for a review comment — `POST /api/reviews` rejects anything
 * shorter (422 "The explanation must be at least 10 characters long."), and rejects an
 * empty/absent one outright ("An explanation of your experience is required.").
 *
 * The modal used to present the comment as optional, so a star-only review — the most
 * natural way to use it — was submitted and bounced with a validation message the user had
 * no field to act on. Enforcing it here turns that into a disabled button and a hint.
 */
const MIN_COMMENT_LENGTH = 10;

/**
 * Centered modal for rating a completed service: 1–5 stars + a required comment
 * (see MIN_COMMENT_LENGTH). Presentational — the parent owns the API call (passes
 * `submitting`) and decides what booking/provider the review belongs to. Reusable from any
 * "leave a review" entry point (notifications, booking details, etc.).
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

  const trimmedComment = comment.trim();
  const commentTooShort = trimmedComment.length < MIN_COMMENT_LENGTH;
  // Only nag once they've started typing — an untouched field showing an error reads as a failure.
  const showCommentHint = trimmedComment.length > 0 && commentTooShort;
  const canSubmit = rating > 0 && !commentTooShort && !submitting;

  // Esc dismisses, except while the review is being submitted — the same guard the backdrop
  // and the X already use.
  useEscapeToClose(visible && !submitting, onClose);

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
              // Without a cap this card is the window minus 48px — a 1392px-wide box asking for
              // a star rating on a desktop. The other pickers already cap at 400.
              width: '100%',
              maxWidth: 480,
              alignSelf: 'center',
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
                <Ionicons name="checkmark-done" size={32} color={BRAND_GREEN} />
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
                borderColor: showCommentHint ? '#EF4444' : hex.border,
                backgroundColor: hex.inputBg,
                color: hex.text,
                padding: 12,
                fontSize: 14,
              }}
            />
            {showCommentHint ? (
              <Text style={{ color: '#EF4444' }} className="mt-1.5 text-xs">
                {t('reviewModal.commentTooShort', { min: MIN_COMMENT_LENGTH })}
              </Text>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              onPress={() => canSubmit && onSubmit(rating, trimmedComment)}
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
