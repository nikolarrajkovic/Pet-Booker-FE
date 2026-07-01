import React, { useState } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useThemeColors } from '../../../hooks/useThemeColors';
import Button from '../../../components/shared/Button';
import DatePicker from '../../../components/shared/DatePicker';
import PhoneInput from '../../../components/shared/PhoneInput';
import { registerUser } from '../../../services/auth';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Validators ───────────────────────────────────────────────────────────────
function validateUsername(v: string) {
  if (!v.trim()) return 'Username is required';
  if (!/^[A-Za-z][A-Za-z0-9.]{2,19}$/.test(v.trim()))
    return 'Username must start with a letter and contain only valid characters';
  return '';
}

function validateEmail(v: string) {
  if (!v.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
    return 'Enter a valid email address';
  return '';
}

function validateName(v: string) {
  if (!v.trim()) return 'This field is required';
  if (!/^[A-Za-zČĆŽŠĐčćžšđ-]{2,50}$/.test(v.trim()))
    return 'Name can only contain letters';
  return '';
}

function validatePhone(v: string) {
  if (!v.trim()) return 'Phone number is required';
  // Country-agnostic: a "+" dial code followed by 6–14 national digits
  // (spaces allowed). The dial code + flag come from the PhoneInput picker.
  const digits = v.replace(/[^\d]/g, '');
  if (!v.trim().startsWith('+') || digits.length < 8 || digits.length > 15)
    return 'Enter a valid phone number';
  return '';
}

function validatePassword(v: string) {
  if (!v) return 'Password is required';
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(v))
    return 'Password does not meet the requirements below';
  return '';
}

function validateConfirmPassword(v: string, pw: string) {
  if (!v) return 'Please confirm your password';
  if (v !== pw) return 'Passwords do not match';
  return '';
}

