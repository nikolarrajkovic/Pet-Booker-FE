import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import TimePicker, { formatTime24 } from '../../../components/shared/TimePicker';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import {
  createService,
  updateService,
  deleteService,
  ServiceDto,
} from '../../../services/services';
import { getErrorMessage } from '../../../services/http';
import { providerTypeValue } from '../../../services/service-providers';
import { findServiceAddon } from '../../../services/service-addons';
import { saveServiceSchedules } from '../../../services/service-schedules';
import { saveServicePricingOptions } from '../../../services/service-pricing-options';
import {
  serviceDtoToUi,
  uiToServiceDto,
  buildServicePhotos,
  ServiceImageInput,
  ALL_ADDITIONAL_SERVICE_NAMES,
  workingHoursToSchedules,
  pricingTiersToOptions,
  DURATION_OPTION_LABELS,
  PricingTier,
} from '../serviceModel';

// serviceProviderType enum `displayName`s — the selected label maps back to a
// real numeric `type` on save via providerTypeValue().
const SERVICE_TYPES = ['Sitter', 'Walker', 'Boarder', 'Pet Hotel', 'Groomer', 'Transporter'];

// Duration labels come from the shared label<->minutes map in serviceModel so
// every pick persists as a real ServicePricingOption duration.
const DURATION_OPTIONS = DURATION_OPTION_LABELS;

interface AdditionalService {
  name: string;
  price: string;
  expanded: boolean;
}

interface WorkingHours {
  [day: string]: { enabled: boolean; startTime: string; endTime: string };
}

interface ExistingService {
  id: string;
  type: string;
  name: string;
  description: string;
  pricingTiers: PricingTier[];
  maxConcurrentBookings?: number;
  additionalServices: { name: string; price: string; enabled: boolean }[];
  workingHours: WorkingHours;
  images?: string[];
  selectedImageIndex?: number;
}

type AddEditServiceParams = {
  mode?: 'add' | 'edit';
  serviceDto?: ServiceDto; // present in edit mode (the real record)
  serviceProviderId?: number; // the partner's provider id
};

const DEFAULT_WORKING_HOURS: WorkingHours = {
  Monday: { enabled: false, startTime: '09:00', endTime: '17:00' },
  Tuesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
  Wednesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
  Thursday: { enabled: false, startTime: '09:00', endTime: '17:00' },
  Friday: { enabled: false, startTime: '09:00', endTime: '17:00' },
  Saturday: { enabled: false, startTime: '09:00', endTime: '17:00' },
  Sunday: { enabled: false, startTime: '09:00', endTime: '17:00' },
};

function getInitialAdditionalServices(existing?: ExistingService): AdditionalService[] {
  if (existing?.additionalServices) {
    const enabledMap = new Map(
      existing.additionalServices.filter((s) => s.enabled).map((s) => [s.name, s.price])
    );
    return ALL_ADDITIONAL_SERVICE_NAMES.map((name) => ({
      name,
      price: enabledMap.get(name) || '',
      expanded: enabledMap.has(name),
    }));
  }
  return ALL_ADDITIONAL_SERVICE_NAMES.map((name) => ({
    name,
    price: '',
    expanded: false,
  }));
}

