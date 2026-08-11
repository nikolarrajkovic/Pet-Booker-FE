import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_GREEN, useThemeColors, themeColors } from '../../../hooks/useThemeColors';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import {
  getServices,
  deleteService,
  ServiceDto,
  serviceCurrency,
} from '../../../services/services';
import { getErrorMessage } from '../../../services/http';
import { formatMoney } from '../../../services/currency';
import { serviceDtoToUi, UiService, additionalServiceTitle } from '../serviceModel';
import { providerTypeValue } from '../../../services/service-providers';
import { AdditionalServiceChargeType } from '../../../services/service-addons';

// Extras are provider-named free text now, so there's no fixed name→icon table to key off.
// A per-distance extra is a trip, everything else is a generic service.
const addonIcon = (chargeType: number) =>
  chargeType === AdditionalServiceChargeType.PerDistance
    ? 'car-outline'
    : 'checkmark-circle-outline';

export default function MyServicesScreen() {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { isDarkMode, hex } = useThemeColors();
  const { showError } = useToast();
  const { t } = useLocale();
  // The partner's own provider id comes straight from /auth/me (0 → none).
  const providerId = currentUser?.serviceProviderId || null;
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!providerId) {
      setServices([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setServices(await getServices({ serviceProviderId: providerId }));
    } catch (e: any) {
      setError(e?.message ?? t('myServices.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [providerId, t]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const handleDelete = (id: string) => {
    Alert.alert(t('myServices.deleteTitle'), t('myServices.deleteMsg'), [
      { text: t('myServices.cancel'), style: 'cancel' },
      {
        text: t('myServices.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteService(Number(id));
            await load();
          } catch (e) {
            showError(getErrorMessage(e, t('myServices.deleteFailed')));
          }
        },
      },
    ]);
  };

  const handleEdit = (dto: ServiceDto) => {
    (navigation as any).navigate('AddEditService', {
      mode: 'edit',
      serviceDto: dto,
      serviceProviderId: providerId,
    });
  };

  const addNewButton = (
    <TouchableOpacity
      disabled={!providerId}
      onPress={() =>
        (navigation as any).navigate('AddEditService', {
          mode: 'add',
          serviceProviderId: providerId,
        })
      }
      className="flex-row items-center rounded-full bg-white/20 px-3 py-1.5"
      style={{ opacity: providerId ? 1 : 0.5 }}>
      <Ionicons name="add" size={16} color="white" />
      <Text className="ml-1 text-sm font-semibold text-white">{t('myServices.addNew')}</Text>
    </TouchableOpacity>
  );

  const subtitle = isLoading
    ? t('myServices.loading')
    : services.length === 1
      ? t('myServices.activeOne', { count: services.length })
      : t('myServices.activeMany', { count: services.length });

  return (
    <ScreenLayout
      showBackButton
      headerTitle={t('myServices.title')}
      headerSubtitle={subtitle}
      rightAction={addNewButton}
      contentBg={isDarkMode ? 'bg-[#0f1621]' : 'bg-gray-50'}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-4" style={{ gap: 16 }}>
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 64 }}>
              <ActivityIndicator size="large" color={BRAND_GREEN} />
            </View>
          ) : error ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Ionicons
                name="alert-circle-outline"
                size={56}
                color={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
              <Text style={{ color: hex.subtext, textAlign: 'center', marginTop: 12 }}>
                {error}
              </Text>
            </View>
          ) : !providerId ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Ionicons
                name="briefcase-outline"
                size={56}
                color={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
              <Text style={{ color: hex.subtext, textAlign: 'center', marginTop: 12 }}>
                {t('myServices.noProvider')}
              </Text>
            </View>
          ) : services.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Ionicons name="paw-outline" size={56} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
              <Text style={{ color: hex.subtext, textAlign: 'center', marginTop: 12 }}>
                {t('myServices.noServices')}
              </Text>
            </View>
          ) : (
            services.map((dto) => {
              const ui = serviceDtoToUi(dto);
              return (
                <ServiceListCard
                  key={ui.id}
                  service={ui}
                  currency={serviceCurrency(dto)}
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
  currency,
  isDarkMode,
  onEdit,
  onDelete,
}: {
  service: UiService;
  /** The service's own currency; omit to use the partner's display preference. */
  currency?: string | null;
  isDarkMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { cardBg, textColor, subtextColor, inputBg: pricingBg } = themeColors(isDarkMode);
  const { t, tEnum } = useLocale();

  const enabledAdditional = service.additionalServices.filter((s) => s.enabled);
  // `service.type` is the English enum label (a form data key) — localize display only.
  const typeValue = providerTypeValue(service.type);
  const typeLabel = typeValue != null ? tEnum('serviceProviderType', typeValue) : service.type;
  // UiService keeps prices as the raw strings the form edits, so parse before formatting.
  const money = (raw: string | undefined) => formatMoney(parseFloat(raw ?? '') || 0, currency);
  // Extra names are free text the provider typed — nothing to localize, show as-is.

  return (
    <View
      className={`${cardBg} overflow-hidden rounded-2xl`}
      style={{
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}>
      {/* Image Area */}
      <View className="relative bg-gray-200" style={{ height: 180 }}>
        {service.images[0] ? (
          <Image
            source={{ uri: service.images[0] }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="paw-outline" size={52} color="#C4C9D4" />
          </View>
        )}

        {/* Edit / Delete overlay buttons */}
        <View className="absolute right-3 top-3 flex-row" style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={onEdit}
            className="h-9 w-9 items-center justify-center rounded-full bg-white"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 }}>
            <Ionicons name="pencil" size={15} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            className="h-9 w-9 items-center justify-center rounded-full bg-red-500"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4 }}>
            <Ionicons name="trash-outline" size={15} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Content */}
      <View className="p-4">
        {/* Service type badge */}
        <View
          className="mb-2 self-start rounded-full px-3 py-0.5"
          style={{ backgroundColor: '#E6F9F1', borderWidth: 1, borderColor: '#86EFAC' }}>
          <Text style={{ color: '#16A34A', fontSize: 11, fontWeight: '600' }}>{typeLabel}</Text>
        </View>

        {/* Name */}
        <Text className={`text-base font-bold ${textColor} mb-1`}>{service.name}</Text>

        {/* Description */}
        <Text className={`text-sm ${subtextColor} mb-3`} numberOfLines={2}>
          {service.description}
        </Text>

        {/* Rating row */}
        <View className="mb-3 flex-row items-center">
          <Ionicons name="star" size={14} color="#FBBF24" />
          <Text className={`text-sm font-semibold ${textColor} ml-1`}>
            {service.rating.toFixed(1)}
          </Text>
          <Text className={`text-sm ${subtextColor} ml-0.5`}>({service.reviews})</Text>
          <View className="mx-2 h-1 w-1 rounded-full bg-gray-400" />
          <Text className={`text-sm ${subtextColor}`}>
            {t('myServices.bookingsCount', { count: service.bookings })}
          </Text>
        </View>

        {/* Pricing section */}
        <View className={`${pricingBg} mb-3 rounded-xl p-3`}>
          <Text className={`text-xs font-semibold ${subtextColor} mb-2`}>
            {t('myServices.pricingOptions')}
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 4 }}>
            {service.pricingTiers.map((tier, i) => (
              <Text key={i} className={`text-sm ${textColor}`}>
                {tier.duration}:{' '}
                <Text className="font-semibold text-brand-500">{money(tier.price)}</Text>
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
            <Text className={`text-xs font-semibold ${subtextColor} mb-2`}>
              {t('myServices.additionalServices')}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {enabledAdditional.map((svc, i) => (
                <View key={i} className={`flex-row items-center ${pricingBg} rounded-lg px-2 py-1`}>
                  <Ionicons name={addonIcon(svc.chargeType) as any} size={13} color="#6B7280" />
                  <Text className={`text-xs ${subtextColor} ml-1`}>
                    {additionalServiceTitle(t, svc, service.name)}
                    {/* A per-distance extra has no single price until a trip is known, so show
                        its base fee with a "+" to signal the per-km part. */}
                    {svc.chargeType === AdditionalServiceChargeType.PerDistance
                      ? parseFloat(svc.baseFee ?? '') > 0
                        ? ` ${money(svc.baseFee)}+`
                        : ''
                      : parseFloat(svc.price) > 0
                        ? ` ${money(svc.price)}`
                        : ''}
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
