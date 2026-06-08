import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { CalendarPicker, PetSelector, BookingSummary } from '../components';

type BookServiceRouteParams = {
  provider: {
    id: number;
    name: string;
    service: string;
    rating: number;
    reviews: number;
    distance: string;
    price: number;
    image: string;
    verified: boolean;
    latitude: number;
    longitude: number;
  };
};

const serviceOptions = [
  { id: 'half-day', name: 'Half Day', price: 35, duration: '4 hours', description: 'Morning or afternoon care' },
  { id: 'full-day', name: 'Full Day', price: 75, duration: '8 hours', description: 'All-day pet care' },
  { id: 'overnight', name: 'Overnight', price: 115, duration: '24 hours', description: 'Full day and night care' },
];

const additionalServices = [
  { id: 'pickup', name: 'Pet Pickup', price: 15, description: "We'll pick up your pet from your location" },
  { id: 'dropoff', name: 'Pet Drop-off', price: 15, description: "We'll drop off your pet after the service" },
  { id: 'photos', name: 'Photo Updates', price: 5, description: 'Receive photos during the service' },
  { id: 'report', name: 'Detailed Report', price: 8, description: 'Get a comprehensive report after service' },
];

const mockPets = [
  { id: 1, name: 'Max', breed: 'Golden Retriever', image: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=300' },
  { id: 2, name: 'Luna', breed: 'Persian', image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=300' },
];

const generateCalendar = () => {
  const days = [];
  const currentDate = new Date(2025, 10, 1);
  const daysInMonth = 30;
  const firstDay = currentDate.getDay();
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
};

const timeSlots = [
  { id: '09:00', time: '09:00 AM', available: true },
  { id: '10:00', time: '10:00 AM', available: true },
  { id: '11:00', time: '11:00 AM', available: false },
  { id: '12:00', time: '12:00 PM', available: true },
  { id: '13:00', time: '01:00 PM', available: true },
  { id: '14:00', time: '02:00 PM', available: false },
  { id: '15:00', time: '03:00 PM', available: true },
  { id: '16:00', time: '04:00 PM', available: true },
  { id: '17:00', time: '05:00 PM', available: true },
];

export default function BookServiceScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: BookServiceRouteParams }, 'params'>>();
  const { provider } = route.params;
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor, borderColor } = useThemeColors();

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';

  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);

  const calendarDays = generateCalendar();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleAdditionalService = (serviceId: string) => {
    setSelectedAdditionalServices(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const calculateSingleAppointmentTotal = () => {
    let total = 0;
    const service = serviceOptions.find(s => s.id === selectedService);
    if (service) total += service.price;
    selectedAdditionalServices.forEach(serviceId => {
      const addon = additionalServices.find(s => s.id === serviceId);
      if (addon) total += addon.price;
    });
    return total;
  };

  const addAppointment = () => {
    if (!selectedService || !selectedDate || !selectedTime || !selectedPet) return;

    const service = serviceOptions.find(s => s.id === selectedService);
    const pet = mockPets.find(p => p.id === selectedPet);
    const addons = selectedAdditionalServices.map(id =>
      additionalServices.find(s => s.id === id)
    ).filter(Boolean);

    const appointment = {
      id: Date.now(),
      service,
      pet,
      date: selectedDate,
      time: selectedTime,
      addons,
      total: calculateSingleAppointmentTotal(),
    };

    setAppointments(prev => [...prev, appointment]);
    setSelectedService('');
    setSelectedAdditionalServices([]);
    setSelectedDate(null);
    setSelectedTime('');
    setSelectedPet(null);
  };

  const removeAppointment = (id: number) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const calculateGrandTotal = () => {
    return appointments.reduce((sum, apt) => sum + apt.total, 0);
  };

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

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Step 1: Choose Service */}
        <View className="px-6 py-5">
          <View className="flex-row items-center mb-4">
            <View className={`w-6 h-6 rounded-full items-center justify-center ${selectedService ? 'bg-brand-500' : 'bg-gray-300'}`}>
              {selectedService ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : (
                <Text className="text-white text-xs font-bold">1</Text>
              )}
            </View>
            <Text className={`text-base font-semibold ${textColor} ml-3`}>Choose Service</Text>
          </View>

          {serviceOptions.map(service => (
            <TouchableOpacity
              key={service.id}
              onPress={() => setSelectedService(service.id)}
              className={`mb-3 rounded-2xl p-4 border-2 ${
                selectedService === service.id
                  ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                  : `${borderColor} ${cardBg}`
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className={`text-base font-semibold ${textColor}`}>{service.name}</Text>
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="time-outline" size={14} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                    <Text className={`text-sm ${subtextColor} ml-1`}>{service.duration}</Text>
                  </View>
                  <Text className={`text-sm ${subtextColor} mt-1`}>{service.description}</Text>
                </View>
                <Text className="text-xl font-bold text-brand-600 ml-4">${service.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 2: Additional Services */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <View className="flex-row items-center mb-4">
            <View className={`w-6 h-6 rounded-full items-center justify-center ${selectedAdditionalServices.length > 0 ? 'bg-brand-500' : 'bg-gray-300'}`}>
              {selectedAdditionalServices.length > 0 ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : (
                <Text className="text-white text-xs font-bold">2</Text>
              )}
            </View>
            <Text className={`text-base font-semibold ${textColor} ml-3`}>Additional Services</Text>
            <Text className={`text-sm ${subtextColor} ml-2`}>Optional</Text>
          </View>

          {additionalServices.map(service => (
            <TouchableOpacity
              key={service.id}
              onPress={() => toggleAdditionalService(service.id)}
              className={`mb-3 rounded-2xl p-4 border-2 ${
                selectedAdditionalServices.includes(service.id)
                  ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                  : `${borderColor} ${cardBg}`
              }`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className={`text-base font-semibold ${textColor}`}>{service.name}</Text>
                  <Text className={`text-sm ${subtextColor} mt-1`}>{service.description}</Text>
                </View>
                <Text className="text-lg font-bold text-brand-600 ml-4">${service.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 3: Choose Date & Time */}
        <CalendarPicker
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedTime={selectedTime}
          setSelectedTime={setSelectedTime}
          calendarDays={calendarDays}
          weekDays={weekDays}
          timeSlots={timeSlots}
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          borderColor={borderColor}
        />

        {/* Step 4: Select Pet */}
        <PetSelector
          selectedPet={selectedPet}
          onSelectPet={setSelectedPet}
          pets={mockPets}
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          cardBg={cardBg}
          borderColor={borderColor}
        />

        {/* Add This Appointment Button */}
        {selectedService && selectedDate && selectedTime && selectedPet && appointments.length === 0 && (
          <View className="px-6 py-4">
            <TouchableOpacity
              onPress={addAppointment}
              className="bg-brand-500 py-4 rounded-2xl items-center flex-row justify-center"
            >
              <Ionicons name="add" size={20} color="white" />
              <Text className="text-white text-base font-bold ml-2">Add This Appointment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add Another Appointment Button */}
        {appointments.length > 0 && (
          <View className="px-6 py-4">
            <TouchableOpacity
              onPress={() => {}}
              className="bg-brand-500 py-4 rounded-2xl items-center flex-row justify-center"
            >
              <Ionicons name="add" size={20} color="white" />
              <Text className="text-white text-base font-bold ml-2">Add Another Appointment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Added Appointments */}
        {appointments.length > 0 && (
          <View className="px-6 py-5">
            <Text className={`text-base font-semibold ${textColor} mb-4`}>Added Appointments ({appointments.length})</Text>
            {appointments.map(apt => (
              <View key={apt.id} className={`${cardBg} border ${borderColor} rounded-2xl p-4 mb-3`}>
                <View className="flex-row items-start">
                  <Image source={{ uri: apt.pet.image }} className="w-16 h-16 rounded-xl mr-3" resizeMode="cover" />
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${textColor}`}>
                      {apt.service.name} <Text className={`${subtextColor} font-normal`}>for {apt.pet.name}</Text>
                    </Text>
                    <Text className={`text-sm ${subtextColor} mt-1`}>
                      Wed, Nov {apt.date} at {timeSlots.find(t => t.id === apt.time)?.time}
                    </Text>
                    {apt.addons.length > 0 && (
                      <Text className={`text-xs ${subtextColor} mt-1`}>+ {apt.addons.map((a: any) => a.name).join(', ')}</Text>
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
            grandTotal={calculateGrandTotal()}
            isDarkMode={isDarkMode}
            textColor={textColor}
            subtextColor={subtextColor}
          />
        )}
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className={`absolute bottom-0 left-0 right-0 ${cardBg} border-t ${borderColor} px-6 py-4`}>
        <TouchableOpacity
          disabled={!selectedService || !selectedDate || !selectedTime || !selectedPet}
          onPress={() => {
            const currentAppointments = [...appointments];
            if (selectedService && selectedDate && selectedTime && selectedPet) {
              const service = serviceOptions.find(s => s.id === selectedService);
              const pet = mockPets.find(p => p.id === selectedPet);
              const addons = selectedAdditionalServices.map(id =>
                additionalServices.find(s => s.id === id)
              ).filter(Boolean);
              currentAppointments.push({
                id: Date.now(),
                service,
                pet,
                date: selectedDate,
                time: selectedTime,
                addons,
                total: calculateSingleAppointmentTotal(),
              });
            }
            (navigation as any).navigate('ReviewBooking', { provider, appointments: currentAppointments });
          }}
          className={`py-4 rounded-2xl items-center ${
            selectedService && selectedDate && selectedTime && selectedPet ? 'bg-brand-400' : 'bg-gray-300'
          }`}
        >
          <Text className="text-white text-lg font-bold">Continue to Review</Text>
        </TouchableOpacity>
      </View>
    </ScreenLayout>
  );
}
