import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocation } from '../../../hooks/useLocation';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FormCard from '../../../components/shared/FormCard';
import MapAddressPicker from '../../../components/shared/MapAddressPicker';
import { AddressDto } from '../../../services/service-providers';
import { PersonalInfoStep, ServiceInfoStep } from '../../partner-application-screen/components';
import { showAlert } from '../../../services/alert';
import { invitePartner } from '../../../services/admin';
import { getErrorMessage } from '../../../services/http';
import { LANGUAGES } from '../../../i18n';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { useResponsive } from '../../../hooks/useResponsive';
import StepProgress from '../../../components/shared/StepProgress';

export default function AdminAddPartnerScreen() {
  const gutter = usePageGutter();
  const { isWebLayout } = useResponsive();
  const navigation = useNavigation();
  const location = useLocation();
  const { t, language } = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // The invite email's language: the partner's, which may not be the admin's.
  const [inviteLanguage, setInviteLanguage] = useState<string>(language);
  const {
    isDarkMode,
    bgColor,
    cardBg,
    textColor,
    subtextColor,
    inputBg,
    inputText,
    borderColor,
    placeholderColor,
  } = useThemeColors();

  const [step, setStep] = useState(1);
  const [addressPickerVisible, setAddressPickerVisible] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    streetAddress: '',
    city: '',
    zipCode: '',
    // ServiceProviderType value from /enums (shared shape with the partner application).
    serviceType: null as number | null,
    yearsOfExperience: '',
    aboutYou: '',
    motivation: '',
  });

  const totalSteps = 2;

  const themeProps = {
    isDarkMode,
    textColor,
    subtextColor,
    inputBg,
    inputText,
    borderColor,
    placeholderColor,
    cardBg,
  };

  // Fill the address fields from a pin dropped on the map (city/ZIP stay editable).
  const onSelectAddressFromMap = (picked: AddressDto) => {
    setFormData((prev) => ({
      ...prev,
      streetAddress: picked.line1 || prev.streetAddress,
      city: picked.city || prev.city,
      zipCode: picked.postalCode || prev.zipCode,
    }));
  };

  // Creates the partner (approved) and emails them an invite to set their password. This used to
  // show "Partner added" and send nothing at all.
  const handleSubmit = async () => {
    const name = formData.fullName.trim();
    const email = formData.email.trim();
    if (!name || !email.includes('@') || formData.serviceType == null) {
      setSubmitError(t('admin.invitePartnerMissing'));
      if (!name || !email.includes('@')) setStep(1);
      return;
    }
    const years = /\d+/.exec(formData.yearsOfExperience)?.[0];
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await invitePartner({
        name,
        email,
        phone: formData.phone || null,
        type: formData.serviceType,
        yearsOfExperience: years ? Math.min(80, Number(years)) : null,
        about: formData.aboutYou.trim() || null,
        address: formData.streetAddress.trim()
          ? {
              id: 0,
              line1: formData.streetAddress.trim(),
              line2: '',
              city: formData.city.trim(),
              state: '',
              postalCode: formData.zipCode.trim(),
              country: formData.country || 'RS',
            }
          : null,
        language: inviteLanguage,
      });
      showAlert(t('admin.partnerInvitedTitle'), t('admin.partnerInvitedMsg', { name, email }), [
        { text: t('admin.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      setSubmitError(getErrorMessage(e, t('admin.invitePartnerFailed')));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Named so Enter on a step's last field can run exactly what Continue runs — the same screen
  // reuses the partner-application steps, so it gets the same keyboard behaviour.
  const handleContinue = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const actions = (
    <>
      {submitError ? (
        <Text className="mb-3 text-center text-sm text-red-500">{submitError}</Text>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={handleContinue}
        disabled={isSubmitting}
        className={`items-center rounded-2xl bg-brand-500 py-4 ${isSubmitting ? 'opacity-70' : ''}`}>
        {isSubmitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-lg font-bold text-white">
            {step === totalSteps ? t('admin.sendInvite') : t('admin.continue')}
          </Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('admin.addPartnerTitle')}
      headerSubtitle={t('admin.addPartnerSubtitle')}
      contentBg={bgColor}
      headerChildren={<StepProgress step={step} total={totalSteps} />}
      // A form: one column of fields. Capped narrow so a label never sits a screen-width
      // away from the input it names.
      width="narrow">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: 24,
          // The phone's action bar sits below the scroll; the web one is inside it, after the form.
          paddingBottom: isWebLayout ? 40 : 100,
          paddingHorizontal: gutter.value,
        }}>
        <FormCard>
          {step === 1 && (
            <PersonalInfoStep
              onContinue={handleContinue}
              formData={formData}
              setFormData={setFormData}
              onOpenAddressMap={() => setAddressPickerVisible(true)}
              {...themeProps}
            />
          )}

          {step === 2 && (
            <>
              <ServiceInfoStep
                formData={formData}
                setFormData={setFormData}
                onContinue={handleContinue}
                showMotivation={false}
                {...themeProps}
              />
              {/* The invite email goes out in the partner's language. */}
              <Text className={`mb-1 text-sm font-semibold ${textColor}`}>
                {t('admin.inviteLanguage')}
              </Text>
              <Text className={`mb-3 text-xs ${subtextColor}`}>
                {t('admin.inviteLanguageHint')}
              </Text>
              <View className="mb-2 flex-row flex-wrap" style={{ gap: 8 }}>
                {LANGUAGES.map((lang) => {
                  const selected = inviteLanguage === lang.code;
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setInviteLanguage(lang.code)}
                      className={`rounded-full border px-4 py-2 ${selected ? 'border-brand-500 bg-brand-500' : borderColor}`}>
                      <Text
                        className={`text-sm font-medium ${selected ? 'text-white' : textColor}`}>
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </FormCard>
        {isWebLayout && <View className="mt-6">{actions}</View>}
      </ScrollView>

      {/* Phone: the action bar pinned under the form. On the web design it follows the form
          inside the scroll instead — a full-width white strip at the bottom of the window,
          detached from the card above it, read as a separate panel. */}
      {!isWebLayout && (
        <View className={`${cardBg} border-t ${borderColor} ${gutter.px} py-4`}>{actions}</View>
      )}

      {/* Map picker for the street address — opens on the current location */}
      {addressPickerVisible && (
        <MapAddressPicker
          visible
          title={t('admin.partnerAddress')}
          initialRegion={{ latitude: location.latitude, longitude: location.longitude }}
          isDarkMode={isDarkMode}
          onClose={() => setAddressPickerVisible(false)}
          onSelect={(picked) => onSelectAddressFromMap(picked)}
        />
      )}
    </ScreenLayout>
  );
}