function validateDateOfBirth(d: Date | null) {
  if (!d) return 'Date of birth is required';
  const today = new Date();
  const age = today.getFullYear() - d.getFullYear() -
    (today < new Date(today.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  if (age < 13) return 'You must be at least 13 years old';
  if (age > 120) return 'Enter a valid date of birth';
  return '';
}

// ─── Password strength ────────────────────────────────────────────────────────
function getPasswordStrength(pwd: string) {
  if (!pwd) return null;
  const score = [
    /[a-z]/.test(pwd),
    /[A-Z]/.test(pwd),
    /\d/.test(pwd),
    /[^A-Za-z0-9]/.test(pwd),
    pwd.length >= 8,
  ].filter(Boolean).length;
  if (score <= 2) return { label: 'Weak', color: '#EF4444', flex: 1 / 3 };
  if (score <= 3) return { label: 'Medium', color: '#F59E0B', flex: 2 / 3 };
  return { label: 'Strong', color: '#00A85A', flex: 1 };
}

export default function RegisterScreen() {
  const { isDarkMode, textColor, subtextColor } = useThemeColors();
  const navigation = useNavigation<NavigationProp>();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+381');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ─── Theme ────────────────────────────────────────────────────────────────
  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50';
  const inputBg = isDarkMode ? '#243447' : '#ffffff';
  const inputTextColor = isDarkMode ? '#ffffff' : '#111827';
  const defaultBorder = isDarkMode ? '#374151' : '#E5E7EB';
  const placeholderColor = '#9CA3AF';

  // ─── Computed errors ──────────────────────────────────────────────────────
  const errors = {
    username: validateUsername(username),
    email: validateEmail(email),
    firstName: validateName(firstName),
    lastName: validateName(lastName),
    phone: validatePhone(phone),
    dateOfBirth: validateDateOfBirth(dateOfBirth),
    password: validatePassword(password),
    confirmPassword: validateConfirmPassword(confirmPassword, password),
  };

  const isFormValid = Object.values(errors).every((e) => e === '');

  const borderFor = (field: keyof typeof errors) => {
    if (!touched[field]) return defaultBorder;
    return errors[field] ? '#EF4444' : '#00A85A';
  };

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    setTouched({
      username: true, email: true, firstName: true,
      lastName: true, phone: true, dateOfBirth: true, password: true, confirmPassword: true,
    });
    if (!isFormValid) return;

    try {
      setIsSubmitting(true);
      setSubmitError('');
      await registerUser({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userName: username.trim(),
        phone: phone.trim(),
        dateOfBirth: dateOfBirth!.toISOString(),
      });
      navigation.navigate('VerifyEmail', { email: email.trim() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const strength = getPasswordStrength(password);

  const inputStyle = (field: keyof typeof errors) => ({
    backgroundColor: inputBg,
    color: inputTextColor,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: borderFor(field),
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  });

  return (
    <SafeAreaView className={`flex-1 ${contentBg}`}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        {/* Green Header */}
        <View className={`${bgColor} px-6 pt-16 pb-12 items-center rounded-b-3xl`}>
          <View className="w-20 h-20 bg-white rounded-2xl items-center justify-center mb-4 shadow-lg">
            <MaterialCommunityIcons name="paw" size={40} color="#00A85A" />
          </View>
          <Text className="text-white text-2xl font-bold">Pet Booker</Text>
          <Text className="text-brand-100 mt-1">Create your account</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Username */}
          <View className="mb-4">
            <View className="flex-row items-center mb-1">
              <Text className={`text-sm font-semibold ${textColor}`}>Username</Text>
              <Text className="text-red-500 ml-1 text-sm font-semibold">*</Text>
            </View>
            <Text className={`text-xs ${subtextColor} mb-2`}>
              3–20 characters, starts with letter, only letters/numbers/.
            </Text>
            <TextInput
              value={username}
              onChangeText={(t) => { setUsername(t); touch('username'); }}
              onBlur={() => touch('username')}
              placeholder="Choose a username"
              autoCapitalize="none"
              style={inputStyle('username')}
              placeholderTextColor={placeholderColor}
            />
            {touched.username && errors.username ? (
              <Text className="text-red-500 text-xs mt-1">{errors.username}</Text>
            ) : null}
          </View>

          {/* Email */}
          <View className="mb-4">
            <View className="flex-row items-center mb-2">
              <Text className={`text-sm font-semibold ${textColor}`}>Email Address</Text>
              <Text className="text-red-500 ml-1 text-sm font-semibold">*</Text>
            </View>
            <TextInput
              value={email}
              onChangeText={(t) => { setEmail(t); touch('email'); }}
              onBlur={() => touch('email')}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={inputStyle('email')}
              placeholderTextColor={placeholderColor}
            />
            {touched.email && errors.email ? (
              <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>
            ) : null}
          </View>

          {/* First Name + Last Name */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <View className="flex-row items-center mb-2">
                <Text className={`text-sm font-semibold ${textColor}`}>First Name</Text>
                <Text className="text-red-500 ml-1 text-sm font-semibold">*</Text>
              </View>
              <TextInput
                value={firstName}
                onChangeText={(t) => { setFirstName(t); touch('firstName'); }}
                onBlur={() => touch('firstName')}
                placeholder="First name"
                style={inputStyle('firstName')}
                placeholderTextColor={placeholderColor}
              />
              {touched.firstName && errors.firstName ? (
                <Text className="text-red-500 text-xs mt-1">{errors.firstName}</Text>
              ) : null}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center mb-2">
                <Text className={`text-sm font-semibold ${textColor}`}>Last Name</Text>
                <Text className="text-red-500 ml-1 text-sm font-semibold">*</Text>
              </View>
              <TextInput
                value={lastName}
                onChangeText={(t) => { setLastName(t); touch('lastName'); }}
                onBlur={() => touch('lastName')}
                placeholder="Last name"
                style={inputStyle('lastName')}
                placeholderTextColor={placeholderColor}
              />
              {touched.lastName && errors.lastName ? (
                <Text className="text-red-500 text-xs mt-1">{errors.lastName}</Text>
              ) : null}
            </View>
          </View>

          {/* Phone Number */}
          <View className="mb-4">
            <View className="flex-row items-center mb-2">
              <Text className={`text-sm font-semibold ${textColor}`}>Phone Number</Text>
              <Text className="text-red-500 ml-1 text-sm font-semibold">*</Text>
            </View>
            <PhoneInput
              value={phone}
              onChangeText={(t) => { setPhone(t); touch('phone'); }}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
              inputBg={inputBg === '#ffffff' ? 'bg-white' : 'bg-[#243447]'}
              inputText={textColor}
              borderColor={isDarkMode ? 'border-gray-700' : 'border-gray-200'}
              placeholderColor={placeholderColor}
              cardBg={isDarkMode ? 'bg-[#1a2332]' : 'bg-white'}
            />
            {touched.phone && errors.phone ? (
              <Text className="text-red-500 text-xs mt-1">{errors.phone}</Text>
            ) : null}
          </View>

          {/* Date of Birth */}
          <View className="mb-4">
            <View className="flex-row items-center mb-2">
              <Text className={`text-sm font-semibold ${textColor}`}>Date of Birth</Text>
              <Text className="text-red-500 ml-1 text-sm font-semibold">*</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setShowDobPicker(v => !v); touch('dateOfBirth'); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: inputBg,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: touched.dateOfBirth
                  ? errors.dateOfBirth ? '#EF4444' : '#00A85A'
                  : defaultBorder,
                paddingHorizontal: 16,
                paddingVertical: 13,
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              <Text style={{ marginLeft: 10, fontSize: 15, color: dateOfBirth ? inputTextColor : placeholderColor, flex: 1 }}>
                {dateOfBirth
                  ? dateOfBirth.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                  : 'Select your date of birth'}
              </Text>
              <Ionicons name={showDobPicker ? 'chevron-up' : 'chevron-down'} size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
            {touched.dateOfBirth && errors.dateOfBirth ? (
              <Text className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</Text>
            ) : null}
            {showDobPicker && (
              <DatePicker
                value={dateOfBirth ?? new Date(2000, 0, 1)}
                maxDate={new Date()}
                isDarkMode={isDarkMode}
                onChange={(date) => {
                  setDateOfBirth(date);
                  touch('dateOfBirth');
                  setShowDobPicker(false);
                }}
                onClose={() => setShowDobPicker(false)}
              />
            )}
          </View>

          {/* Password */}
          <View className="mb-2">
            <View className="flex-row items-center mb-2">
              <Text className={`text-sm font-semibold ${textColor}`}>Password</Text>
              <Text className="text-red-500 ml-1 text-sm font-semibold">*</Text>
            </View>
            <View>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  touch('password');
                  if (touched.confirmPassword) touch('confirmPassword');
                }}
                onBlur={() => touch('password')}
                placeholder="Create a password"
                secureTextEntry={!showPassword}
                style={{ ...inputStyle('password'), paddingRight: 48 }}
                placeholderTextColor={placeholderColor}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 16, top: 13 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>

            {/* Strength bar */}
            {password.length > 0 && strength && (
              <View style={{ marginTop: 8, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', height: 4, backgroundColor: isDarkMode ? '#374151' : '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ flex: strength.flex, backgroundColor: strength.color, borderRadius: 4 }} />
                </View>
                <Text style={{ fontSize: 11, color: strength.color, marginTop: 3, fontWeight: '600' }}>
                  {strength.label}
                </Text>
              </View>
            )}

            {/* Requirements checklist */}
            {(touched.password || password.length > 0) && (
              <View style={{ marginTop: 4, marginBottom: 8 }}>
                {[
                  { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
                  { label: 'Lowercase letter', ok: /[a-z]/.test(password) },
                  { label: 'Number', ok: /\d/.test(password) },
                  { label: 'Special character', ok: /[^A-Za-z0-9]/.test(password) },
                  { label: 'At least 8 characters', ok: password.length >= 8 },
                ].map((item) => (
                  <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <Ionicons
                      name={item.ok ? 'checkmark-circle' : 'ellipse-outline'}
                      size={13}
                      color={item.ok ? '#00A85A' : '#9CA3AF'}
                    />
                    <Text style={{ fontSize: 11, color: item.ok ? '#00A85A' : '#9CA3AF', marginLeft: 5 }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Confirm Password */}
          <View className="mb-6">
            <View className="flex-row items-center mb-2">
              <Text className={`text-sm font-semibold ${textColor}`}>Confirm Password</Text>
              <Text className="text-red-500 ml-1 text-sm font-semibold">*</Text>
            </View>
            <View>
              <TextInput
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); touch('confirmPassword'); }}
                onBlur={() => touch('confirmPassword')}
                placeholder="Re-enter your password"
                secureTextEntry={!showConfirmPassword}
                style={{ ...inputStyle('confirmPassword'), paddingRight: 48 }}
                placeholderTextColor={placeholderColor}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ position: 'absolute', right: 16, top: 13 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>
            {touched.confirmPassword && errors.confirmPassword ? (
              <Text className="text-red-500 text-xs mt-1">{errors.confirmPassword}</Text>
            ) : null}
          </View>

          {/* Create Account Button */}
          <Button
            text={isSubmitting ? 'Creating Account...' : 'Create Account'}
            onPress={handleRegister}
            variant="primary"
            className="py-4 rounded-2xl mb-4"
            disabled={isSubmitting}
          />

          {submitError ? (
            <Text className="text-red-500 text-sm mb-4 text-center">{submitError}</Text>
          ) : null}

          {/* Terms */}
          <Text className={`text-xs text-center ${subtextColor} mb-6 leading-5`}>
            By creating an account, you agree to our{' '}
            <Text className="text-brand-600 font-semibold">Terms of Service</Text>
            {' '}and{' '}
            <Text className="text-brand-600 font-semibold">Privacy Policy</Text>
          </Text>

          {/* Sign In Link */}
          <View className="flex-row justify-center">
            <Text className={`text-sm ${subtextColor}`}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text className="text-brand-600 font-semibold text-sm">Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
