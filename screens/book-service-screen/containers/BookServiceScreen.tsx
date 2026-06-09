import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import DatePicker from '../../../components/shared/DatePicker';
import TimePicker from '../../../components/shared/TimePicker';
import { PetSelector } from '../components';
import { getServices, ServiceDto } from '../../../services/services';
import { getPets } from '../../../services/pets';
import { resolveImageUrl, ProviderViewModel } from '../../../services/service-providers';

type BookServiceRouteParams = {
  provider: ProviderViewModel;
};

const servicePrice = (s: ServiceDto) => s.price ?? s.basePrice;

export default function BookServiceScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: BookServiceRouteParams }, 'params'>>();
  const { provider } = route.params;
  const { currentUser } = useAuth();
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor, borderColor } = useThemeColors();

  const [services, setServices] = useState<ServiceDto[]>([]);
  const [pets, setPets] = useState<{ id: number; name: string; breed: string; image: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [pickupSelected, setPickupSelected] = useState(false);
  const [leaveOverSelected, setLeaveOverSelected] = useState(false);
  const [startDateTime, setStartDateTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const [svc, petList] = await Promise.all([
          getServices({ serviceProviderId: provider.id }),
          currentUser?.id ? getPets(currentUser.id) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setServices(svc);
        setPets(
          petList.map((p) => ({
            id: Number(p.id),
            name: p.name,
            breed: p.breed || p.type || '',
            image: p.photoUrl ? resolveImageUrl(p.photoUrl) : resolveImageUrl(p.photos?.[0]?.src),
          })),
        );
      } catch (e) {
        console.warn('[BookServiceScreen] load failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [provider.id, currentUser?.id]);

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;
  const pickupSurcharge = selectedService?.details?.pickupPriceSurcharge ?? 0;
  const leaveOverSurcharge = selectedService?.details?.leaveOverPriceSurcharge ?? 0;

  const total =
    (selectedService ? servicePrice(selectedService) : 0) +
    (pickupSelected ? pickupSurcharge : 0) +
    (leaveOverSelected ? leaveOverSurcharge : 0);

  const canContinue = !!selectedService && !!startDateTime && selectedPet !== null;

  const onContinue = () => {
    if (!selectedService || !startDateTime || selectedPet === null) return;
    const pet = pets.find((p) => p.id === selectedPet);
    const bookingFrom = startDateTime.toISOString();
    const bookingTo = new Date(startDateTime.getTime() + 60 * 60 * 1000).toISOString(); // +1h default

    (navigation as any).navigate('ReviewBooking', {
      provider,
      booking: {
        serviceId: selectedService.id,
        serviceName: selectedService.name ?? 'Service',
        basePrice: selectedService.basePrice,
        price: servicePrice(selectedService),
        petId: selectedPet,
        petName: pet?.name ?? 'Pet',
        petImage: pet?.image ?? '',
        bookingFrom,
        bookingTo,
        pickup: pickupSelected,
        leaveOver: leaveOverSelected,
        pickupSurcharge,
        leaveOverSurcharge,
        total,
      },
    });
  };

  const stepDot = (done: boolean, n: number) => (
    <View className={`w-6 h-6 rounded-full items-center justify-center ${done ? 'bg-brand-500' : 'bg-gray-300'}`}>
      {done ? <Ionicons name="checkmark" size={16} color="white" /> : <Text className="text-white text-xs font-bold">{n}</Text>}
    </View>
  );

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      contentBg={contentBg}
      contentRounded={false}
      headerChildren={
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">Book Service</Text>
          <Text className={`${isDarkMode ? 'text-gray-300' : 'text-brand-100'} text-sm`}>{provider.name}</Text>
        </View>
      }
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#00C870" />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Step 1: Choose Service */}
          <View className="px-6 py-5">
            <View className="flex-row items-center mb-4">
              {stepDot(!!selectedService, 1)}
              <Text className={`text-base font-semibold ${textColor} ml-3`}>Choose Service</Text>
            </View>

            {services.length === 0 ? (
              <Text className={`text-sm ${subtextColor}`}>This provider has no services listed yet.</Text>
            ) : (
              services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  onPress={() => setSelectedServiceId(service.id ?? null)}
                  className={`mb-3 rounded-2xl p-4 border-2 ${
                    selectedServiceId === service.id
                      ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                      : `${borderColor} ${cardBg}`
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-4">
                      <Text className={`text-base font-semibold ${textColor}`}>{service.name ?? 'Service'}</Text>
                      {service.about || service.notes ? (
                        <Text className={`text-sm ${subtextColor} mt-1`}>{service.about ?? service.notes}</Text>
                      ) : null}
                    </View>
                    <Text className="text-xl font-bold text-brand-600">${servicePrice(service)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Step 2: Add-ons (only if the selected service supports them) */}
          {selectedService && (selectedService.details?.supportsPickup || selectedService.details?.supportsLeaveOver) && (
            <View className={`px-6 py-5 border-t ${borderColor}`}>
              <View className="flex-row items-center mb-4">
                {stepDot(pickupSelected || leaveOverSelected, 2)}
                <Text className={`text-base font-semibold ${textColor} ml-3`}>Add-ons</Text>
                <Text className={`text-sm ${subtextColor} ml-2`}>Optional</Text>
              </View>

              {selectedService.details?.supportsPickup && (
                <TouchableOpacity
                  onPress={() => setPickupSelected((v) => !v)}
                  className={`mb-3 rounded-2xl p-4 border-2 flex-row items-center justify-between ${
                    pickupSelected ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}` : `${borderColor} ${cardBg}`
                  }`}
                >
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${textColor}`}>Pet Pickup</Text>
                    <Text className={`text-sm ${subtextColor} mt-1`}>We collect your pet from your location</Text>
                  </View>
                  <Text className="text-lg font-bold text-brand-600 ml-4">+${pickupSurcharge}</Text>
                </TouchableOpacity>
              )}

              {selectedService.details?.supportsLeaveOver && (
                <TouchableOpacity
                  onPress={() => setLeaveOverSelected((v) => !v)}
                  className={`rounded-2xl p-4 border-2 flex-row items-center justify-between ${
                    leaveOverSelected ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}` : `${borderColor} ${cardBg}`
                  }`}
                >
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${textColor}`}>Leave-over Stay</Text>
                    <Text className={`text-sm ${subtextColor} mt-1`}>Your pet stays overnight</Text>
                  </View>
                  <Text className="text-lg font-bold text-brand-600 ml-4">+${leaveOverSurcharge}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Step 3: Date & Time */}
          <View className={`px-6 py-5 border-t ${borderColor}`}>
            <View className="flex-row items-center mb-4">
              {stepDot(!!startDateTime, 3)}
              <Text className={`text-base font-semibold ${textColor} ml-3`}>Choose Date & Time</Text>
            </View>

            <TouchableOpacity
              onPress={() => { setShowDatePicker((v) => !v); setShowTimePicker(false); }}
              className={`mb-3 rounded-2xl p-4 border ${borderColor} ${cardBg} flex-row items-center justify-between`}
            >
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={20} color="#00C870" />
                <Text className={`ml-3 ${startDateTime ? textColor : subtextColor}`}>
                  {startDateTime ? startDateTime.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : 'Select date'}
                </Text>
              </View>
              <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
            {showDatePicker && (
              <DatePicker
                value={startDateTime ?? new Date()}
                minDate={new Date()}
                isDarkMode={isDarkMode}
                onChange={(date) => {
                  if (date) {
                    const base = startDateTime ?? new Date();
                    const next = new Date(date);
                    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
                    setStartDateTime(next);
                  }
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            )}

            <TouchableOpacity
              onPress={() => { setShowTimePicker((v) => !v); setShowDatePicker(false); }}
              className={`rounded-2xl p-4 border ${borderColor} ${cardBg} flex-row items-center justify-between`}
            >
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={20} color="#00C870" />
                <Text className={`ml-3 ${startDateTime ? textColor : subtextColor}`}>
                  {startDateTime ? startDateTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Select time'}
                </Text>
              </View>
              <Ionicons name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
            {showTimePicker && (
              <TimePicker
                value={startDateTime ?? new Date()}
                isDarkMode={isDarkMode}
                onChange={(date) => setStartDateTime(date)}
                onClose={() => setShowTimePicker(false)}
              />
            )}
          </View>

          {/* Step 4: Select Pet */}
          {pets.length > 0 ? (
            <PetSelector
              selectedPet={selectedPet}
              onSelectPet={setSelectedPet}
              pets={pets}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
              cardBg={cardBg}
              borderColor={borderColor}
            />
          ) : (
            <View className={`px-6 py-5 border-t ${borderColor}`}>
              <View className="flex-row items-center mb-3">
                {stepDot(false, 4)}
                <Text className={`text-base font-semibold ${textColor} ml-3`}>Select Pet</Text>
              </View>
              <Text className={`text-sm ${subtextColor} mb-3`}>You don&apos;t have any pets yet.</Text>
              <TouchableOpacity
                onPress={() => (navigation as any).navigate('AddPet')}
                className="bg-brand-500 py-3 rounded-2xl items-center flex-row justify-center"
              >
                <Ionicons name="add" size={20} color="white" />
                <Text className="text-white font-bold ml-2">Add a Pet</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Running total */}
          {selectedService && (
            <View className={`px-6 py-5 border-t ${borderColor} flex-row items-center justify-between`}>
              <Text className={`text-base font-semibold ${textColor}`}>Total</Text>
              <Text className="text-2xl font-bold text-brand-600">${total}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Fixed Bottom Button */}
      <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          disabled={!canContinue}
          onPress={onContinue}
          className={`py-4 rounded-2xl items-center ${canContinue ? 'bg-brand-500' : 'bg-gray-300'}`}
        >
          <Text className="text-white text-lg font-bold">Continue to Review</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
