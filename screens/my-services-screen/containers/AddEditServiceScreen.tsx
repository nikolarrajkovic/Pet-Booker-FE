import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Modal, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import TimePicker from '../../../components/shared/TimePicker';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { createService, updateService, ServiceDto } from '../../../services/services';
import { getMyProvider } from '../../../services/service-providers';
import { serviceDtoToUi, uiToServiceDto } from '../serviceModel';

const SERVICE_TYPES = ['Dog Walking', 'Dog Boarding', 'Cat Sitting', 'Pet Hotels', 'Dog Sitting'];

const DURATION_OPTIONS = [
  '30 minutes',
  '1 hour',
  '1.5 hours',
  '2 hours',
  '3 hours',
  '4 hours',
  'Full day',
  'Overnight',
];

const ALL_ADDITIONAL_SERVICE_NAMES = [
  'Pickup',
  'Drop-off',
  'Photo Updates',
  'Medication Administration',
  'Special Needs Care',
];

interface PricingTier {
  duration: string;
  price: string;
}

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
  additionalServices: { name: string; price: string; enabled: boolean }[];
  workingHours: WorkingHours;
  images?: string[];
}

type AddEditServiceParams = {
  mode?: 'add' | 'edit';
  serviceDto?: ServiceDto;       // present in edit mode (the real record)
  serviceProviderId?: number;    // the partner's provider id
};

const DEFAULT_WORKING_HOURS: WorkingHours = {
  Monday: { enabled: false, startTime: '09:00 AM', endTime: '05:00 PM' },
  Tuesday: { enabled: false, startTime: '09:00 AM', endTime: '05:00 PM' },
  Wednesday: { enabled: false, startTime: '09:00 AM', endTime: '05:00 PM' },
  Thursday: { enabled: false, startTime: '09:00 AM', endTime: '05:00 PM' },
  Friday: { enabled: false, startTime: '09:00 AM', endTime: '05:00 PM' },
  Saturday: { enabled: false, startTime: '09:00 AM', endTime: '05:00 PM' },
  Sunday: { enabled: false, startTime: '09:00 AM', endTime: '05:00 PM' },
};

