import React, { useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeColors } from '../../../hooks/useThemeColors';
import Button from '../../../components/shared/Button';
import { confirmEmail, resendConfirmation } from '../../../services/auth';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type VerifyEmailRouteProp = RouteProp<RootStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 6;

export default function VerifyEmailScreen() {
  const { isDarkMode, textColor, subtextColor } = useThemeColors();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerifyEmailRouteProp>();
  const email = route.params?.email ?? '';

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const borderColor = isDarkMode ? '#374151' : '#E5E7EB';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-emerald-50';
  const cardBorder = isDarkMode ? 'border-gray-700' : 'border-emerald-100';
  const tipBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-amber-50';
  const tipBorder = isDarkMode ? 'border-gray-700' : 'border-amber-100';
  const tipText = isDarkMode ? 'text-amber-400' : 'text-amber-700';

  const isFilled = code.every((d) => d.length === 1);

  const focusBox = (i: number) =>
    inputRefs.current[Math.max(0, Math.min(i, CODE_LENGTH - 1))]?.focus();

  const setBox = (index: number, char: string) =>
    setCode((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });

  // Spread a run of digits across the boxes starting at `startIndex` — used by
  // both paste and multi-digit autofill so all six boxes fill from one action.
  const distribute = (startIndex: number, digits: string) => {
    setCode((prev) => {
      const next = [...prev];
      let i = startIndex;
      for (const d of digits) {
        if (i >= CODE_LENGTH) break;
        next[i] = d;
        i += 1;
      }
      return next;
    });
    setVerifyError('');
    focusBox(startIndex + digits.length); // next empty box (capped to the last)
  };

  const handleChange = (text: string, index: number) => {
    setVerifyError('');
    const digits = text.replace(/[^0-9]/g, '');
    const hadValue = (code[index] ?? '') !== '';

    if (digits.length === 0) {
      setBox(index, '');
      return;
    }

    // Treat several digits arriving at once as a paste/autofill and spread them.
    // A 2-char value in an ALREADY-filled box is just the user retyping that box
    // (cursor sat after the digit), so keep only the new digit — don't spill.
    const isPaste = digits.length > 2 || (digits.length === 2 && !hadValue);
    if (isPaste) {
      distribute(index, digits);
      return;
    }

    setBox(index, digits.slice(-1));
    if (index < CODE_LENGTH - 1) focusBox(index + 1);
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) focusBox(index - 1);
  };

  // Web: a code pasted into one box only fills that box by default — intercept
  // the paste, read the clipboard, and distribute across all boxes instead.
  const handleWebPaste = (e: any, index: number) => {
    const digits: string = (e?.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '');
    if (!digits) return;
    e.preventDefault();
    distribute(index, digits);
  };

  const handleVerify = async () => {
    if (!isFilled) return;
    const fullCode = code.join('');

    try {
      setIsSubmitting(true);
      setVerifyError('');
      await confirmEmail(email, fullCode);
      // Terminal step — reset so back can't return to the verify screen.
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed. Please try again.';
      setVerifyError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setCode(Array(CODE_LENGTH).fill(''));
    setVerifyError('');
    setResendMessage('');
    inputRefs.current[0]?.focus();
    try {
      await resendConfirmation(email);
      setResendMessage('A new code has been sent to your email.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend code. Please try again.';
      setVerifyError(message);
    }
  };

  return (
    <SafeAreaView className={`flex-1 ${contentBg}`}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Green Header */}
        <View className={`${bgColor} px-6 pt-16 pb-12 items-center rounded-b-3xl`}>
          <View className="w-20 h-20 bg-white rounded-2xl items-center justify-center mb-4 shadow-lg">
            <MaterialCommunityIcons name="paw" size={40} color="#00A85A" />
          </View>
          <Text className="text-white text-2xl font-bold">Verify Your Email</Text>
          <Text className="text-brand-100 mt-1">We&apos;ve sent a 6-digit code to</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Email card */}
          <View className={`flex-row items-center ${cardBg} border ${cardBorder} rounded-2xl px-4 py-4 mb-8`}>
            <View className="w-9 h-9 rounded-full bg-emerald-100 items-center justify-center mr-3">
              <MaterialCommunityIcons name="email-outline" size={20} color="#00A85A" />
            </View>
            <View>
              <Text className={`text-xs ${subtextColor}`}>Code sent to</Text>
              <Text className={`text-sm font-semibold ${textColor}`}>{email}</Text>
            </View>
          </View>

          {/* Code label */}
          <Text className={`text-sm font-semibold ${textColor} mb-3`}>Enter verification code</Text>

          {/* OTP boxes — each is individually editable (tap to change), and a
              code pasted into any box fills all six (web: handleWebPaste; native:
              the multi-digit paste comes through onChangeText → distribute). */}
          <View className="flex-row justify-between mb-8">
            {Array.from({ length: CODE_LENGTH }).map((_, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                value={code[index]}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                // Wide enough that a pasted code reaches handleChange intact on
                // native (maxLength 1 would truncate it to a single digit); the
                // controlled value keeps each box showing one character.
                maxLength={CODE_LENGTH}
                selectTextOnFocus
                textContentType="oneTimeCode"
                {...(Platform.OS === 'web'
                  ? ({ onPaste: (e: any) => handleWebPaste(e, index) } as object)
                  : {})}
                style={{
                  width: 44,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: code[index] ? '#00A85A' : borderColor,
                  backgroundColor: isDarkMode ? '#243447' : '#ffffff',
                  color: isDarkMode ? '#ffffff' : '#111827',
                  fontSize: 22,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              />
            ))}
          </View>

          {/* Verify button */}
          <Button
            text={isSubmitting ? 'Verifying...' : 'Verify Email'}
            onPress={handleVerify}
            variant="primary"
            className="py-4 rounded-2xl mb-4"
            disabled={isSubmitting || !isFilled}
          />

          {verifyError ? (
            <Text className="text-red-500 text-sm mb-4 text-center">{verifyError}</Text>
          ) : null}

          {resendMessage ? (
            <Text className="text-brand-600 text-sm mb-4 text-center">{resendMessage}</Text>
          ) : null}

          {/* Resend link */}
          <View className="flex-row justify-center mb-6">
            <Text className={`text-sm ${subtextColor}`}>Didn&apos;t receive the code? </Text>
            <TouchableOpacity onPress={handleResend}>
              <Text className="text-brand-600 font-semibold text-sm">Resend Code</Text>
            </TouchableOpacity>
          </View>

          {/* Tip banner */}
          <View className={`flex-row items-start ${tipBg} border ${tipBorder} rounded-2xl px-4 py-3`}>
            <Text className="mr-2 text-sm">💡</Text>
            <Text className={`text-xs flex-1 leading-5 ${tipText}`}>
              <Text className="font-semibold">Tip: </Text>
              Check your spam folder if you don&apos;t see the email. The code expires in 10 minutes.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
