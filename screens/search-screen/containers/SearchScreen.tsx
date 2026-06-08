import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../../../components/shared/TabBar';
import Button from '../../../components/shared/Button';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import FilterModal, { FilterState } from '../../../components/FilterModal';
import { useLocation } from '../../../hooks/useLocation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { ListView, MapViewComponent } from '../components';
import { getServiceProviders, providerToViewModel, ProviderViewModel } from '../../../services/service-providers';

type SearchRouteParams = {
  serviceType?: string;
};

const { height } = Dimensions.get('window');

export default function SearchScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: SearchRouteParams }, 'params'>>();
  const serviceType = route.params?.serviceType;
  const location = useLocation();
  const { isDarkMode, cardBg, bgColor: contentBg, textColor, subtextColor, borderColor } = useThemeColors();

  const bgColor = isDarkMode ? 'bg-[#1a2332]' : 'bg-brand-500';

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [allProviders, setAllProviders] = useState<ProviderViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Sync the service-type filter when the route param changes (tapping a pill from HomeScreen)
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      serviceTypes: serviceType ? [serviceType] : [],
    }));
  }, [serviceType]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setIsLoading(true);
        try {
          const dtos = await getServiceProviders({ perPage: 100 });
          if (!cancelled) setAllProviders(dtos.map(providerToViewModel));
        } catch (e) {
          if (!cancelled) console.warn('[SearchScreen] Failed to load providers', e);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };

      load();
      return () => { cancelled = true; };
    }, [])
  );

  // Client-side filtering on the loaded data
  const providers = allProviders.filter((provider) => {
    if (filters.serviceTypes.length > 0 && !filters.serviceTypes.includes(provider.service)) {
      return false;
    }
    if (provider.price > 0) {
      if (provider.price < filters.priceRange[0] || provider.price > filters.priceRange[1]) {
        return false;
      }
    }
    if (filters.minimumRating !== 'Any' && provider.rating > 0) {
      const minRating = parseFloat(filters.minimumRating.replace('+', ''));
      if (provider.rating < minRating) return false;
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

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#00C870" />
          <Text className={`mt-4 text-sm ${subtextColor}`}>Finding providers...</Text>
        </View>
      ) : viewMode === 'list' ? (
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
