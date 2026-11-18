import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ResponsiveModal from './ResponsiveModal';
import MapAddressPicker from './MapAddressPicker';
import { BRAND_GREEN, useThemeColors } from '../../hooks/useThemeColors';
import { useLocale } from '../../context/LocaleContext';
import { usePlace } from '../../context/PlaceContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Where to search from (app review 2026-11-13, finding 44): where I am now, my home address, or a
 * place on the map. The choice is remembered on the device and used by Search and Home's Near You.
 */
export default function PlacePicker({ visible, onClose }: Props) {
  const { t } = useLocale();
  const { cardBg, textColor, subtextColor, borderColor, isDarkMode } = useThemeColors();
  const { place, choice, setChoice, home, deviceAvailable } = usePlace();
  const [mapOpen, setMapOpen] = useState(false);

  const Row = ({
    icon,
    title,
    detail,
    selected,
    disabled,
    onPress,
    testID,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    detail?: string;
    selected: boolean;
    disabled?: boolean;
    onPress: () => void;
    testID: string;
  }) => (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center border-b ${borderColor} py-3`}
      style={{ opacity: disabled ? 0.5 : 1 }}>
      <View
        className="mr-3 h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: selected ? BRAND_GREEN : 'rgba(0,168,90,0.12)' }}>
        <Ionicons name={icon} size={18} color={selected ? '#ffffff' : BRAND_GREEN} />
      </View>
      <View className="flex-1">
        <Text className={`text-base font-semibold ${textColor}`}>{title}</Text>
        {detail ? (
          <Text className={`text-xs ${subtextColor}`} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark" size={20} color={BRAND_GREEN} /> : null}
    </TouchableOpacity>
  );

  return (
    <>
      <ResponsiveModal
        visible={visible && !mapOpen}
        onClose={onClose}
        mobilePresentation="centered"
        dialogWidth={440}>
        <View className={`${cardBg} p-5`}>
          <Text className={`mb-1 text-lg font-bold ${textColor}`}>{t('place.title')}</Text>
          <Text className={`mb-3 text-sm ${subtextColor}`}>{t('place.subtitle')}</Text>
          <Row
            testID="place-current"
            icon="navigate"
            title={t('place.current')}
            detail={deviceAvailable ? undefined : t('place.currentUnavailable')}
            selected={place.mode === 'current'}
            disabled={!deviceAvailable}
            onPress={() => {
              setChoice({ mode: 'current' });
              onClose();
            }}
          />
          <Row
            testID="place-home"
            icon="home"
            title={t('place.home')}
            detail={home?.label ?? t('place.homeMissing')}
            selected={place.mode === 'home'}
            disabled={!home}
            onPress={() => {
              setChoice({ mode: 'home' });
              onClose();
            }}
          />
          <Row
            testID="place-map"
            icon="map"
            title={t('place.map')}
            detail={choice.mode === 'map' ? choice.label : undefined}
            selected={place.mode === 'map'}
            onPress={() => setMapOpen(true)}
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            className="mt-4 items-center rounded-xl py-3">
            <Text className={`font-semibold ${subtextColor}`}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </ResponsiveModal>
      {mapOpen ? (
        <MapAddressPicker
          visible
          title={t('place.map')}
          initialRegion={{ latitude: place.latitude, longitude: place.longitude }}
          locateOnOpen={!place.known}
          isDarkMode={isDarkMode}
          onClose={() => setMapOpen(false)}
          onSelect={(address, label) => {
            setMapOpen(false);
            if (address.location) {
              setChoice({
                mode: 'map',
                latitude: address.location.latitude,
                longitude: address.location.longitude,
                label,
              });
            }
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
