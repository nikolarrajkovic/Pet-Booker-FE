import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import DatePicker from '../../../components/shared/DatePicker';
import TimePicker from '../../../components/shared/TimePicker';
import { PetSelector, BookingSummary } from '../components';
import { getServices, ServiceDto } from '../../../services/services';
import { getPets } from '../../../services/pets';
import { resolveImageUrl, ProviderViewModel } from '../../../services/service-providers';

type BookServiceRouteParams = { provider: ProviderViewModel };

const servicePrice = (s: ServiceDto) => s.price ?? s.basePrice;

// Add-ons. Pickup/Drop-off use the selected service's real surcharges when it
// supports them; Photo Updates / Detailed Report are mock-priced and not
// persisted per booking (see BACKEND_GAPS B2 — bookings don't record add-ons).
type AddonDef = { id: string; name: string; description: string; kind: 'pickup' | 'leaveOver' | 'mock'; mockPrice: number };
const ADDONS: AddonDef[] = [
  { id: 'pickup', name: 'Pet Pickup', description: "We'll pick up your pet from your location", kind: 'pickup', mockPrice: 15 },
  { id: 'dropoff', name: 'Pet Drop-off', description: "We'll drop off your pet after the service", kind: 'leaveOver', mockPrice: 15 },
  { id: 'photos', name: 'Photo Updates', description: 'Receive photos during the service', kind: 'mock', mockPrice: 5 },
  { id: 'report', name: 'Detailed Report', description: 'Get a comprehensive report after service', kind: 'mock', mockPrice: 8 },
];

