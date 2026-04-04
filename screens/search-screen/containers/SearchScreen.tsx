import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../components/shared/TabBar';
import Button from '../../../components/shared/Button';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FilterModal, { FilterState } from '../../../components/FilterModal';
import { useLocation } from '../../../hooks/useLocation';
import { useTheme } from '../../../context/ThemeContext';
import { ListView, MapViewComponent } from '../components';
// TEST FORCE REPARSE

type SearchRouteParams = {
  serviceType?: string;
};

const { height } = Dimensions.get('window');

// Mock provider data with coordinates - Pet care locations in Belgrade
const allProviders = [
  {
    id: 1,
    name: "Happy Paws Pet Sitting",
    service: 'Dog Sitting',
    rating: 4.9,
    reviews: 128,
    distance: '0.5 mi',
    price: 25,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300',
    verified: true,
    latitude: 44.8176,
    longitude: 20.4570,
  },
  {
    id: 2,
    name: "Pawsome Boarding Center",
    service: 'Boarding',
    rating: 4.8,
    reviews: 95,
    distance: '1.2 mi',
    price: 45,
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300',
    verified: true,
    latitude: 44.8125,
    longitude: 20.4612,
  },
  {
    id: 3,
    name: "Cozy Tails Pet Hotel",
    service: 'Pet Hotels',
    rating: 4.7,
    reviews: 86,
    distance: '2.1 mi',
    price: 35,
    image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300',
    verified: false,
    latitude: 44.8153,
    longitude: 20.4542,
  },
  {
    id: 4,
    name: "Fur-Ever Friends Sitting",
    service: 'Dog Sitting',
    rating: 4.9,
    reviews: 112,
    distance: '0.8 mi',
    price: 28,
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300',
    verified: true,
    latitude: 44.8029,
    longitude: 20.4698,
  },
  {
    id: 5,
    name: "Paws & Claws Boarding",
    service: 'Boarding',
    rating: 4.6,
    reviews: 73,
    distance: '1.5 mi',
    price: 38,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300',
    verified: true,
    latitude: 44.7935,
    longitude: 20.4298,
  },
  {
    id: 6,
    name: "Luxury Pet Paradise Resort",
    service: 'Pet Hotels',
    rating: 4.8,
    reviews: 142,
    distance: '3.2 mi',
    price: 55,
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300',
    verified: true,
    latitude: 44.8208,
    longitude: 20.4376,
  },
  {
    id: 7,
    name: "Wagging Tails Pet Care",
    service: 'Dog Sitting',
    rating: 4.7,
    reviews: 89,
    distance: '2.3 mi',
    price: 32,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300',
    verified: true,
    latitude: 44.8047,
    longitude: 20.4750,
  },
  {
    id: 8,
    name: "Pet Haven Boarding",
    service: 'Boarding',
    rating: 4.5,
    reviews: 67,
    distance: '1.8 mi',
    price: 42,
    image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300',
    verified: false,
    latitude: 44.8200,
    longitude: 20.4200,
  },
  {
    id: 9,
    name: "Royal Pets Hotel & Spa",
    service: 'Pet Hotels',
    rating: 4.9,
    reviews: 156,
    distance: '2.5 mi',
    price: 48,
    image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=300',
    verified: true,
    latitude: 44.8234,
    longitude: 20.4505,
  },
  {
    id: 10,
    name: "Cuddle Buddies Pet Sitting",
    service: 'Dog Sitting',
    rating: 4.6,
    reviews: 94,
    distance: '1.1 mi',
    price: 30,
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=300',
    verified: true,
    latitude: 44.7867,
    longitude: 20.4567,
  },
];

export default function SearchScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: SearchRouteParams }, 'params'>>();
  const serviceType = route.params?.serviceType;
  const location = useLocation();
  const { isDarkMode } = useTheme();
  
  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';
  const contentBg = isDarkMode ? 'bg-[#0f1621]' : 'bg-white';
  const cardBg = isDarkMode ? 'bg-[#1a2332]' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDarkMode ? 'border-gray-800' : 'border-gray-100';
  
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    serviceTypes: serviceType ? [serviceType] : [],
    date: '',
    time: '',
    petPickupAvailable: false,
    location: '',
    petTypes: [],
    petSizes: [],
    priceRange: [0, 200],
    minimumRating: 'Any',
  });

  // Update filters when serviceType param changes
  useEffect(() => {
    setFilters({
      serviceTypes: serviceType ? [serviceType] : [],
      date: '',
      time: '',
      petPickupAvailable: false,
      location: '',
      petTypes: [],
      petSizes: [],
      priceRange: [0, 200],
      minimumRating: 'Any',
    });
  }, [serviceType]);

  // Filter providers based on applied filters
  const providers = allProviders.filter((provider) => {
    // Service type filter
    if (filters.serviceTypes.length > 0 && !filters.serviceTypes.includes(provider.service)) {
      return false;
    }
    // Price range filter
    if (provider.price < filters.priceRange[0] || provider.price > filters.priceRange[1]) {
      return false;
    }
    // Minimum rating filter
    if (filters.minimumRating !== 'Any') {
      const minRating = parseFloat(filters.minimumRating.replace('+', ''));
      if (provider.rating < minRating) {
        return false;
      }
    }
    return true;
  });

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={filters.serviceTypes.length === 1 ? filters.serviceTypes[0] : 'All Services'}
      contentBg={contentBg}
      footer={<TabBar />}
      rightAction={
        <TouchableOpacity 
          onPress={() => setFilterModalVisible(true)}
          className="w-10 h-10 rounded-full bg-brand-600 items-center justify-center"
        >
          <Ionicons name="options-outline" size={20} color="white" />
        </TouchableOpacity>
      }
      headerChildren={
        <View className="flex-row gap-3 mt-3 mb-8">
          <View className="flex-1">
            <Button
              text="List View"
              onPress={() => setViewMode('list')}
              icon={<Ionicons name="list" size={18} color={viewMode === 'list' ? '#00C870' : 'white'} />}
              variant={viewMode === 'list' ? 'outline' : 'primary'}
              className={viewMode === 'list' ? 'bg-white border-2 border-brand-600' : ''}
            />
          </View>
          <View className="flex-1">
            <Button
              text="Map View"
              onPress={() => setViewMode('map')}
              icon={<Ionicons name="map" size={18} color={viewMode === 'map' ? '#00C870' : 'white'} />}
              variant={viewMode === 'map' ? 'outline' : 'primary'}
              className={viewMode === 'map' ? 'bg-white border-2 border-brand-600' : ''}
            />
          </View>
        </View>
      }
    >

      {viewMode === 'list' ? (
        <ListView
          providers={providers}
          isDarkMode={isDarkMode}
          textColor={textColor}
          subtextColor={subtextColor}
          cardBg={cardBg}
          borderColor={borderColor}
        />
      ) : (
        <MapViewComponent
          providers={providers}
          location={location}
        />
      )}

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />
    </ScreenLayout>
  );
}