export default function AddEditServiceScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: AddEditServiceParams }, 'params'>>();
  const params = route.params;
  const isEdit = params?.mode === 'edit';
  const { currentUser } = useAuth();
  // Prefill the form from the real service record (edit mode)
  const existingService: ExistingService | undefined = params?.serviceDto
    ? serviceDtoToUi(params.serviceDto)
    : undefined;

  const {
    isDarkMode,
    cardBg,
    textColor,
    subtextColor,
    inputBg,
    inputText,
    borderColor,
    placeholderColor,
  } = useThemeColors();

  const { showError } = useToast();
  const { t, tEnum } = useLocale();

  // English data-key labels → localized display strings (the state keeps the
  // English key so it round-trips to the numeric enum / catalog on save).
  const typeLabel = (label: string) => {
    const v = providerTypeValue(label);
    return v != null ? tEnum('serviceProviderType', v, label) : label;
  };
  const addonLabel = (name: string) => {
    const def = findServiceAddon(name);
    return def ? t(`addons.${def.id}` as any) : name;
  };

  // Provider id comes from the nav param, falling back to /auth/me (0 → none).
  const serviceProviderId = params?.serviceProviderId ?? (currentUser?.serviceProviderId || null);
  const [isSaving, setIsSaving] = useState(false);

  const [serviceType, setServiceType] = useState(existingService?.type || '');
  const [showServiceTypeModal, setShowServiceTypeModal] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationModalIndex, setDurationModalIndex] = useState(0);
  const [serviceName, setServiceName] = useState(existingService?.name || '');
  const [description, setDescription] = useState(existingService?.description || '');
  const [serviceImages, setServiceImages] = useState<ServiceImageInput[]>(
    (existingService?.images || []).map((uri) => ({ uri }))
  );
  const [mainImageIndex, setMainImageIndex] = useState(existingService?.selectedImageIndex ?? 0);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(
    existingService?.pricingTiers || [{ duration: '', price: '' }]
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerDay, setTimePickerDay] = useState<string | null>(null);
  const [timePickerType, setTimePickerType] = useState<'start' | 'end'>('start');
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [maxPetCapacity, setMaxPetCapacity] = useState(
    existingService?.maxConcurrentBookings != null
      ? String(existingService.maxConcurrentBookings)
      : '1'
  );
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>(
    getInitialAdditionalServices(existingService)
  );
  const [workingHours, setWorkingHours] = useState<WorkingHours>(
    existingService?.workingHours || DEFAULT_WORKING_HOURS
  );

  const toggleAdditionalService = (index: number) => {
    const updated = [...additionalServices];
    updated[index].expanded = !updated[index].expanded;
    setAdditionalServices(updated);
  };

  const updateAdditionalServicePrice = (index: number, value: string) => {
    const updated = [...additionalServices];
    updated[index].price = value;
    setAdditionalServices(updated);
  };

  const toggleWorkingDay = (day: string) => {
    // Just flip the day on/off. Times are set by tapping the Start/End time
    // fields (openTimePicker) — don't auto-pop the time picker on toggle.
    setWorkingHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const openTimePicker = (day: string, type: 'start' | 'end') => {
    setTimePickerDay(day);
    setTimePickerType(type);
    const timeStr = type === 'start' ? workingHours[day].startTime : workingHours[day].endTime;
    const [hours, minutesPart] = timeStr.split(':');
    const [minutes, period] = minutesPart.split(' ');
    // 24h "HH:mm" by default; legacy "h:mm AM/PM" still tolerated.
    const hour24 =
      period === 'PM' && hours !== '12'
        ? parseInt(hours) + 12
        : period === 'AM' && hours === '12'
          ? 0
          : parseInt(hours);
    const date = new Date();
    if (hour24 >= 24) {
      date.setHours(23, 59, 59, 0); // 24:00 end-of-day sentinel (see TimePicker)
    } else {
      date.setHours(hour24, parseInt(minutes), 0, 0);
    }
    setSelectedTime(date);
    setShowTimePicker(true);
  };

  const handleTimeChange = (date: Date) => {
    if (!timePickerDay) return;
    // 24-hour display, e.g. "08:00" / "18:00" / "24:00".
    const formattedTime = formatTime24(date);

    setWorkingHours((prev) => ({
      ...prev,
      [timePickerDay]: {
        ...prev[timePickerDay],
        [timePickerType === 'start' ? 'startTime' : 'endTime']: formattedTime,
      },
    }));
  };

  const addPricingTier = () => {
    setPricingTiers([...pricingTiers, { duration: '', price: '' }]);
  };

  const removePricingTier = (index: number) => {
    if (pricingTiers.length > 1) {
      setPricingTiers(pricingTiers.filter((_, i) => i !== index));
    }
  };

  const updatePricingTier = (index: number, field: 'duration' | 'price', value: string) => {
    const updated = [...pricingTiers];
    updated[index][field] = value;
    setPricingTiers(updated);
  };

  const removeImage = (index: number) => {
    setServiceImages((prev) => prev.filter((_, i) => i !== index));
    setMainImageIndex((cur) => (index === cur ? 0 : index < cur ? cur - 1 : cur));
  };

  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(t('account.permissionNeededTitle'), t('addEditService.permissionPhotoMsg'));
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
      setServiceImages((prev) => [...prev, { uri, fileName: asset.fileName ?? undefined }]);
    }
  };

  const handlePreview = () => {
    const serviceData = {
      name: serviceName,
      type: serviceType,
      description,
      price: parseFloat(pricingTiers[0]?.price) || 0,
      duration: pricingTiers[0]?.duration || '',
      additionalServices: {
        pickup: additionalServices[0].expanded
          ? parseFloat(additionalServices[0].price) || 0
          : undefined,
        dropOff: additionalServices[1].expanded
          ? parseFloat(additionalServices[1].price) || 0
          : undefined,
      },
      workingHours,
      isNew: !isEdit,
    };

    (navigation as any).navigate('ServicePreview', { service: serviceData });
  };

  const handleSave = async () => {
    if (!serviceType || !serviceName || !description) {
      Alert.alert(t('addEditService.missingInfoTitle'), t('addEditService.missingInfoMsg'));
      return;
    }
    if (serviceProviderId == null) {
      Alert.alert(t('addEditService.noProviderTitle'), t('addEditService.noProviderMsg'));
      return;
    }
    setIsSaving(true);
    try {
      // New local photos are bulk-uploaded first; already-uploaded ones keep
      // their metadata from the original DTO.
      const photos = await buildServicePhotos(
        serviceImages.map((img, i) => ({ ...img, isSelected: i === mainImageIndex })),
        params?.serviceDto?.photos
      );
      // Only API-backed fields persist. Duration tiers persist separately as
      // pricing options via /api/service-pricing-options below (the DTO's
      // basePrice carries the cheapest tier for the lean Home-rail display).
      // Add-ons persist via the catalog, but only their flat baseFee — per-km
      // surcharge fields stay UI-only. Working hours persist separately via
      // /api/service-schedules below.
      const dto = uiToServiceDto(
        {
          serviceProviderId,
          id: params?.serviceDto?.id ?? undefined,
          serviceType,
          serviceName,
          description,
          pricingTiers,
          maxPetCapacity: parseInt(maxPetCapacity, 10) || 1,
          additionalServices,
          photos,
        },
        params?.serviceDto
      );
      let savedId: number | undefined;
      if (isEdit && params?.serviceDto?.id != null) {
        await updateService(params.serviceDto.id, dto);
        savedId = params.serviceDto.id;
      } else {
        const created = await createService(dto);
        savedId = created?.id ?? undefined;
      }
      // Persist the per-day working hours, reconciling against any schedules the
      // service already has (edit mode). Best-effort: if it fails the service is
      // already saved, so warn rather than block — re-saving would re-create the
      // service on a hard error.
      if (savedId != null) {
        try {
          await saveServiceSchedules(
            savedId,
            workingHoursToSchedules(workingHours, savedId),
            params?.serviceDto?.schedules ?? []
          );
        } catch (schedErr) {
          if (__DEV__) console.warn('[AddEditService] working-hours save failed', schedErr);
          showError(t('addEditService.hoursSaveFailed'));
        }
        // Persist the duration/price tiers as pricing options, reconciling
        // against the options the service already has (edit mode). Same
        // best-effort pattern as the working hours above.
        try {
          await saveServicePricingOptions(
            savedId,
            pricingTiersToOptions(pricingTiers, savedId),
            params?.serviceDto?.pricingOptions ?? []
          );
        } catch (optErr) {
          if (__DEV__) console.warn('[AddEditService] pricing-options save failed', optErr);
          showError(t('addEditService.optionsSaveFailed'));
        }
      }
      navigation.goBack();
    } catch (e) {
      showError(getErrorMessage(e, t('addEditService.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    const serviceId = params?.serviceDto?.id;
    if (serviceId == null) return;
    Alert.alert(t('myServices.deleteTitle'), t('myServices.deleteMsg'), [
      { text: t('myServices.cancel'), style: 'cancel' },
      {
        text: t('myServices.delete'),
        style: 'destructive',
        onPress: async () => {
          setIsSaving(true);
          try {
            await deleteService(serviceId);
            navigation.goBack();
          } catch (e) {
            showError(getErrorMessage(e, t('myServices.deleteFailed')));
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const anyDayEnabled = Object.values(workingHours).some((day) => day.enabled);

  const previewButton = (
    <TouchableOpacity onPress={handlePreview}>
      <Text className="font-semibold text-white">{t('addEditService.preview')}</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenLayout
      showBackButton
      headerTitle={isEdit ? t('addEditService.titleEdit') : t('addEditService.titleAdd')}
      headerSubtitle={isEdit ? t('addEditService.subtitleEdit') : t('addEditService.subtitleAdd')}
      rightAction={previewButton}
      contentBg={isDarkMode ? 'bg-[#0f1621]' : 'bg-white'}>
      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        {/* Service Type */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>
            {t('addEditService.serviceType')}
          </Text>
          <TouchableOpacity
            onPress={() => setShowServiceTypeModal(true)}
            className={`${inputBg} flex-row items-center justify-between rounded-xl px-4 py-3`}>
            <Text className={serviceType ? textColor : `${subtextColor}`}>
              {serviceType ? typeLabel(serviceType) : t('addEditService.selectServiceType')}
            </Text>
            <Ionicons name="chevron-down" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
        </View>

        {/* Service Name */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>
            {t('addEditService.serviceName')}
          </Text>
          <TextInput
            placeholder={t('addEditService.serviceNamePlaceholder')}
            placeholderTextColor={placeholderColor}
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
            value={serviceName}
            onChangeText={setServiceName}
          />
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>
            {t('addEditService.descriptionLabel')}
          </Text>
          <TextInput
            placeholder={t('addEditService.descriptionPlaceholder')}
            placeholderTextColor={placeholderColor}
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Service Images */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>
            {t('addEditService.serviceImages')}
          </Text>
          <Text className={`${subtextColor} mb-3 text-sm`}>
            {t('addEditService.serviceImagesHint')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {serviceImages.map((img, index) => (
              <View key={index} className="relative" style={{ width: 80, height: 80 }}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setMainImageIndex(index)}>
                  <Image
                    source={{ uri: img.uri }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                      borderWidth: index === mainImageIndex ? 2 : 0,
                      borderColor: '#00C870',
                    }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                {index === mainImageIndex && (
                  <View
                    className="absolute bottom-0 left-0 right-0 items-center bg-brand-500"
                    style={{
                      paddingVertical: 2,
                      borderBottomLeftRadius: 12,
                      borderBottomRightRadius: 12,
                    }}>
                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>
                      {t('addPet.profileBadge')}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => removeImage(index)}
                  className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-red-500"
                  style={{ elevation: 3 }}>
                  <Ionicons name="close" size={12} color="white" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={handleAddPhoto}
              className={`${inputBg} border ${borderColor} items-center justify-center rounded-xl border-dashed`}
              style={{ width: 80, height: 80 }}>
              <Ionicons name="camera-outline" size={24} color="#6B7280" />
              <Text className={`${subtextColor} mt-1 text-xs`}>{t('addEditService.addPhoto')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pricing & Duration */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-1`}>
            {t('addEditService.pricingDuration')}
          </Text>
          <Text className={`${subtextColor} mb-3 text-sm`}>
            {t('addEditService.pricingDurationHint')}
          </Text>
          {pricingTiers.map((tier, index) => (
            <View key={index} className="mb-3 flex-row items-center" style={{ gap: 8 }}>
              {/* Duration picker */}
              <TouchableOpacity
                onPress={() => {
                  setDurationModalIndex(index);
                  setShowDurationModal(true);
                }}
                className={`${inputBg} flex-1 flex-row items-center justify-between rounded-xl px-3 py-3`}>
                <Text
                  className={`${tier.duration ? inputText : subtextColor} text-sm`}
                  numberOfLines={1}>
                  {tier.duration || t('addEditService.duration')}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                />
              </TouchableOpacity>

              {/* Price input — flex-1 fills remaining space before Remove */}
              <View className={`${inputBg} flex-1 flex-row items-center rounded-xl px-3 py-3`}>
                <Text className={subtextColor}>$</Text>
                <TextInput
                  placeholder="25"
                  placeholderTextColor={placeholderColor}
                  className={`${inputText} ml-1 flex-1 text-sm`}
                  style={{ padding: 0, outlineStyle: 'none' } as any}
                  value={tier.price}
                  onChangeText={(value) => updatePricingTier(index, 'price', value)}
                  keyboardType="numeric"
                  selectionColor="#00C870"
                  cursorColor="#00C870"
                  maxLength={5}
                />
              </View>

              {/* Remove — fixed width so it always sits at the right edge */}
              {pricingTiers.length > 1 ? (
                <TouchableOpacity
                  onPress={() => removePricingTier(index)}
                  style={{ width: 56, alignItems: 'flex-end' }}>
                  <Text className="text-sm font-medium text-red-500">
                    {t('addEditService.remove')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 56 }} />
              )}
            </View>
          ))}
          <TouchableOpacity
            onPress={addPricingTier}
            className="items-center rounded-xl py-3"
            style={{
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: isDarkMode ? '#374151' : '#D1D5DB',
            }}>
            <View className="flex-row items-center">
              <Ionicons name="add-circle-outline" size={20} color="#00C870" />
              <Text className="ml-2 font-semibold text-brand-500">
                {t('addEditService.addPriceTier')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Maximum Pet Capacity */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>
            {t('addEditService.maxCapacity')}
          </Text>
          <Text className={`${subtextColor} mb-2 text-sm`}>
            {t('addEditService.maxCapacityHint')}
          </Text>
          <View className={`${inputBg} flex-row items-center rounded-xl px-4 py-3`}>
            <Ionicons name="paw-outline" size={18} color="#00C870" />
            <TextInput
              placeholder="1"
              placeholderTextColor={placeholderColor}
              className={`${inputText} ml-2 flex-1`}
              style={{ padding: 0, outlineStyle: 'none' } as any}
              value={maxPetCapacity}
              onChangeText={(value) => setMaxPetCapacity(value.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              maxLength={3}
              selectionColor="#00C870"
              cursorColor="#00C870"
            />
          </View>
        </View>

        {/* Additional Services */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-1`}>
            {t('addEditService.additionalServicesOffered')}
          </Text>
          <Text className={`${subtextColor} mb-3 text-sm`}>
            {t('addEditService.additionalServicesHint')}
          </Text>

          {additionalServices.map((service, index) => (
            <View key={index}>
              {!service.expanded ? (
                <TouchableOpacity
                  onPress={() => toggleAdditionalService(index)}
                  className={`${cardBg} border ${borderColor} mb-2 rounded-xl px-4 py-3`}>
                  <Text className={textColor}>{addonLabel(service.name)}</Text>
                </TouchableOpacity>
              ) : (
                <View className={`${inputBg} mb-3 rounded-xl border-2 border-brand-300 p-4`}>
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className={`${textColor} font-medium`}>{addonLabel(service.name)}</Text>
                    <TouchableOpacity onPress={() => toggleAdditionalService(index)}>
                      <Ionicons name="close" size={20} color={isDarkMode ? '#fff' : '#000'} />
                    </TouchableOpacity>
                  </View>
                  <Text className={`${subtextColor} mb-2 text-sm`}>
                    {t('addEditService.priceFreeHint')}
                  </Text>
                  <View
                    className={`${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'} flex-row items-center rounded-xl px-4 py-3`}>
                    <Text className={subtextColor}>$</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      className={`${inputText} ml-2 flex-1`}
                      value={service.price}
                      onChangeText={(value) => updateAdditionalServicePrice(index, value)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Working Hours */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-1`}>
            {t('addEditService.workingHours')}
          </Text>
          <Text className={`${subtextColor} mb-3 text-sm`}>
            {t('addEditService.workingHoursHint')}
          </Text>

          {!anyDayEnabled && (
            <View className={`${inputBg} mb-3 flex-row items-center rounded-xl p-4`}>
              <View className="mr-3 h-2 w-2 rounded-full bg-gray-400" />
              <View className="flex-1">
                <Text className={`${subtextColor} font-medium`}>
                  {t('addEditService.currentlyUnavailable')}
                </Text>
                <Text className={`${subtextColor} mt-1 text-xs`}>
                  {t('addEditService.basedOnSchedule')}
                </Text>
              </View>
            </View>
          )}

          {Object.entries(workingHours).map(([day, hours]) => (
            <View key={day}>
              <TouchableOpacity
                onPress={() => toggleWorkingDay(day)}
                className={`${cardBg} border ${borderColor} mb-2 flex-row items-center justify-between rounded-xl px-4 py-3`}>
                <Text className={textColor}>{t(`days.${day.toLowerCase()}` as any)}</Text>
                {/* Display-only — the row's onPress is the single toggle source
                    (a Switch onValueChange here would fire toggle a second time). */}
                <View pointerEvents="none">
                  <Switch
                    value={hours.enabled}
                    trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                    thumbColor={hours.enabled ? '#00C870' : '#f4f3f4'}
                  />
                </View>
              </TouchableOpacity>

              {hours.enabled && (
                <View className={`${inputBg} -mt-1 mb-3 rounded-xl border-2 border-brand-300 p-4`}>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className={`${subtextColor} mb-2 text-sm`}>
                        {t('addEditService.startTime')}
                      </Text>
                      <TouchableOpacity
                        onPress={() => openTimePicker(day, 'start')}
                        className={`${cardBg} border ${borderColor} flex-row items-center justify-between rounded-xl px-4 py-3`}>
                        <Text className={textColor}>{hours.startTime}</Text>
                        <Ionicons name="time-outline" size={20} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <View className="flex-1">
                      <Text className={`${subtextColor} mb-2 text-sm`}>
                        {t('addEditService.endTime')}
                      </Text>
                      <TouchableOpacity
                        onPress={() => openTimePicker(day, 'end')}
                        className={`${cardBg} border ${borderColor} flex-row items-center justify-between rounded-xl px-4 py-3`}>
                        <Text className={textColor}>{hours.endTime}</Text>
                        <Ionicons name="time-outline" size={20} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Save / Update Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`mt-4 items-center rounded-2xl bg-brand-500 py-4 ${isEdit ? 'mb-3' : 'mb-6'}`}
          style={{ opacity: isSaving ? 0.7 : 1 }}>
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-lg font-bold text-white">
              {isEdit ? t('addEditService.updateService') : t('addEditService.saveService')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Delete Button — edit mode only */}
        {isEdit && (
          <TouchableOpacity
            onPress={handleDelete}
            disabled={isSaving}
            className="mb-6 flex-row items-center justify-center rounded-2xl border-2 border-red-500 py-4"
            style={{ opacity: isSaving ? 0.7 : 1 }}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text className="ml-2 text-lg font-bold text-red-500">
              {t('addEditService.deleteService')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Service Type Modal */}
      <Modal
        visible={showServiceTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowServiceTypeModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowServiceTypeModal(false)}
          className="flex-1 justify-end bg-black/50">
          <TouchableOpacity activeOpacity={1} className={`${cardBg} rounded-t-3xl`}>
            <View className="p-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className={`text-xl font-bold ${textColor}`}>
                  {t('addEditService.selectServiceTypeModal')}
                </Text>
                <TouchableOpacity onPress={() => setShowServiceTypeModal(false)}>
                  <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
                </TouchableOpacity>
              </View>

              {SERVICE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setServiceType(type);
                    setShowServiceTypeModal(false);
                  }}
                  className={`border-b py-4 ${borderColor}`}>
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base ${textColor}`}>{typeLabel(type)}</Text>
                    {serviceType === type && (
                      <Ionicons name="checkmark" size={24} color="#00C870" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Duration Picker Modal */}
      <Modal
        visible={showDurationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDurationModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDurationModal(false)}
          className="flex-1 justify-end bg-black/50">
          <TouchableOpacity activeOpacity={1} className={`${cardBg} rounded-t-3xl`}>
            <View className="p-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className={`text-xl font-bold ${textColor}`}>
                  {t('addEditService.selectDuration')}
                </Text>
                <TouchableOpacity onPress={() => setShowDurationModal(false)}>
                  <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
                </TouchableOpacity>
              </View>

              {DURATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => {
                    updatePricingTier(durationModalIndex, 'duration', option);
                    setShowDurationModal(false);
                  }}
                  className={`border-b py-4 ${borderColor}`}>
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base ${textColor}`}>{option}</Text>
                    {pricingTiers[durationModalIndex]?.duration === option && (
                      <Ionicons name="checkmark" size={24} color="#00C870" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimePicker(false)}>
          <View className="flex-1 items-center justify-center bg-black/50 px-6">
            <View className="w-full max-w-sm">
              <TimePicker
                value={selectedTime}
                onChange={handleTimeChange}
                onClose={() => setShowTimePicker(false)}
                isDarkMode={isDarkMode}
              />
            </View>
          </View>
        </Modal>
      )}
    </ScreenLayout>
  );
}
