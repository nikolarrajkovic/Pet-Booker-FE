import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, themeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import { getServices, deleteService, ServiceDto } from '../../../services/services';
import { getMyProvider, ServiceProviderDto } from '../../../services/service-providers';
import { serviceDtoToUi, UiService } from '../serviceModel';

const ADDITIONAL_SERVICE_ICONS: Record<string, string> = {
  'Pickup': 'car-outline',
  'Drop-off': 'car-outline',
  'Photo Updates': 'camera-outline',
  'Medication Administration': 'medkit-outline',
  'Special Needs Care': 'heart-outline',
};

export default function MyServicesScreen() {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, hex } = useThemeColors();
  const [provider, setProvider] = useState<ServiceProviderDto | null>(null);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUser?.id) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const mine = await getMyProvider(currentUser.id);
      setProvider(mine);
      if (mine?.id) {
        setServices(await getServices({ serviceProviderId: mine.id }));
      } else {
        setServices([]);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load your services.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => { if (!cancelled) await load(); })();
      return () => { cancelled = true; };
    }, [load])
  );

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Service',
      'Are you sure you want to delete this service? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteService(Number(id));
              await load();
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message ?? 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (dto: ServiceDto) => {
    (navigation as any).navigate('AddEditService', {
      mode: 'edit',
      serviceDto: dto,
      serviceProviderId: provider?.id,
    });
  };

  const addNewButton = (
    <TouchableOpacity
      disabled={!provider?.id}
      onPress={() => (navigation as any).navigate('AddEditService', { mode: 'add', serviceProviderId: provider?.id })}
      className="bg-white/20 rounded-full px-3 py-1.5 flex-row items-center"
      style={{ opacity: provider?.id ? 1 : 0.5 }}
    >
      <Ionicons name="add" size={16} color="white" />
      <Text className="text-white font-semibold ml-1 text-sm">Add New</Text>
    </TouchableOpacity>
  );

  const subtitle = isLoading ? 'Loading…' : `${services.length} active service${services.length === 1 ? '' : 's'}`;

  return (
    <ScreenLayout
      showBackButton
      headerTitle="My Services"
      headerSubtitle={subtitle}
      rightAction={addNewButton}
      contentBg={isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50'}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-4" style={{ gap: 16 }}>
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 64 }}>
              <ActivityIndicator size="large" color="#00C870" />
            </View>
          ) : error ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Ionicons name="alert-circle-outline" size={56} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
              <Text style={{ color: hex.subtext, textAlign: 'center', marginTop: 12 }}>{error}</Text>
            </View>
          ) : !provider ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Ionicons name="briefcase-outline" size={56} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
              <Text style={{ color: hex.subtext, textAlign: 'center', marginTop: 12 }}>
                No provider profile found for your account yet.
              </Text>
            </View>
          ) : services.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Ionicons name="paw-outline" size={56} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
              <Text style={{ color: hex.subtext, textAlign: 'center', marginTop: 12 }}>
                No services yet. Tap “Add New” to create your first one.
              </Text>
            </View>
          ) : (
            services.map((dto) => {
              const ui = serviceDtoToUi(dto);
              return (
                <ServiceListCard
                  key={ui.id}
                  service={ui}
                  isDarkMode={isDarkMode}
                  onEdit={() => handleEdit(dto)}
                  onDelete={() => handleDelete(ui.id)}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

function ServiceListCard({
  service,
  isDarkMode,
  onEdit,
  onDelete,
}: {
  service: UiService;
  isDarkMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { cardBg, textColor, subtextColor, inputBg: pricingBg } = themeColors(isDarkMode);

  const enabledAdditional = service.additionalServices.filter(s => s.enabled);

  return (
    <View
      className={`${cardBg} rounded-2xl overflow-hidden`}
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
    >
      {/* Image Area */}
      <View className="relative bg-gray-200" style={{ height: 180 }}>
        <View className="flex-1 items-center justify-center">
          <Ionicons name="paw-outline" size={52} color="#C4C9D4" />
        </View>

        {/* Edit / Delete overlay buttons */}
        <View className="absolute top-3 right-3 flex-row" style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={onEdit}
            className="w-9 h-9 bg-white rounded-full items-center justify-center"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 }}
          >
            <Ionicons name="pencil" size={15} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            className="w-9 h-9 bg-red-500 rounded-full items-center justify-center"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 }}
          >
            <Ionicons name="trash-outline" size={15} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Content */}
      <View className="p-4">
        {/* Service type badge */}
        <View className="self-start rounded-full px-3 py-0.5 mb-2" style={{ backgroundColor: '#E6F9F1', borderWidth: 1, borderColor: '#86EFAC' }}>
          <Text style={{ color: '#16A34A', fontSize: 11, fontWeight: '600' }}>{service.type}</Text>
        </View>

        {/* Name */}
        <Text className={`text-base font-bold ${textColor} mb-1`}>{service.name}</Text>

        {/* Description */}
        <Text className={`text-sm ${subtextColor} mb-3`} numberOfLines={2}>{service.description}</Text>

        {/* Rating row */}
        <View className="flex-row items-center mb-3">
          <Ionicons name="star" size={14} color="#FBBF24" />
          <Text className={`text-sm font-semibold ${textColor} ml-1`}>{service.rating}</Text>
          <Text className={`text-sm ${subtextColor} ml-0.5`}>({service.reviews})</Text>
          <View className="w-1 h-1 bg-gray-400 rounded-full mx-2" />
          <Text className={`text-sm ${subtextColor}`}>{service.bookings} bookings</Text>
        </View>

        {/* Pricing section */}
        <View className={`${pricingBg} rounded-xl p-3 mb-3`}>
          <Text className={`text-xs font-semibold ${subtextColor} mb-2`}>Pricing Options</Text>
          <View className="flex-row flex-wrap" style={{ gap: 4 }}>
            {service.pricingTiers.map((tier, i) => (
              <Text key={i} className={`text-sm ${textColor}`}>
                {tier.duration}:{' '}
                <Text className="text-brand-500 font-semibold">${tier.price}</Text>
                {i < service.pricingTiers.length - 1 ? (
                  <Text className={subtextColor}>{'  \u2022'}</Text>
                ) : null}
              </Text>
            ))}
          </View>
        </View>

        {/* Additional Services */}
        {enabledAdditional.length > 0 && (
          <View>
            <Text className={`text-xs font-semibold ${subtextColor} mb-2`}>Additional Services</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {enabledAdditional.map((svc, i) => (
                <View key={i} className={`flex-row items-center ${pricingBg} rounded-lg px-2 py-1`}>
                  <Ionicons
                    name={(ADDITIONAL_SERVICE_ICONS[svc.name] || 'checkmark-circle-outline') as any}
                    size={13}
                    color="#6B7280"
                  />
                  <Text className={`text-xs ${subtextColor} ml-1`}>
                    {svc.name}{parseFloat(svc.price) > 0 ? ` $${svc.price}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
