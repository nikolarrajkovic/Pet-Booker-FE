import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ServiceDetailView from '../../../components/shared/ServiceDetailView';

type ServicePreviewRouteParams = {
  service: {
    name: string;
    type: string;
    description: string;
    price: number;
    duration?: string;
    images?: string[];
    isNew?: boolean;
    additionalServices?: {
      pickup?: number;
      dropOff?: number;
    };
    workingHours?: any;
  };
};

export default function ServicePreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ServicePreviewRouteParams }, 'params'>>();
  const { service } = route.params;
  const { isDarkMode } = useThemeColors();
  const { t } = useLocale();

  const editAction = (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => navigation.goBack()}
      className="ml-2">
      <Text className="font-semibold text-white">{t('myServices.edit')}</Text>
    </TouchableOpacity>
  );

  return (
    // This screen used to draw its own root, green header and width cap — the same three things
    // `ScreenLayout` exists to provide. Every layout fix then had to be applied twice, and the
    // ones that were not are why it kept looking a screen behind the rest of the app.
    //
    // Capped to `default`, the column the real service page uses: previewing at 1440px would show
    // the provider a layout no booker ever gets.
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      headerTitle={t('myServices.title')}
      headerSubtitle={t('myServices.previewSubtitle')}
      rightAction={editAction}
      webHeaderRight={
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()}>
          <Text className="font-semibold text-brand-600">{t('myServices.edit')}</Text>
        </TouchableOpacity>
      }
      width="default">
      {/* Stands in for the photo a real service carries; the preview has no upload of its own. */}
      <View className="items-center justify-center bg-gray-200" style={{ height: 220 }}>
        <View className="h-20 w-20 items-center justify-center rounded-full bg-gray-300">
          <Ionicons name="camera-outline" size={40} color="#9CA3AF" />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ServiceDetailView
          service={service}
          isDarkMode={isDarkMode}
          showBookButton={true}
          onBookPress={undefined} // Disabled in preview
        />
      </View>
    </ScreenLayout>
  );
}
