import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useLocale } from '../../../context/LocaleContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import LanguagePicker from '../../../components/shared/LanguagePicker';
import CurrencyPicker from '../../../components/shared/CurrencyPicker';
import { LANGUAGES } from '../../../i18n';
import { getErrorMessage } from '../../../services/http';
import {
  asSupportedCurrency,
  registerDisplayCurrency,
  type SupportedCurrency,
} from '../../../services/currency';
import {
  getNotificationSettings,
  saveNotificationSettings,
  defaultNotificationSettings,
  type UserNotificationSettingsDto,
} from '../../../services/notifications';
import { usePageGutter } from '../../../hooks/usePageGutter';
import DeleteAccountModal from '../components/DeleteAccountModal';
import { deleteAccount } from '../../../services/auth';

export default function SettingsScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation();
  const { toggleDarkMode } = useTheme();
  const { t, language, setLanguage } = useLocale();
  const { currentUser, refreshUser, isAdmin, isProviderProfile, signOut } = useAuth();
  const { showError, showSuccess } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Admins are closed by another admin, and a managed partner profile by PetBooker — the server
  // refuses both, so the option is not offered to them.
  const canDeleteAccount = !!currentUser && !isAdmin && !isProviderProfile;
  const canPay = !!currentUser && !isProviderProfile;

  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(password);
      setDeleteOpen(false);
      showSuccess(t('settings.deleteAccountDone'));
      await signOut();
    } catch (e) {
      setDeleteError(getErrorMessage(e, t('settings.deleteAccountFailed')));
    } finally {
      setIsDeleting(false);
    }
  };
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor } = useThemeColors();
  // Row dividers inside a card. A fixed gray-100 drew bright white lines across the dark cards.
  const divider = isDarkMode ? 'border-b border-[#243447]' : 'border-b border-gray-100';
  const sectionTextColor = textColor;

  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  // The preference lives on the user's UserNotificationSettings record (created lazily on
  // first save). /auth/me carries it too, so the row shows a value before the fetch lands.
  const [settingsRecord, setSettingsRecord] = useState<UserNotificationSettingsDto | null>(null);
  const [currency, setCurrency] = useState<SupportedCurrency>(
    asSupportedCurrency(currentUser?.preferredCurrency)
  );

  useEffect(() => {
    const userId = currentUser?.id;
    // A managed partner's login has no user behind it, so no settings row and no permission to
    // read one: the request was a 401 on every visit (as in NotificationSettingsScreen).
    if (!userId || isProviderProfile) return;
    let cancelled = false;
    getNotificationSettings(userId)
      .then((record) => {
        if (cancelled || !record) return;
        setSettingsRecord(record);
        const stored = asSupportedCurrency(record.preferredCurrency);
        setCurrency(stored);
        // The stored record is more authoritative than /auth/me's copy — make every
        // unstamped amount in the app format in it right away.
        registerDisplayCurrency(stored);
      })
      .catch(() => {}); // no record / fetch failure: keep the /auth/me value
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, isProviderProfile]);

  const handleSelectCurrency = (code: SupportedCurrency) => {
    setCurrencyPickerOpen(false);
    const userId = currentUser?.id;
    if (!userId || code === currency) return;
    const previous = currency;
    setCurrency(code);
    registerDisplayCurrency(code);
    // Round-trip the loaded record so the other settings (incl. preferredLanguage) survive
    // the save; a fresh record seeds preferredLanguage from the active app language.
    const base = settingsRecord ?? {
      ...defaultNotificationSettings(userId),
      preferredLanguage: language,
    };
    const next = { ...base, preferredCurrency: code };
    saveNotificationSettings(next)
      .then((saved) => {
        setSettingsRecord({ ...next, id: saved.id ?? next.id });
        // /auth/me carries the preference too, and useCurrency() reads it from there —
        // re-fetch so screens already mounted re-render in the new currency.
        return refreshUser().catch(() => {}); // display-only; the save itself succeeded
      })
      .catch((e) => {
        setCurrency(previous);
        registerDisplayCurrency(previous);
        showError(getErrorMessage(e, t('common.somethingWentWrong')));
      });
  };

  const currentLanguageLabel = LANGUAGES.find((l) => l.code === language)?.label ?? 'English';

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('settings.title')}
      contentBg={contentBg}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: 40,
          paddingHorizontal: gutter.value,
        }}>
        {/* Appearance */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>
          {t('settings.appearance')}
        </Text>
        <View className={`${cardBg} mb-6 rounded-2xl p-4`}>
          <View className="flex-row items-center">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
              <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={24} color={BRAND_GREEN} />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.darkMode')}
              </Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>
                {isDarkMode ? t('settings.darkEnabled') : t('settings.lightEnabled')}
              </Text>
            </View>
            <Switch
              // Named after its row. A Switch renders with the value as its only accessible name,
              // so all four here announced as "switch, on" — indistinguishable from each other.
              accessibilityLabel={t('settings.darkMode')}
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: '#D1D5DB', true: BRAND_GREEN }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* Privacy & Security */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>
          {t('settings.privacySecurity')}
        </Text>
        <View className={`${cardBg} mb-6 rounded-2xl`}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => (navigation as any).navigate('ChangePassword')}
            className={`flex-row items-center p-4 ${canPay ? divider : ''}`}>
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-red-50">
              <Ionicons name="lock-closed" size={24} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.changePassword')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          {/* The cards bookings are paid with — a customer's, so not on a managed partner login. */}
          {canPay ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => (navigation as any).navigate('PaymentMethods')}
              className="flex-row items-center p-4">
              <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <Ionicons name="card" size={24} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className={`text-base font-semibold ${textColor}`}>
                  {t('payments.methodsTitle')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* General */}
        <Text className={`text-base font-semibold ${sectionTextColor} mb-3`}>
          {t('settings.general')}
        </Text>
        <View className={`${cardBg} rounded-2xl`}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setLanguagePickerOpen(true)}
            className={`flex-row items-center ${divider} p-4`}>
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
              <Ionicons name="globe" size={24} color="#A855F7" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.language')}
              </Text>
              <Text className={`text-sm ${subtextColor} mt-0.5`}>{currentLanguageLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          {/* The display currency is saved on the user's settings row, which a managed partner's
              login does not have — the picker could only fail to save for them. */}
          {!isProviderProfile ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setCurrencyPickerOpen(true)}
              className={`flex-row items-center ${divider} p-4`}>
              <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                <Ionicons name="cash" size={24} color={BRAND_GREEN} />
              </View>
              <View className="flex-1">
                <Text className={`text-base font-semibold ${textColor}`}>
                  {t('settings.currency')}
                </Text>
                <Text className={`text-sm ${subtextColor} mt-0.5`}>
                  {currency} · {t('settings.currencyNote')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
          {/* Help & Support: questions, the support contact (when configured) and the legal pages. */}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.navigate('Help' as never)}
            className={`flex-row items-center ${divider} p-4`}>
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
              <Ionicons name="help-circle" size={24} color="#F97316" />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('settings.helpSupport')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          {/* The row that did nothing: now one row per document. */}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => (navigation as any).navigate('Legal', { doc: 'terms' })}
            className={`flex-row items-center ${divider} p-4`}>
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-green-50">
              <Ionicons name="document-text" size={24} color={BRAND_GREEN} />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('legal.termsTitle')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => (navigation as any).navigate('Legal', { doc: 'privacy' })}
            className="flex-row items-center p-4">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-green-50">
              <Ionicons name="shield-checkmark" size={24} color={BRAND_GREEN} />
            </View>
            <View className="flex-1">
              <Text className={`text-base font-semibold ${textColor}`}>
                {t('legal.privacyTitle')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* The stores require an account to be closable from inside the app. */}
        {canDeleteAccount && (
          <>
            <Text className={`text-base font-semibold ${sectionTextColor} mb-3 mt-6`}>
              {t('settings.accountSection')}
            </Text>
            <View className={`${cardBg} mb-6 rounded-2xl`}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setDeleteError('');
                  setDeleteOpen(true);
                }}
                className="flex-row items-center p-4">
                <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                  <Ionicons name="trash-outline" size={24} color="#EF4444" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-red-500">
                    {t('settings.deleteAccount')}
                  </Text>
                  <Text className={`text-sm ${subtextColor} mt-0.5`}>
                    {t('settings.deleteAccountHint')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <DeleteAccountModal
        visible={deleteOpen}
        submitting={isDeleting}
        error={deleteError}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
      />

      <LanguagePicker
        visible={languagePickerOpen}
        current={language}
        onSelect={(lang) => {
          setLanguage(lang);
          setLanguagePickerOpen(false);
        }}
        onClose={() => setLanguagePickerOpen(false)}
      />

      <CurrencyPicker
        visible={currencyPickerOpen}
        current={currency}
        onSelect={handleSelectCurrency}
        onClose={() => setCurrencyPickerOpen(false)}
      />
    </ScreenLayout>
  );
}