type Appointment = {
  id: number;
  service: { id: number; name: string; price: number };
  pet: { id: number; name: string; image: string };
  addons: { name: string; price: number }[];
  bookingFrom: string;
  bookingTo: string;
  total: number;
};

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
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [startDateTime, setStartDateTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [svc, petList] = await Promise.all([
          getServices({ serviceProviderId: provider.id }),
          currentUser?.id ? getPets(currentUser.id) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setServices(svc);
        setPets(petList.map((p) => ({
          id: Number(p.id),
          name: p.name,
          breed: p.breed || p.type || '',
          image: p.photoUrl ? resolveImageUrl(p.photoUrl) : resolveImageUrl(p.photos?.[0]?.src),
        })));
      } catch (e) {
        console.warn('[BookServiceScreen] load failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [provider.id, currentUser?.id]);

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  const addonPrice = (addon: AddonDef): number => {
    if (addon.kind === 'pickup') return selectedService?.details?.pickupPriceSurcharge ?? addon.mockPrice;
    if (addon.kind === 'leaveOver') return selectedService?.details?.leaveOverPriceSurcharge ?? addon.mockPrice;
    return addon.mockPrice;
  };

  const toggleAddon = (id: string) =>
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const currentTotal = () => {
    if (!selectedService) return 0;
    const addons = selectedAddons.reduce((sum, id) => {
      const def = ADDONS.find((a) => a.id === id);
      return sum + (def ? addonPrice(def) : 0);
    }, 0);
    return servicePrice(selectedService) + addons;
  };

  const selectionComplete = !!selectedService && !!startDateTime && selectedPet !== null;

  const buildAppointment = (): Appointment | null => {
    if (!selectedService || !startDateTime || selectedPet === null) return null;
    const pet = pets.find((p) => p.id === selectedPet);
    return {
      id: Date.now(),
      service: { id: selectedService.id ?? 0, name: selectedService.name ?? 'Service', price: servicePrice(selectedService) },
      pet: { id: selectedPet, name: pet?.name ?? 'Pet', image: pet?.image ?? '' },
      addons: selectedAddons.map((id) => {
        const def = ADDONS.find((a) => a.id === id)!;
        return { name: def.name, price: addonPrice(def) };
      }),
      bookingFrom: startDateTime.toISOString(),
      bookingTo: new Date(startDateTime.getTime() + 60 * 60 * 1000).toISOString(), // +1h default
      total: currentTotal(),
    };
  };

  const resetSelection = () => {
    setSelectedServiceId(null);
    setSelectedAddons([]);
    setStartDateTime(null);
    setSelectedPet(null);
  };

  const addAppointment = () => {
    const apt = buildAppointment();
    if (!apt) return;
    setAppointments((prev) => [...prev, apt]);
    resetSelection();
  };

  const removeAppointment = (id: number) => setAppointments((prev) => prev.filter((a) => a.id !== id));

  const grandTotal = appointments.reduce((sum, a) => sum + a.total, 0);

  const onContinue = () => {
    const current = [...appointments];
    const apt = buildAppointment();
    if (apt) current.push(apt);
    if (current.length === 0) return;
    (navigation as any).navigate('ReviewBooking', { provider, appointments: current });
  };

  const stepDot = (done: boolean, n: number) => (
    <View className={`w-6 h-6 rounded-full items-center justify-center ${done ? 'bg-brand-500' : 'bg-gray-300'}`}>
      {done ? <Ionicons name="checkmark" size={16} color="white" /> : <Text className="text-white text-xs font-bold">{n}</Text>}
    </View>
  );

  const canContinue = selectionComplete || appointments.length > 0;

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

          {/* Step 2: Additional Services */}
          <View className={`px-6 py-5 border-t ${borderColor}`}>
            <View className="flex-row items-center mb-4">
              {stepDot(selectedAddons.length > 0, 2)}
              <Text className={`text-base font-semibold ${textColor} ml-3`}>Additional Services</Text>
              <Text className={`text-sm ${subtextColor} ml-2`}>Optional</Text>
            </View>
            {ADDONS.map((addon) => (
              <TouchableOpacity
                key={addon.id}
                onPress={() => toggleAddon(addon.id)}
                className={`mb-3 rounded-2xl p-4 border-2 ${
                  selectedAddons.includes(addon.id)
                    ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                    : `${borderColor} ${cardBg}`
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${textColor}`}>{addon.name}</Text>
                    <Text className={`text-sm ${subtextColor} mt-1`}>{addon.description}</Text>
                  </View>
                  <Text className="text-lg font-bold text-brand-600 ml-4">${addonPrice(addon)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Step 3: Choose Date & Time */}
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

          {/* Add This / Add Another Appointment */}
          {selectionComplete && (
            <View className="px-6 py-4">
              <TouchableOpacity
                onPress={addAppointment}
                className="bg-brand-500 py-4 rounded-2xl items-center flex-row justify-center"
              >
                <Ionicons name="add" size={20} color="white" />
                <Text className="text-white text-base font-bold ml-2">
                  {appointments.length === 0 ? 'Add This Appointment' : 'Add Another Appointment'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Added Appointments */}
          {appointments.length > 0 && (
            <View className="px-6 py-5">
              <Text className={`text-base font-semibold ${textColor} mb-4`}>Added Appointments ({appointments.length})</Text>
              {appointments.map((apt) => (
                <View key={apt.id} className={`${cardBg} border ${borderColor} rounded-2xl p-4 mb-3`}>
                  <View className="flex-row items-start">
                    {apt.pet.image ? (
                      <Image source={{ uri: apt.pet.image }} className="w-16 h-16 rounded-xl mr-3" resizeMode="cover" />
                    ) : (
                      <View className={`w-16 h-16 rounded-xl mr-3 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
                        <Ionicons name="paw" size={26} color="#9CA3AF" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className={`text-base font-semibold ${textColor}`}>
                        {apt.service.name} <Text className={`${subtextColor} font-normal`}>for {apt.pet.name}</Text>
                      </Text>
                      <Text className={`text-sm ${subtextColor} mt-1`}>
                        {new Date(apt.bookingFrom).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                        {new Date(apt.bookingFrom).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      {apt.addons.length > 0 && (
                        <Text className={`text-xs ${subtextColor} mt-1`}>+ {apt.addons.map((a) => a.name).join(', ')}</Text>
                      )}
                    </View>
                    <View className="items-end ml-2">
                      <Text className="text-lg font-bold text-brand-600">${apt.total}</Text>
                      <TouchableOpacity onPress={() => removeAppointment(apt.id)} className="mt-2">
                        <Ionicons name="close" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Booking Summary */}
          {appointments.length > 0 && (
            <BookingSummary
              appointments={appointments}
              grandTotal={grandTotal}
              isDarkMode={isDarkMode}
              textColor={textColor}
              subtextColor={subtextColor}
            />
          )}

          {/* Running total for the current (unadded) selection */}
          {appointments.length === 0 && selectedService && (
            <View className={`px-6 py-5 border-t ${borderColor} flex-row items-center justify-between`}>
              <Text className={`text-base font-semibold ${textColor}`}>Total</Text>
              <Text className="text-2xl font-bold text-brand-600">${currentTotal()}</Text>
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
