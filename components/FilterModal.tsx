import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useThemeColors } from '../hooks/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatePicker from './shared/DatePicker';
import TimePicker, { formatTime24 } from './shared/TimePicker';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterState) => void;
  currentFilters: FilterState;
}

export interface FilterState {
  serviceTypes: string[];
  date: string;
  time: string;
  petPickupAvailable: boolean;
  location: string;
  petTypes: string[];
  petSizes: string[];
  priceRange: [number, number];
  minimumRating: string;
}

const serviceTypes = ['Dog Sitting', 'Boarding', 'Pet Hotels'];
const petTypes = ['Dog', 'Cat', 'Bird', 'Other'];
const petSizes = ['Small (0-20 lbs)', 'Medium (21-50 lbs)', 'Large (51-100 lbs)', 'Extra Large (100+ lbs)'];
const ratingOptions = ['Any', '3+', '4+', '4.5+', '5+'];

export default function FilterModal({ visible, onClose, onApplyFilters, currentFilters }: FilterModalProps) {
  const { isDarkMode, bgColor, cardBg, textColor, subtextColor, borderColor, inputBg, inputText } = useThemeColors();
  const insets = useSafeAreaInsets();

  const placeholderColor = isDarkMode ? 'text-gray-500' : 'text-gray-400';

  const [filters, setFilters] = useState<FilterState>(currentFilters);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Update internal state when currentFilters prop changes
  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  const toggleServiceType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(type)
        ? prev.serviceTypes.filter(t => t !== type)
        : [...prev.serviceTypes, type]
    }));
  };

  const togglePetType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      petTypes: prev.petTypes.includes(type)
        ? prev.petTypes.filter(t => t !== type)
        : [...prev.petTypes, type]
    }));
  };

  const togglePetSize = (size: string) => {
    setFilters(prev => ({
      ...prev,
      petSizes: prev.petSizes.includes(size)
        ? prev.petSizes.filter(s => s !== size)
        : [...prev.petSizes, size]
    }));
  };

  const handleReset = () => {
    setFilters({
      serviceTypes: [],
      date: '',
      time: '',
      petPickupAvailable: false,
      location: '',
      petTypes: [],
      petSizes: [],
      priceRange: [0, 200],
      minimumRating: 'Any',
    });
    setSelectedDate(new Date());
    setSelectedTime(new Date());
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const onDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
      setFilters(prev => ({ ...prev, date: formattedDate }));
    } else {
      setFilters(prev => ({ ...prev, date: '' }));
    }
  };

  const onTimeChange = (time: Date) => {
    setSelectedTime(time);
    // 24-hour display, e.g. "08:00" / "18:30" / "24:00".
    setFilters(prev => ({ ...prev, time: formatTime24(time) }));
  };

  const handleUseMyLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        setLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      if (address[0]) {
        // Try to build the most complete address possible
        const streetNumber = address[0].streetNumber || address[0].name?.match(/^\d+/)?.[0];
        const parts = [
          streetNumber,
          address[0].street,
          address[0].city,
        ].filter(Boolean);
        const fullAddress = parts.join(', ');
        setFilters(prev => ({ ...prev, location: fullAddress }));
      }
    } catch (error) {
      alert('Failed to get location');
    } finally {
      setLoadingLocation(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View className="flex-1 justify-end" style={{ backgroundColor: isDarkMode ? '#0f1621' : '#ffffff' }}>
        <View className="absolute inset-0 bg-black/50" />
        <View className={`flex-1 ${bgColor} mt-16`}>
          {/* Header */}
          <View className={`flex-row items-center justify-between px-6 py-4 border-b ${borderColor}`}>
            <Text className={`text-xl font-bold ${textColor}`}>Filters</Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 items-center justify-center">
              <Ionicons name="close" size={24} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 py-4">
            {/* Service Type */}
            <View className="mb-6">
              <Text className={`text-base font-semibold ${textColor} mb-3`}>Service Type</Text>
              <View className="flex-row flex-wrap gap-2">
                {serviceTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => toggleServiceType(type)}
                    className={`px-4 py-2 rounded-full border ${
                      filters.serviceTypes.includes(type)
                        ? `${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} border-brand-500`
                        : `${cardBg} ${borderColor}`
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        filters.serviceTypes.includes(type) ? 'text-brand-600 font-medium' : subtextColor
                      }`}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date & Time */}
            <View className="mb-6">
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className={`text-base font-semibold ${textColor} mb-3`}>Date</Text>
                  <TouchableOpacity 
                    onPress={() => setShowDatePicker(true)}
                    className={`flex-row items-center border ${borderColor} ${inputBg} rounded-xl px-4 py-3`}
                  >
                    <Ionicons name="calendar-outline" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                    <Text className={`flex-1 ml-2 ${filters.date ? inputText : placeholderColor}`}>
                      {filters.date || 'mm/dd/yyyy'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-1">
                  <Text className={`text-base font-semibold ${textColor} mb-3`}>Time</Text>
                  <TouchableOpacity 
                    onPress={() => setShowTimePicker(true)}
                    className={`flex-row items-center border ${borderColor} ${inputBg} rounded-xl px-4 py-3`}
                  >
                    <Ionicons name="time-outline" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                    <Text className={`flex-1 ml-2 ${filters.time ? inputText : placeholderColor}`}>
                      {filters.time || '--:--'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Date Picker */}
              {showDatePicker && (
                <DatePicker
                  value={selectedDate}
                  minDate={new Date()}
                  isDarkMode={isDarkMode}
                  onChange={onDateChange}
                  onClose={() => setShowDatePicker(false)}
                />
              )}

              {/* Time Picker */}
              {showTimePicker && (
                <TimePicker
                  value={selectedTime}
                  isDarkMode={isDarkMode}
                  minDate={
                    selectedDate.getFullYear() === new Date().getFullYear() &&
                    selectedDate.getMonth() === new Date().getMonth() &&
                    selectedDate.getDate() === new Date().getDate()
                      ? new Date()
                      : undefined
                  }
                  onChange={onTimeChange}
                  onClose={() => setShowTimePicker(false)}
                />
              )}
            </View>

            {/* Pet Pickup Available */}
            <View className="mb-6">
              <View className={`flex-row items-center justify-between ${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} rounded-xl p-4`}>
                <View className="flex-row items-center flex-1">
                  <View className={`w-10 h-10 ${isDarkMode ? 'bg-[#1a2332]' : 'bg-white'} rounded-full items-center justify-center mr-3`}>
                    <Ionicons name="location" size={20} color="#00C870" />
                  </View>
                  <View className="flex-1">
                    <Text className={`text-sm font-semibold ${textColor}`}>Pet Pickup Available</Text>
                    <Text className={`text-xs ${subtextColor}`}>Provider offers pickup service</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setFilters(prev => ({ ...prev, petPickupAvailable: !prev.petPickupAvailable }))}
                  className={`w-12 h-7 rounded-full justify-center ${
                    filters.petPickupAvailable ? 'bg-brand-500' : 'bg-gray-300'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full bg-white ${
                      filters.petPickupAvailable ? 'ml-6' : 'ml-1'
                    }`}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Location */}
            <View className="mb-6">
              <Text className={`text-base font-semibold ${textColor} mb-3`}>Location</Text>
              <View className={`flex-row items-center border ${borderColor} ${inputBg} rounded-xl px-4 py-3 mb-2`}>
                <Ionicons name="location-outline" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                <TextInput
                  placeholder="Enter address"
                  placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
                  value={filters.location}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, location: text }))}
                  className={`flex-1 ml-2 ${inputText}`}
                />
              </View>
              <TouchableOpacity 
                onPress={handleUseMyLocation}
                disabled={loadingLocation}
                className="flex-row items-center"
              >
                {loadingLocation ? (
                  <>
                    <ActivityIndicator size="small" color="#00C870" />
                    <Text className="text-sm text-brand-600 ml-2 font-medium">Getting location...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="navigate" size={16} color="#00C870" />
                    <Text className="text-sm text-brand-600 ml-1 font-medium">Use my location</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Pet Type */}
            <View className="mb-6">
              <Text className={`text-base font-semibold ${textColor} mb-3`}>Pet Type</Text>
              <View className="flex-row flex-wrap gap-2">
                {petTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => togglePetType(type)}
                    className={`px-4 py-2 rounded-full border ${
                      filters.petTypes.includes(type)
                        ? `${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} border-brand-500`
                        : `${cardBg} ${borderColor}`
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        filters.petTypes.includes(type) ? 'text-brand-600 font-medium' : subtextColor
                      }`}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Pet Size */}
            <View className="mb-6">
              <Text className={`text-base font-semibold ${textColor} mb-3`}>Pet Size</Text>
              <View className="space-y-2">
                {petSizes.map((size) => (
                  <TouchableOpacity
                    key={size}
                    onPress={() => togglePetSize(size)}
                    className={`px-4 py-3 rounded-xl border ${
                      filters.petSizes.includes(size)
                        ? `${isDarkMode ? 'bg-[#243447]' : 'bg-brand-50'} border-brand-500`
                        : `${isDarkMode ? 'bg-[#243447]' : 'bg-gray-50'} border-transparent`
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        filters.petSizes.includes(size) ? 'text-brand-600 font-medium' : subtextColor
                      }`}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price Range */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className={`text-base font-semibold ${textColor}`}>Price Range</Text>
                <Text className="text-sm text-brand-600 font-medium">
                  ${filters.priceRange[0]} - ${filters.priceRange[1]}
                </Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={200}
                step={5}
                value={filters.priceRange[1]}
                onValueChange={(value) => setFilters(prev => ({ ...prev, priceRange: [prev.priceRange[0], value] }))}
                minimumTrackTintColor="#00C870"
                maximumTrackTintColor={isDarkMode ? '#374151' : '#E5E7EB'}
                thumbTintColor="#00C870"
              />
            </View>

            {/* Minimum Rating */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <Ionicons name="star" size={18} color="#F59E0B" />
                <Text className={`text-base font-semibold ${textColor} ml-2`}>Minimum Rating</Text>
                <Text className="text-sm text-brand-600 ml-auto font-medium">{filters.minimumRating}</Text>
              </View>
              <View className="flex-row gap-2">
                {ratingOptions.map((rating) => (
                  <TouchableOpacity
                    key={rating}
                    onPress={() => setFilters(prev => ({ ...prev, minimumRating: rating }))}
                    className={`flex-1 py-2 rounded-xl border ${
                      filters.minimumRating === rating
                        ? 'bg-brand-500 border-brand-500'
                        : `${cardBg} ${borderColor}`
                    }`}
                  >
                    <Text
                      className={`text-sm text-center font-medium ${
                        filters.minimumRating === rating ? 'text-white' : subtextColor
                      }`}
                    >
                      {rating}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="h-24" />
          </ScrollView>

          {/* Footer Buttons */}
          <View className={`flex-row gap-3 px-6 border-t ${borderColor} ${bgColor}`} style={{ paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
            <TouchableOpacity
              onPress={handleReset}
              className={`flex-1 py-3 rounded-xl border ${borderColor} ${cardBg} items-center`}
            >
              <Text className={`${subtextColor} font-semibold`}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleApply}
              className="flex-1 py-3 rounded-xl bg-brand-500 items-center"
            >
              <Text className="text-white font-semibold">Apply Filters</Text>
            </TouchableOpacity>
          </View>
          
          {/* Bottom safe area background */}
          <View style={{ 
            position: 'absolute',
            bottom: -100,
            left: 0,
            right: 0,
            height: 100,
            backgroundColor: isDarkMode ? '#0f1621' : '#ffffff'
          }} />
        </View>
      </View>
    </Modal>
  );
}
