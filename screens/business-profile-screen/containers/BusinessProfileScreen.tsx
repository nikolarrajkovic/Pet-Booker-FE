import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Avatar from '../../../components/shared/Avatar';
import { uploadFile } from '../../../services/files';
import { showAlert } from '../../../services/alert';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useFormChain } from '../../../hooks/useFormChain';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FormCard from '../../../components/shared/FormCard';
import MapAddressPicker from '../../../components/shared/MapAddressPicker';
import PhoneInput from '../../../components/shared/PhoneInput';
import {
  getServiceProvider,
  providerTypeLabel,
  resolveImageUrl,
  type PhotoDto,
  PROVIDER_NAME_TAKEN,
  updateBusinessProfile,
  type AddressDto,
  type ServiceProviderDto,
} from '../../../services/service-providers';
import { ApiError, getErrorMessage } from '../../../services/http';
import { addressLabel } from '../../../services/geocoding';
import { usePageGutter } from '../../../hooks/usePageGutter';
import { DEFAULT_LOCATION } from '../../../hooks/useLocation';

/**
 * A partner's business profile: the name customers see, how to reach them, their experience and
 * their About text, and where they are based. Everything here was asked once by the partner
 * application and could never be changed afterwards — a typo in About stayed on the public page.
 *
 * The service type is shown, not edited: every service the partner lists is of that type.
 */
