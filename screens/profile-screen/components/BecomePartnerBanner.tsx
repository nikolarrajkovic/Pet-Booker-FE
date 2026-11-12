import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../../../hooks/useResponsive';
import { useLocale } from '../../../context/LocaleContext';
import { BRAND_GREEN } from '../../../hooks/useThemeColors';

type Props = {
  onPress: () => void;
};

/** Why partner, as chips on the wider layouts. The texts are Become a Partner's own benefits. */
const BENEFITS = [
  { icon: 'cash-outline', key: 'becomePartner.benefit1Title' },
  { icon: 'time-outline', key: 'becomePartner.benefit2Title' },
  { icon: 'trending-up-outline', key: 'becomePartner.benefit3Title' },
] as const;

/**
 * "Become a Partner" on Profile, for an account that isn't one yet: a green banner in the style of
 * Home's ("Ask several providers at once") with a walker and their dog beside the text. The whole
 * banner is the button; "Learn More" is drawn as its pill. It used to be a green box holding a
 * full-width white button, which on the web design was a 1600px bar.
 *
 * The illustration is `assets/images/partner-walker.png`, made from the partner tour's live
 * session picture with its LIVE badge and map pin taken out.
 */
export default function BecomePartnerBanner({ onPress }: Props) {
  const { isWebLayout } = useResponsive();
  const { t } = useLocale();
  const imageSize = isWebLayout ? 176 : 128;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${t('profile.becomePartner')}. ${t('profile.becomePartnerSub')}`}
      accessibilityHint={t('profile.learnMore')}
      activeOpacity={0.9}
      onPress={onPress}
      className="flex-row overflow-hidden rounded-2xl bg-brand-500">
      <View className={`flex-1 justify-center ${isWebLayout ? 'py-6 pl-8' : 'py-5 pl-5'} pr-2`}>
        <Text className={`${isWebLayout ? 'text-2xl' : 'text-xl'} font-bold text-white`}>
          {t('profile.becomePartner')}
        </Text>
        <Text className="mt-1 text-sm text-white/90">{t('profile.becomePartnerSub')}</Text>

        {isWebLayout ? (
          <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
            {BENEFITS.map((b) => (
              <View
                key={b.key}
                className="flex-row items-center rounded-full bg-white/15 px-3 py-1.5">
                <Ionicons name={b.icon} size={14} color="white" />
                <Text className="ml-1.5 text-xs font-semibold text-white">{t(b.key)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View className="mt-4 flex-row">
          <View className="flex-row items-center rounded-full bg-white px-4 py-2">
            <Text className="text-sm font-bold text-brand-700">{t('profile.learnMore')}</Text>
            <Ionicons
              name="arrow-forward"
              size={15}
              color={BRAND_GREEN}
              style={{ marginLeft: 6 }}
            />
          </View>
        </View>
      </View>

      <Image
        source={require('../../../assets/images/partner-walker.png')}
        accessibilityRole="none"
        alt=""
        resizeMode="contain"
        style={{
          width: imageSize,
          height: imageSize,
          alignSelf: 'flex-end',
          marginRight: isWebLayout ? 24 : 4,
          marginTop: 8,
        }}
      />
    </TouchableOpacity>
  );
}