function getInitialAdditionalServices(existing?: ExistingService): AdditionalService[] {
  if (existing?.additionalServices) {
    const enabledMap = new Map(
      existing.additionalServices
        .filter(s => s.enabled)
        .map(s => [s.name, s.price])
    );
    return ALL_ADDITIONAL_SERVICE_NAMES.map(name => ({
      name,
      price: enabledMap.get(name) || '',
      expanded: enabledMap.has(name),
    }));
  }
  return ALL_ADDITIONAL_SERVICE_NAMES.map(name => ({
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

  const { isDarkMode, cardBg, textColor, subtextColor, inputBg, inputText, borderColor, placeholderColor } =
    useThemeColors();

  // Resolve the provider id (passed in, or looked up as a fallback)
  const [serviceProviderId, setServiceProviderId] = useState<number | null>(params?.serviceProviderId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (serviceProviderId == null && currentUser?.id) {
      getMyProvider(currentUser.id).then((p) => setServiceProviderId(p?.id ?? null)).catch(() => {});
    }
  }, [serviceProviderId, currentUser?.id]);

  const [serviceType, setServiceType] = useState(existingService?.type || '');
  const [showServiceTypeModal, setShowServiceTypeModal] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationModalIndex, setDurationModalIndex] = useState(0);
  const [serviceName, setServiceName] = useState(existingService?.name || '');
  const [description, setDescription] = useState(existingService?.description || '');
  const [serviceImages, setServiceImages] = useState<string[]>(existingService?.images || []);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(
    existingService?.pricingTiers || [{ duration: '', price: '' }]
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerDay, setTimePickerDay] = useState<string | null>(null);
  const [timePickerType, setTimePickerType] = useState<'start' | 'end'>('start');
  const [selectedTime, setSelectedTime] = useState(new Date());
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
    const newEnabled = !workingHours[day].enabled;
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: newEnabled }
    }));

    if (newEnabled) {
      setTimePickerDay(day);
      setTimePickerType('start');
      const [hours, minutesPart] = workingHours[day].startTime.split(':');
      const [minutes, period] = minutesPart.split(' ');
      const hour24 = period === 'PM' && hours !== '12' ? parseInt(hours) + 12 : (period === 'AM' && hours === '12' ? 0 : parseInt(hours));
      const date = new Date();
      date.setHours(hour24, parseInt(minutes), 0, 0);
      setSelectedTime(date);
      setShowTimePicker(true);
    }
  };

  const openTimePicker = (day: string, type: 'start' | 'end') => {
    setTimePickerDay(day);
    setTimePickerType(type);
    const timeStr = type === 'start' ? workingHours[day].startTime : workingHours[day].endTime;
    const [hours, minutesPart] = timeStr.split(':');
    const [minutes, period] = minutesPart.split(' ');
    const hour24 = period === 'PM' && hours !== '12' ? parseInt(hours) + 12 : (period === 'AM' && hours === '12' ? 0 : parseInt(hours));
    const date = new Date();
    date.setHours(hour24, parseInt(minutes), 0, 0);
    setSelectedTime(date);
    setShowTimePicker(true);
  };

  const handleTimeChange = (date: Date) => {
    if (!timePickerDay) return;
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    setWorkingHours(prev => ({
      ...prev,
      [timePickerDay]: {
        ...prev[timePickerDay],
        [timePickerType === 'start' ? 'startTime' : 'endTime']: formattedTime
      }
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
    setServiceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPhoto = () => {
    // Placeholder — in a real app this would open an image picker
    Alert.alert('Add Photo', 'Image picker integration coming soon.');
  };

  const handlePreview = () => {
    const serviceData = {
      name: serviceName,
      type: serviceType,
      description,
      price: parseFloat(pricingTiers[0]?.price) || 0,
      duration: pricingTiers[0]?.duration || '',
      additionalServices: {
        pickup: additionalServices[0].expanded ? (parseFloat(additionalServices[0].price) || 0) : undefined,
        dropOff: additionalServices[1].expanded ? (parseFloat(additionalServices[1].price) || 0) : undefined,
        photoUpdates: additionalServices[2].expanded ? (parseFloat(additionalServices[2].price) || 0) : undefined,
        medicationAdmin: additionalServices[3].expanded ? (parseFloat(additionalServices[3].price) || 0) : undefined,
        specialNeeds: additionalServices[4].expanded ? (parseFloat(additionalServices[4].price) || 0) : undefined,
      },
      workingHours,
      isNew: !isEdit,
    };

    (navigation as any).navigate('ServicePreview', { service: serviceData });
  };

  const handleSave = async () => {
    if (!serviceType || !serviceName || !description) {
      Alert.alert('Missing Information', 'Please fill in Service Type, Service Name, and Description.');
      return;
    }
    if (serviceProviderId == null) {
      Alert.alert('No provider profile', 'Could not determine your provider profile. Please try again.');
      return;
    }
    setIsSaving(true);
    try {
      // Only API-backed fields persist; pricing tiers beyond the first, working
      // hours, and extra add-ons are UI-only (see BACKEND_GAPS.md: S1, S2, S3, S4).
      const dto = uiToServiceDto({
        serviceProviderId,
        id: params?.serviceDto?.id ?? undefined,
        serviceName,
        description,
        pricingTiers,
        additionalServices,
        existingPhotos: params?.serviceDto?.photos,
      });
      if (isEdit && params?.serviceDto?.id != null) {
        await updateService(params.serviceDto.id, dto);
      } else {
        await createService(dto);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const anyDayEnabled = Object.values(workingHours).some(day => day.enabled);

  const previewButton = (
    <TouchableOpacity onPress={handlePreview}>
      <Text className="text-white font-semibold">Preview</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenLayout
      showBackButton
      headerTitle={isEdit ? 'Edit Service' : 'Add New Service'}
      headerSubtitle={isEdit ? 'Update your service details' : 'Create a new service listing'}
      rightAction={previewButton}
      contentBg={isDarkMode ? 'bg-[#0f1621]' : 'bg-white'}
    >
      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        {/* Service Type */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Service Type *</Text>
          <TouchableOpacity
            onPress={() => setShowServiceTypeModal(true)}
            className={`${inputBg} rounded-xl px-4 py-3 flex-row items-center justify-between`}
          >
            <Text className={serviceType ? textColor : `${subtextColor}`}>
              {serviceType || 'Select a service type'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
        </View>

        {/* Service Name */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Service Name *</Text>
          <TextInput
            placeholder="e.g., Premium Dog Walking in Central Park"
            placeholderTextColor={placeholderColor}
            className={`${inputBg} rounded-xl px-4 py-3 ${inputText}`}
            value={serviceName}
            onChangeText={setServiceName}
          />
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Description *</Text>
          <TextInput
            placeholder="Describe your service, experience, and what makes you special..."
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
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Service Images</Text>
          <Text className={`${subtextColor} text-sm mb-3`}>
            Add photos of your workspace, previous clients' pets, or yourself
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {serviceImages.map((img, index) => (
              <View key={index} className="relative" style={{ width: 80, height: 80 }}>
                <Image
                  source={{ uri: img }}
                  style={{ width: 80, height: 80, borderRadius: 12 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => removeImage(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full items-center justify-center"
                  style={{ elevation: 3 }}
                >
                  <Ionicons name="close" size={12} color="white" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={handleAddPhoto}
              className={`${inputBg} border ${borderColor} border-dashed rounded-xl items-center justify-center`}
              style={{ width: 80, height: 80 }}
            >
              <Ionicons name="camera-outline" size={24} color="#6B7280" />
              <Text className={`${subtextColor} text-xs mt-1`}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pricing & Duration */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-2`}>Pricing & Duration *</Text>
          {pricingTiers.map((tier, index) => (
            <View key={index} className="flex-row items-center mb-3" style={{ gap: 8 }}>
              {/* Duration picker */}
              <TouchableOpacity
                onPress={() => {
                  setDurationModalIndex(index);
                  setShowDurationModal(true);
                }}
                className={`${inputBg} rounded-xl px-3 py-3 flex-row items-center justify-between flex-1`}
              >
                <Text className={`${tier.duration ? inputText : subtextColor} text-sm`} numberOfLines={1}>
                  {tier.duration || 'Duration'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>

              {/* Price input — flex-1 fills remaining space before Remove */}
              <View className={`${inputBg} rounded-xl px-3 py-3 flex-row items-center flex-1`}>
                <Text className={subtextColor}>$</Text>
                <TextInput
                  placeholder="25"
                  placeholderTextColor={placeholderColor}
                  className={`${inputText} ml-1 text-sm flex-1`}
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
                <TouchableOpacity onPress={() => removePricingTier(index)} style={{ width: 56, alignItems: 'flex-end' }}>
                  <Text className="text-red-500 text-sm font-medium">Remove</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: 56 }} />
              )}
            </View>
          ))}
          <TouchableOpacity
            onPress={addPricingTier}
            className="items-center py-3 rounded-xl"
            style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: isDarkMode ? '#374151' : '#D1D5DB' }}
          >
            <View className="flex-row items-center">
              <Ionicons name="add-circle-outline" size={20} color="#00C870" />
              <Text className="text-brand-500 font-semibold ml-2">Add Another Price Tier</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Additional Services */}
        <View className="mb-4">
          <Text className={`text-sm font-semibold ${textColor} mb-1`}>Additional Services Offered</Text>
          <Text className={`${subtextColor} text-sm mb-3`}>Select services and set pricing (enter 0 for free)</Text>

          {additionalServices.map((service, index) => (
            <View key={index}>
              {!service.expanded ? (
                <TouchableOpacity
                  onPress={() => toggleAdditionalService(index)}
                  className={`${cardBg} border ${borderColor} rounded-xl px-4 py-3 mb-2`}
                >
                  <Text className={textColor}>{service.name}</Text>
                </TouchableOpacity>
              ) : (
                <View className={`${inputBg} border-2 border-brand-300 rounded-xl p-4 mb-3`}>
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className={`${textColor} font-medium`}>{service.name}</Text>
                    <TouchableOpacity onPress={() => toggleAdditionalService(index)}>
                      <Ionicons name="close" size={20} color={isDarkMode ? '#fff' : '#000'} />
                    </TouchableOpacity>
                  </View>
                  <Text className={`${subtextColor} text-sm mb-2`}>Price (enter 0 for free)</Text>
                  <View className={`${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'} rounded-xl px-4 py-3 flex-row items-center`}>
                    <Text className={subtextColor}>$</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={placeholderColor}
                      className={`${inputText} flex-1 ml-2`}
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
          <Text className={`text-sm font-semibold ${textColor} mb-1`}>Working Hours *</Text>
          <Text className={`${subtextColor} text-sm mb-3`}>Set your availability for each day</Text>

          {!anyDayEnabled && (
            <View className={`${inputBg} rounded-xl p-4 mb-3 flex-row items-center`}>
              <View className="w-2 h-2 bg-gray-400 rounded-full mr-3" />
              <View className="flex-1">
                <Text className={`${subtextColor} font-medium`}>Currently Unavailable</Text>
                <Text className={`${subtextColor} text-xs mt-1`}>Based on your schedule below</Text>
              </View>
            </View>
          )}

          {Object.entries(workingHours).map(([day, hours]) => (
            <View key={day}>
              <TouchableOpacity
                onPress={() => toggleWorkingDay(day)}
                className={`${cardBg} border ${borderColor} rounded-xl px-4 py-3 mb-2 flex-row items-center justify-between`}
              >
                <Text className={textColor}>{day}</Text>
                <Switch
                  value={hours.enabled}
                  onValueChange={() => toggleWorkingDay(day)}
                  trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                  thumbColor={hours.enabled ? '#00C870' : '#f4f3f4'}
                />
              </TouchableOpacity>

              {hours.enabled && (
                <View className={`${inputBg} border-2 border-brand-300 rounded-xl p-4 mb-3 -mt-1`}>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className={`${subtextColor} text-sm mb-2`}>Start Time</Text>
                      <TouchableOpacity
                        onPress={() => openTimePicker(day, 'start')}
                        className={`${cardBg} border ${borderColor} rounded-xl px-4 py-3 flex-row items-center justify-between`}
                      >
                        <Text className={textColor}>{hours.startTime}</Text>
                        <Ionicons name="time-outline" size={20} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <View className="flex-1">
                      <Text className={`${subtextColor} text-sm mb-2`}>End Time</Text>
                      <TouchableOpacity
                        onPress={() => openTimePicker(day, 'end')}
                        className={`${cardBg} border ${borderColor} rounded-xl px-4 py-3 flex-row items-center justify-between`}
                      >
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
          className="bg-brand-500 py-4 rounded-2xl items-center mb-6 mt-4"
          style={{ opacity: isSaving ? 0.7 : 1 }}
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-bold">
              {isEdit ? 'Update Service' : 'Save Service'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Service Type Modal */}
      <Modal
        visible={showServiceTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowServiceTypeModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowServiceTypeModal(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <TouchableOpacity activeOpacity={1} className={`${cardBg} rounded-t-3xl`}>
            <View className="p-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className={`text-xl font-bold ${textColor}`}>Select Service Type</Text>
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
                  className={`py-4 border-b ${borderColor}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base ${textColor}`}>{type}</Text>
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
        onRequestClose={() => setShowDurationModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDurationModal(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <TouchableOpacity activeOpacity={1} className={`${cardBg} rounded-t-3xl`}>
            <View className="p-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className={`text-xl font-bold ${textColor}`}>Select Duration</Text>
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
                  className={`py-4 border-b ${borderColor}`}
                >
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
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View className="flex-1 bg-black/50 justify-center items-center px-6">
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