export default function BusinessProfileScreen() {
  const gutter = usePageGutter();
  const { currentUser } = useAuth();
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
  const { showError, showSuccess } = useToast();
  const { t, tEnum } = useLocale();

  const providerId = currentUser?.serviceProviderId ?? null;
  const [original, setOriginal] = useState<ServiceProviderDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  // The name field is at the top; Save is at the bottom. A refused name scrolls back to it.
  const scrollRef = useRef<ScrollView>(null);

  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [years, setYears] = useState('');
  const [about, setAbout] = useState('');
  const [address, setAddress] = useState<AddressDto | null>(null); // newly picked
  // A newly picked profile photo, uploaded on save (like Account's avatar).
  const [newPhoto, setNewPhoto] = useState<{
    uri: string;
    fileName?: string;
    mimeType?: string;
  } | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!providerId) {
        setLoadError(t('businessProfile.notAvailable'));
        setIsLoading(false);
        return;
      }
      try {
        const dto = await getServiceProvider(providerId);
        if (cancelled) return;
        setOriginal(dto);
        setName(dto.name ?? '');
        setContactEmail(dto.contactEmail ?? '');
        setPhone(dto.contactPhone ?? '');
        setYears(dto.yearsOfExperience != null ? String(dto.yearsOfExperience) : '');
        setAbout(dto.about ?? '');
      } catch (e) {
        if (!cancelled) setLoadError(getErrorMessage(e, t('businessProfile.loadFailed')));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerId, t]);

  const handleSave = async () => {
    if (!original?.id || isSaving) return;
    if (!name.trim()) {
      setNameError(t('businessProfile.nameRequired'));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setNameError('');
    setIsSaving(true);
    try {
      const digits = /\d+/.exec(years)?.[0];
      // A new profile photo: upload it, then send the gallery back with it selected — the server
      // replaces the gallery with what it gets, so the existing photos have to come along.
      let photos: PhotoDto[] | undefined;
      if (newPhoto) {
        const uploaded = await uploadFile(newPhoto.uri, newPhoto.fileName, newPhoto.mimeType);
        photos = [
          {
            id: 0,
            src: uploaded.src,
            name: uploaded.originalName,
            alt: uploaded.originalName,
            fileUploadId: Number(uploaded.id),
            isSelected: true,
          },
          ...(original.photos ?? []).map((p) => ({ ...p, id: 0, isSelected: false })),
        ];
      }
      const updated = await updateBusinessProfile(original, {
        photos,
        name,
        contactEmail,
        contactPhone: phone,
        yearsOfExperience: digits ? Math.min(Number(digits), 80) : null,
        about,
        address,
      });
      setOriginal(updated);
      setAddress(null);
      setNewPhoto(null);
      showSuccess(t('businessProfile.saved'));
    } catch (e) {
      // Names customers see are unique: say so where the name is, not in a toast.
      if (e instanceof ApiError && e.hasCode(PROVIDER_NAME_TAKEN)) {
        setNameError(e.message);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      showError(getErrorMessage(e, t('businessProfile.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('account.permissionNeededTitle'), t('account.permissionPhotoMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setNewPhoto({
        uri: asset.base64
          ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
          : asset.uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
      });
    }
  };

  const savedPhoto =
    (original?.photos ?? []).find((p) => p.isSelected) ?? (original?.photos ?? [])[0] ?? null;
  const photoUri = newPhoto?.uri || resolveImageUrl(savedPhoto?.src) || null;

  // Name -> email -> years -> save. About is multi-line (Enter adds a line), phone is composite.
  const form = useFormChain(['name', 'contactEmail', 'years'], handleSave);
  const currentAddress = address ?? original?.address ?? null;
  const inputClass = `${inputBg} rounded-xl px-4 py-3 ${inputText} border ${borderColor}`;

  const layout = (children: React.ReactNode) => (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('businessProfile.title')}
      contentBg={bgColor}
      width="narrow">
      {children}
    </ScreenLayout>
  );

  if (isLoading) {
    return layout(
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator size="large" color={BRAND_GREEN} />
      </View>
    );
  }

  if (loadError || !original) {
    return layout(
      <View className="flex-1 items-center justify-center px-8 py-20">
        <Ionicons
          name="alert-circle-outline"
          size={56}
          color={isDarkMode ? '#6B7280' : '#9CA3AF'}
        />
        <Text className={`${subtextColor} mt-4 text-center`}>{loadError}</Text>
      </View>
    );
  }

  return layout(
    <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <FormCard>
        <View className={`${gutter.px} py-6`}>
          <Text className={`text-sm ${subtextColor} mb-5`}>{t('businessProfile.intro')}</Text>

          {/* Profile photo — what customers see on the partner's page and cards */}
          <View className="mb-6 items-center">
            <View className="relative">
              <Avatar
                uri={photoUri ?? undefined}
                name={name || original.name || ''}
                size={112}
                placeholderClassName={isDarkMode ? 'bg-[#243447]' : 'bg-brand-100'}
                textClassName="text-4xl font-bold text-brand-600"
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('businessProfile.changePhoto')}
                onPress={pickPhoto}
                className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-brand-500">
                <Ionicons name="camera" size={18} color="white" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={pickPhoto} className="mt-3">
              <Text className="font-semibold text-brand-600">
                {t('businessProfile.changePhoto')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Name customers see */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('businessProfile.name')} <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              {...form.field('name')}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError('');
              }}
              maxLength={200}
              accessibilityLabel={t('businessProfile.name')}
              className={inputClass}
              placeholderTextColor={placeholderColor}
            />
            <Text className={`mt-1 text-xs ${nameError ? 'text-red-500' : subtextColor}`}>
              {nameError || t('businessProfile.nameHint')}
            </Text>
          </View>

          {/* Service type — read-only */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('businessProfile.type')}
            </Text>
            <View className={`${inputClass} flex-row items-center`} style={{ opacity: 0.7 }}>
              <Ionicons name="paw-outline" size={18} color={BRAND_GREEN} />
              <Text className={`ml-2 ${inputText}`}>
                {tEnum('serviceProviderType', original.type, providerTypeLabel(original.type))}
              </Text>
            </View>
            <Text className={`mt-1 text-xs ${subtextColor}`}>{t('businessProfile.typeHint')}</Text>
          </View>

          {/* Business email */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('businessProfile.contactEmail')}
            </Text>
            <TextInput
              {...form.field('contactEmail')}
              value={contactEmail}
              onChangeText={setContactEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel={t('businessProfile.contactEmail')}
              className={inputClass}
              placeholderTextColor={placeholderColor}
            />
            <Text className={`mt-1 text-xs ${subtextColor}`}>
              {t('businessProfile.contactEmailHint')}
            </Text>
          </View>

          {/* Phone */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('businessProfile.phone')}
            </Text>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
              inputBg={inputBg}
              inputText={inputText}
              borderColor={borderColor}
              placeholderColor={placeholderColor}
              cardBg={cardBg}
            />
            <Text className={`mt-1 text-xs ${subtextColor}`}>{t('businessProfile.phoneHint')}</Text>
          </View>

          {/* Years of experience */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('businessProfile.years')}
            </Text>
            <TextInput
              {...form.field('years')}
              value={years}
              onChangeText={(v) => setYears(v.replace(/[^\d]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              accessibilityLabel={t('businessProfile.years')}
              className={inputClass}
              placeholderTextColor={placeholderColor}
            />
          </View>

          {/* About */}
          <View className="mb-4">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('businessProfile.about')}
            </Text>
            <TextInput
              value={about}
              onChangeText={setAbout}
              multiline
              numberOfLines={5}
              maxLength={2000}
              textAlignVertical="top"
              placeholder={t('businessProfile.aboutPlaceholder')}
              accessibilityLabel={t('businessProfile.about')}
              className={inputClass}
              style={{ minHeight: 120 }}
              placeholderTextColor={placeholderColor}
            />
            <Text className={`mt-1 text-xs ${subtextColor}`}>{t('businessProfile.aboutHint')}</Text>
          </View>

          {/* Address — picked on a map */}
          <View className="mb-6">
            <Text className={`text-sm font-semibold ${textColor} mb-2`}>
              {t('businessProfile.address')}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setPickerVisible(true)}
              className={`${inputClass} flex-row items-center`}>
              <Ionicons name="location-outline" size={20} color={BRAND_GREEN} />
              <Text
                className={`ml-3 flex-1 ${currentAddress ? inputText : subtextColor}`}
                numberOfLines={2}>
                {currentAddress ? addressLabel(currentAddress) : t('bookService.pickOnMap')}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={isDarkMode ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>

          {/* Repeated by Save, where the eye is when it fails (the field may be off screen). */}
          {nameError ? (
            <Text className="mb-2 text-center text-sm text-red-500">{nameError}</Text>
          ) : null}

          {/* Save — in the flow of the form, like Account. */}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleSave}
            disabled={isSaving}
            className="mt-2 items-center rounded-2xl bg-brand-500 py-4"
            style={{ opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-lg font-bold text-white">{t('businessProfile.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </FormCard>

      {pickerVisible && (
        <MapAddressPicker
          visible
          title={t('businessProfile.address')}
          initialRegion={currentAddress?.location ?? DEFAULT_LOCATION}
          locateOnOpen={!currentAddress?.location}
          isDarkMode={isDarkMode}
          onClose={() => setPickerVisible(false)}
          onSelect={(picked) => setAddress(picked)}
        />
      )}
    </ScrollView>
  );
}
