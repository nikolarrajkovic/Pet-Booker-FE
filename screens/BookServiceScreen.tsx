import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

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

// Generate calendar days for November 2025
const generateCalendar = () => {
  const days = [];
  const currentDate = new Date(2025, 10, 1); // November 2025
  const daysInMonth = 30;
  const firstDay = currentDate.getDay(); // Day of week for Nov 1

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

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
  const { isDarkMode } = useTheme();

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-200';

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
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const selectPet = (petId: number) => {
    setSelectedPet(petId);
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
      total: calculateSingleAppointmentTotal()
    };

    setAppointments(prev => [...prev, appointment]);
    resetSelections();
  };

  const resetSelections = () => {
    setSelectedService('');
    setSelectedAdditionalServices([]);
    setSelectedDate(null);
    setSelectedTime('');
    setSelectedPet(null);
  };

  const removeAppointment = (id: number) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const calculateSingleAppointmentTotal = () => {
    let total = 0;
    
    // Add service price
    const service = serviceOptions.find(s => s.id === selectedService);
    if (service) {
      total += service.price;
    }

    // Add additional services
    selectedAdditionalServices.forEach(serviceId => {
      const addon = additionalServices.find(s => s.id === serviceId);
      if (addon) {
        total += addon.price;
      }
    });

    return total;
  };

  const calculateGrandTotal = () => {
    return appointments.reduce((sum, apt) => sum + apt.total, 0);
  };

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View className={`${bgColor} px-6 pt-12 pb-6`}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-4"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">Book Service</Text>
            <Text className={`${isDarkMode ? 'text-gray-300' : 'text-brand-100'} text-sm`}>{provider.name}</Text>
          </View>
        </View>
      </View>

      <ScrollView className={`flex-1 ${contentBg}`} contentContainerStyle={{ paddingBottom: 100 }}>
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
              {selectedAdditionalServices ? (
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
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <View className="flex-row items-center mb-4">
            <View className={`w-6 h-6 rounded-full items-center justify-center ${selectedDate && selectedTime ? 'bg-brand-500' : 'bg-gray-300'}`}>
              {selectedDate && selectedTime ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : (
                <Text className="text-white text-xs font-bold">3</Text>
              )}
            </View>
            <Text className={`text-base font-semibold ${textColor} ml-3`}>Choose Date & Time</Text>
          </View>

          {/* Calendar */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity>
                <Ionicons name="chevron-back" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
              <Text className={`text-base font-semibold ${textColor}`}>November 2025</Text>
              <TouchableOpacity>
                <Ionicons name="chevron-forward" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            {/* Week days header */}
            <View className="flex-row mb-2">
              {weekDays.map(day => (
                <View key={day} className="flex-1 items-center">
                  <Text className={`text-xs font-medium ${subtextColor}`}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View className="flex-row flex-wrap">
              {calendarDays.map((day, index) => (
                <View key={index} className="w-[14.28%] aspect-square p-1">
                  {day !== null ? (
                    <TouchableOpacity
                      onPress={() => setSelectedDate(day)}
                      disabled={day < 26}
                      className={`flex-1 items-center justify-center rounded-full ${
                        selectedDate === day
                          ? 'bg-brand-500'
                          : day < 26
                          ? 'bg-transparent'
                          : 'bg-transparent'
                      }`}
                    >
                      <Text className={`text-sm ${
                        selectedDate === day
                          ? 'text-white font-bold'
                          : day < 26
                          ? isDarkMode ? 'text-gray-700' : 'text-gray-300'
                          : textColor
                      }`}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View className="flex-1" />
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Available Times - Only show if date is selected */}
          {selectedDate && (
            <View className="mt-4">
              <Text className={`text-base font-semibold ${textColor} mb-3`}>Available Times</Text>
              <View className="flex-row flex-wrap gap-2">
                {timeSlots.map(slot => (
                  <TouchableOpacity
                    key={slot.id}
                    onPress={() => slot.available && setSelectedTime(slot.id)}
                    disabled={!slot.available}
                    className={`px-6 py-3 rounded-xl ${
                      selectedTime === slot.id
                        ? 'bg-brand-500'
                        : slot.available
                        ? isDarkMode ? 'bg-[#243447]' : 'bg-gray-100'
                        : isDarkMode ? 'bg-[#1a2332]' : 'bg-gray-50'
                    }`}
                  >
                    <Text className={`text-sm font-medium ${
                      selectedTime === slot.id
                        ? 'text-white'
                        : slot.available
                        ? 'text-brand-600'
                        : isDarkMode ? 'text-gray-700' : 'text-gray-300'
                    }`}>
                      {slot.time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Step 4: Select Pet */}
        <View className={`px-6 py-5 border-t ${borderColor}`}>
          <View className="flex-row items-center mb-4">
            <View className={`w-6 h-6 rounded-full items-center justify-center ${selectedPet ? 'bg-brand-500' : 'bg-gray-300'}`}>
              {selectedPet ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : (
                <Text className="text-white text-xs font-bold">4</Text>
              )}
            </View>
            <Text className={`text-base font-semibold ${textColor} ml-3`}>Select Pet</Text>
            <Text className={`text-sm ${subtextColor} ml-2`}>Select one or more pets</Text>
          </View>

          <View className="flex-row gap-3">
            {mockPets.map(pet => (
              <TouchableOpacity
                key={pet.id}
                onPress={() => selectPet(pet.id)}
                className={`flex-1 rounded-2xl p-4 border-2 ${
                  selectedPet === pet.id
                    ? `border-brand-500 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'}`
                    : `${borderColor} ${cardBg}`
                }`}
              >
                {pet.image ? (
                  <Image
                    source={{ uri: pet.image }}
                    className="w-full h-32 rounded-xl mb-3"
                    resizeMode="cover"
                  />
                ) : (
                  <View className={`w-full h-32 rounded-xl mb-3 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} items-center justify-center`}>
                    <Ionicons name="image-outline" size={40} color="#9CA3AF" />
                  </View>
                )}
                <Text className={`text-base font-semibold ${textColor}`}>{pet.name}</Text>
                <Text className={`text-sm ${subtextColor}`}>{pet.breed}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Add This Appointment Button - Shows after all steps completed */}
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

        {/* Add Another Appointment Button - Shows after first appointment */}
        {appointments.length > 0 && (
          <View className="px-6 py-4">
            <TouchableOpacity
              onPress={() => {/* Scroll to top logic can be added */}}
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
                  <Image
                    source={{ uri: apt.pet.image }}
                    className="w-16 h-16 rounded-xl mr-3"
                    resizeMode="cover"
                  />
                  <View className="flex-1">
                    <Text className={`text-base font-semibold ${textColor}`}>{apt.service.name} <Text className={`${subtextColor} font-normal`}>for {apt.pet.name}</Text></Text>
                    <Text className={`text-sm ${subtextColor} mt-1`}>Wed, Nov {apt.date} at {timeSlots.find(t => t.id === apt.time)?.time}</Text>
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
          <View className={`px-6 py-5 ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} mx-6 rounded-2xl mb-4`}>
            <Text className={`text-base font-semibold ${textColor} mb-3`}>Booking Summary</Text>
            {appointments.map((apt, index) => (
              <View key={apt.id} className="mb-3">
                <View className="flex-row justify-between items-center">
                  <Text className={`text-sm font-medium ${subtextColor}`}>Appointment {index + 1}:</Text>
                  <Text className={`text-sm font-medium ${textColor}`}>{apt.pet.name}</Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className={`text-sm ${subtextColor}`}>{apt.service.name}</Text>
                  <Text className={`text-sm ${textColor}`}>${apt.service.price}</Text>
                </View>
                {apt.addons.length > 0 && (
                  <View className="flex-row justify-between mt-1">
                    <Text className={`text-xs ${subtextColor}`}>Add-ons</Text>
                    <Text className={`text-xs ${subtextColor}`}>${apt.addons.reduce((sum: number, a: any) => sum + a.price, 0)}</Text>
                  </View>
                )}
              </View>
            ))}
            <View className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-brand-200'} mt-2 pt-3 flex-row justify-between`}>
              <Text className={`text-base font-bold ${textColor}`}>Total:</Text>
              <Text className="text-2xl font-bold text-brand-600">${calculateGrandTotal()}</Text>
            </View>
          </View>
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
                total: calculateSingleAppointmentTotal()
              });
            }
            (navigation as any).navigate('ReviewBooking', { 
              provider, 
              appointments: currentAppointments 
            });
          }}
          className={`py-4 rounded-2xl items-center ${
            selectedService && selectedDate && selectedTime && selectedPet
              ? 'bg-brand-400'
              : 'bg-gray-300'
          }`}
        >
          <Text className="text-white text-lg font-bold">Continue to Review</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
