import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocation } from '../../../hooks/useLocation';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import MapAddressPicker from '../../../components/shared/MapAddressPicker';
import { PersonalInfoStep, ServiceInfoStep, DocumentsStep } from '../components';
import type { CertificateEntry } from '../components/DocumentsStep';
import { createServiceProvider, AddressDto } from '../../../services/service-providers';
import { getUser, UserDto } from '../../../services/users';
import { getErrorMessage } from '../../../services/http';

// Reads a native File object as a base64 data URI using FileReader — pure memory, no network.
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PartnerApplicationScreen() {
  const navigation = useNavigation();
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
  const { currentUser } = useAuth();
  const { showError } = useToast();
  const { t } = useLocale();
  const location = useLocation();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressPickerVisible, setAddressPickerVisible] = useState(false);
  // Full account record (phone + address live here, not on currentUser) — fetched
  // once so the "Use my account details" button can prefill the form.
  const [accountUser, setAccountUser] = useState<UserDto | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profilePhotoFileName, setProfilePhotoFileName] = useState<string | undefined>(undefined);
  const [governmentIdFront, setGovernmentIdFront] = useState<string | null>(null);
  const [governmentIdFrontFileName, setGovernmentIdFrontFileName] = useState<string | undefined>(
    undefined
  );
  const [governmentIdBack, setGovernmentIdBack] = useState<string | null>(null);
  const [governmentIdBackFileName, setGovernmentIdBackFileName] = useState<string | undefined>(
    undefined
  );
  const [certificates, setCertificates] = useState<CertificateEntry[]>([]);
  const [petPhotos, setPetPhotos] = useState<(string | null)[]>([null, null, null]);
  const [petPhotoFileNames, setPetPhotoFileNames] = useState<(string | undefined)[]>([
    undefined,
    undefined,
    undefined,
  ]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    streetAddress: '',
    city: '',
    zipCode: '',
    selectedServices: [] as string[],
    yearsOfExperience: '',
    aboutYou: '',
    motivation: '',
  });

  // Fetch the full account record once (currentUser only carries name/email —
  // phone and address come from getUser) to back the prefill button.
  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.id) return;
    (async () => {
      try {
        const u = await getUser(currentUser.id);
        if (!cancelled) setAccountUser(u);
      } catch {
        // Non-fatal: prefill just falls back to the currentUser name/email.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // Prefill the personal-info fields from whatever the account already has.
  // Only fills blanks/over-writes with real values, so it won't wipe edits with empties.
  const prefillFromAccount = () => {
    const u = accountUser;
    const fullName = [u?.firstName ?? currentUser?.firstName, u?.lastName ?? currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const addr = u?.address;
    setFormData((prev) => ({
      ...prev,
      fullName: fullName || prev.fullName,
      email: u?.email ?? currentUser?.email ?? prev.email,
      phone: u?.phone || prev.phone,
      streetAddress: addr?.line1 || prev.streetAddress,
      city: addr?.city || prev.city,
      zipCode: addr?.postalCode || prev.zipCode,
    }));
  };

  // Fill the address fields from a pin dropped on the map. The map returns a full
  // AddressDto, so street/city/ZIP are all populated (city/ZIP stay editable below).
  const onSelectAddressFromMap = (picked: AddressDto) => {
    setFormData((prev) => ({
      ...prev,
      streetAddress: picked.line1 || prev.streetAddress,
      city: picked.city || prev.city,
      zipCode: picked.postalCode || prev.zipCode,
    }));
  };

  const pickImage = async (type: 'profile') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(t('account.permissionNeededTitle'), t('partnerApplication.permissionDocsMsg'));
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
      const uri = asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;
      setProfilePhoto(uri);
      setProfilePhotoFileName(asset.fileName ?? undefined);
    }
  };

  // Government ID uses ImagePicker (images only — same pattern as pet photos)
  const pickDocument = async (type: 'governmentIdFront' | 'governmentIdBack' | 'certificate') => {
    if (type === 'certificate') {
      // Certificates may be PDFs — use DocumentPicker
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const fileName = asset.name ?? undefined;
      let uri = asset.uri;

      // On web DocumentPicker exposes the native File object — read it directly
      // with FileReader, same way ImagePicker base64 works. No network request.
      if (Platform.OS === 'web') {
        const webFile = (asset as any).file as File | undefined;
        if (webFile) uri = await fileToDataUri(webFile);
      }

      setCertificates((prev) => [...prev, { uri, fileName, issuer: '', issuedDate: '' }]);
      return;
    }

    // Government ID photos are always images — use ImagePicker with base64
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('account.permissionNeededTitle'), t('partnerApplication.permissionDocsMsg'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;
      const fileName = asset.fileName ?? undefined;

      if (type === 'governmentIdFront') {
        setGovernmentIdFront(uri);
        setGovernmentIdFrontFileName(fileName);
      } else {
        setGovernmentIdBack(uri);
        setGovernmentIdBackFileName(fileName);
      }
    }
  };

  const pickPetPhoto = async (slotIndex: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('account.permissionNeededTitle'), t('partnerApplication.permissionPhotosMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;
      setPetPhotos((prev) => prev.map((p, i) => (i === slotIndex ? uri : p)));
      setPetPhotoFileNames((prev) =>
        prev.map((n, i) => (i === slotIndex ? (asset.fileName ?? undefined) : n))
      );
    }
  };

  const onUpdateCertificate = (index: number, field: 'issuer' | 'issuedDate', value: string) => {
    setCertificates((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const removeCertificate = (index: number) => {
    setCertificates((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSteps = 3;
  const progressPercentage = (step / totalSteps) * 100;

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

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('partnerApplication.title')}
      contentBg={bgColor}
      contentRounded={false}
      headerChildren={
        <>
          {/* Progress Bar */}
          <View className="mb-2 mt-4">
            <View className="h-2 overflow-hidden rounded-full bg-white/30">
              <View
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </View>
          </View>
          <Text className="text-sm text-white">
            {t('partnerWelcome.stepOf', { current: step, total: totalSteps })}
          </Text>
        </>
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 100, paddingHorizontal: 24 }}>
        {step === 1 && (
          <PersonalInfoStep
            formData={formData}
            setFormData={setFormData}
            onPrefill={currentUser ? prefillFromAccount : undefined}
            onOpenAddressMap={() => setAddressPickerVisible(true)}
            {...themeProps}
          />
        )}

        {step === 2 && (
          <ServiceInfoStep formData={formData} setFormData={setFormData} {...themeProps} />
        )}

        {step === 3 && (
          <DocumentsStep
            profilePhoto={profilePhoto}
            petPhotos={petPhotos}
            governmentIdFront={governmentIdFront}
            governmentIdBack={governmentIdBack}
            certificates={certificates}
            pickImage={pickImage}
            pickPetPhoto={pickPetPhoto}
            pickDocument={pickDocument}
            onRemoveCertificate={removeCertificate}
            onUpdateCertificate={onUpdateCertificate}
            {...themeProps}
          />
        )}
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className={`${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          disabled={isSubmitting}
          onPress={async () => {
            if (step < totalSteps) {
              setStep(step + 1);
              return;
            }

            setIsSubmitting(true);
            try {
              const governmentIdFiles: { uri: string; fileName?: string; isFront: boolean }[] = [
                ...(governmentIdFront
                  ? [{ uri: governmentIdFront, fileName: governmentIdFrontFileName, isFront: true }]
                  : []),
                ...(governmentIdBack
                  ? [{ uri: governmentIdBack, fileName: governmentIdBackFileName, isFront: false }]
                  : []),
              ];
              const certificateFiles: {
                uri: string;
                fileName?: string;
                certName?: string;
                issuer?: string;
                issuedDate?: string;
              }[] = certificates.map((c) => ({
                uri: c.uri,
                fileName: c.fileName,
                certName: c.fileName ?? t('partnerApplication.certificate'),
                issuer: c.issuer,
                issuedDate: c.issuedDate,
              }));
              const petPhotoFiles = petPhotos
                .map((uri, i) => (uri ? { uri, fileName: petPhotoFileNames[i] } : null))
                .filter(Boolean) as { uri: string; fileName?: string }[];
              await createServiceProvider({
                ...formData,
                profilePhoto: profilePhoto
                  ? { uri: profilePhoto, fileName: profilePhotoFileName }
                  : null,
                petPhotoFiles,
                governmentIdFiles,
                certificateFiles,
                userId: currentUser?.id ?? 0,
              });
              (navigation as any).navigate('ApplicationSubmitted');
            } catch (error) {
              showError(getErrorMessage(error, t('partnerApplication.submitFailed')));
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="items-center rounded-2xl bg-brand-500 py-4"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-lg font-bold text-white">
              {step === totalSteps
                ? t('partnerApplication.submitApplication')
                : t('partnerApplication.continue')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Map picker for the street address — opens on the user's current location */}
      {addressPickerVisible && (
        <MapAddressPicker
          visible
          title={t('account.yourAddress')}
          initialRegion={{ latitude: location.latitude, longitude: location.longitude }}
          isDarkMode={isDarkMode}
          onClose={() => setAddressPickerVisible(false)}
          onSelect={(picked) => onSelectAddressFromMap(picked)}
        />
      )}
    </ScreenLayout>
  );
}
