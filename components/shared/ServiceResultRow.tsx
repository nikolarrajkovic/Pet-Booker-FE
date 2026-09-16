import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import ServicePhoto from './ServicePhoto';
import { useLocale } from '../../context/LocaleContext';
import { formatMoney } from '../../services/currency';
import { serviceCurrency, type ServiceDto } from '../../services/services';
import { DiscountType } from '../../services/service-discounts';
import { getEnabledServiceAddons } from '../../services/service-addons';
import { PetSpecies } from '../../services/pets';

/**
 * One search result, as a full-width row. **Web design only** — see the note below.
 *
 * **Why a row and not a card in a grid.** The catalogue used to render two or three cards per line
 * on a wide window, each carrying a name, a type and a price — about as much as fits in a 340px
 * column. Everything that actually decides between two providers (what they do, which pets they
 * take, what the extras cost, whether the price shown is a promotion) was a tap away on the detail
 * screen, so choosing meant opening and backing out of result after result. A full-width row has
 * the space to answer those in place, which is the point of the booking-site layout this follows:
 * scan the list, open the one you already like. A vertical list is also what a paging scroll
 * wants — a grid re-flows its columns every time a page lands, so rows visibly jump sideways.
 *
 * **Why it is web-only.** At 390px there is no width to spend: the three regions below would each
 * become a full-bleed block, turning one result into most of a screenful and making the list
 * *harder* to scan than the compact card the phone already shows. So `ListView` renders this on
 * the web design and keeps the phone's card — the same split the rest of the app makes, and the
 * reason this component does not branch on layout internally.
 */

type ServiceResultRowProps = {
  service: ServiceDto;
  /** Resolved absolute image URL — the caller owns `resolveImageUrl` + the fallback. */
  image: string;
  /** Localized service-type label ("Walker"), which needs `tEnum` and so is resolved by the caller. */
  typeLabel: string;
  /** Formatted distance ("2 km"), when the result set carries one. */
  distance?: string;
  /** Category banner, when the list is scoped to a Home rail. */
  badge?: 'popular' | 'deal';
  onPress: () => void;
};

/** Species flags → chip labels, in the enum's own order so two rows never disagree on it. */
const SPECIES_FLAGS = [
  PetSpecies.Dog,
  PetSpecies.Cat,
  PetSpecies.Parrot,
  PetSpecies.Turtle,
  PetSpecies.Fish,
  PetSpecies.Snake,
];

/**
 * The word beside the score, the way a review score is normally read ("8.9 Fabulous").
 *
 * A bare "4.6" asks the reader to remember what counts as good. Thresholds are deliberately
 * generous at the top because the scale is 1–5: a 4.5 average across real reviews is excellent.
 */
function ratingWordKey(rating: number): string {
  if (rating >= 4.5) return 'card.ratingExceptional';
  if (rating >= 4) return 'card.ratingVeryGood';
  if (rating >= 3.5) return 'card.ratingGood';
  return 'card.ratingPleasant';
}

export default function ServiceResultRow({
  service,
  image,
  typeLabel,
  distance,
  badge,
  onPress,
}: ServiceResultRowProps) {
  const { isDarkMode, cardBg, textColor, subtextColor } = useThemeColors();
  const { t, tEnum } = useLocale();

  /**
   * A lighter rule than the app's default `borderColor`.
   *
   * A result row carries four or five internal boundaries; drawn in the standard border grey they
   * read as a table and compete with the content for attention. These only need to separate, so
   * they sit one step down in contrast — visible when looked for, invisible when scanning.
   */
  const hairline = isDarkMode ? 'border-white/10' : 'border-gray-100';

  /**
   * The card is lifted by a soft shadow rather than outlined by a hard border: down a long list a
   * 1px grey rectangle around every row reads as a grid of boxes, while a shadow lets each row sit
   * on the page. The border stays as a faint edge so the card still has a shape on a screen or
   * theme where the shadow barely renders.
   */
  const cardLift = {
    shadowColor: '#0f172a',
    shadowOpacity: isDarkMode ? 0.4 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  } as const;

  const currency = serviceCurrency(service);
  const money = (amount: number) => formatMoney(amount, currency);

  const rating = service.rating ?? 0;
  const reviews = service.totalRatingNumber ?? service.reviewCount ?? 0;

  // `price` is what the caller is charged — the base price with any live promotion already
  // applied by the server. The base price is only shown when the two differ, as the struck-through
  // "was" figure; deriving the discount here instead would re-implement the server's pricing rules
  // in the client, which is exactly what booking-quote.ts exists to avoid.
  const price = service.price ?? service.pricing?.basePrice ?? 0;
  const basePrice = service.pricing?.basePrice ?? price;
  const hasDiscount = service.appliedDiscountAmount != null && basePrice > price;

  const discountLabel = hasDiscount
    ? service.appliedDiscountType === DiscountType.Percent
      ? `-${Math.round(service.appliedDiscountAmount!)}%`
      : `-${money(service.appliedDiscountAmount!)}`
    : null;

  // The escrow deposit, when the provider takes one. It changes what the booking costs today, so
  // it belongs beside the price rather than three screens into the flow.
  const deposit = service.pricing?.isEscrowPercentEnabled
    ? ((service.pricing.escrowPercent ?? 0) * price) / 100
    : (service.pricing?.escrowAmount ?? 0);

  const description = (service.about ?? service.description ?? '').trim();
  const city = service.address?.city?.trim();

  const acceptedSpecies = service.details?.acceptedSpecies ?? 0;
  const speciesLabels =
    acceptedSpecies === PetSpecies.All
      ? [t('card.allPets')]
      : SPECIES_FLAGS.filter((flag) => (acceptedSpecies & flag) !== 0).map((flag) =>
          tEnum('petSpeciesType', flag)
        );

  // Extras are provider-authored free text, so they are shown verbatim. Three fit the row at the
  // narrowest width the web design reaches; the rest become a count rather than wrapping the row
  // to a fourth line.
  const addOns = getEnabledServiceAddons(service);
  const shownAddOns = addOns.slice(0, 3);
  const extraAddOnCount = addOns.length - shownAddOns.length;

  const pricingOptions = service.pricingOptions ?? [];
  const supportsLiveTracking = service.details?.supportsLiveTracking === true;

  // The row is one control made of two dozen scattered Texts. Read out individually it arrives as
  // "Walker / Belgrade / star / 4.6 / (12) / from / 2,500 / 1,800" — so the subtree is marked as a
  // single element with one composed label, matching what a sighted reader takes from it at once.
  const a11yLabel = [
    service.name,
    typeLabel,
    city,
    distance,
    reviews > 0
      ? t('card.a11yRating', { rating: rating.toFixed(1), reviews })
      : t('card.a11yNoReviews'),
    price > 0 ? t('card.a11yPriceFrom', { price: money(price) }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  const chip = (label: string, key: string, icon?: keyof typeof Ionicons.glyphMap) => (
    <View
      key={key}
      className={`flex-row items-center rounded-full px-2.5 py-1 ${
        isDarkMode ? 'bg-white/5' : 'bg-gray-50'
      }`}>
      {icon && (
        <Ionicons
          name={icon}
          size={11}
          color={isDarkMode ? '#9CA3AF' : '#6B7280'}
          style={{ marginRight: 3 }}
        />
      )}
      <Text className={`text-[11px] ${subtextColor}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessible
      onPress={onPress}
      activeOpacity={0.9}
      className={`${cardBg} mb-4 rounded-3xl border p-4 ${hairline}`}
      style={cardLift}>
      <View className="flex-row items-stretch">
        {/* ── media ─────────────────────────────────────────────────────────── */}
        <ServicePhoto uri={image} style={{ width: 208, height: 184 }}>
          {badge === 'popular' && (
            <View className="absolute left-2 top-2 flex-row items-center rounded-full bg-amber-500 px-2 py-1">
              <Ionicons name="flame" size={11} color="white" />
              <Text className="ml-1 text-[10px] font-bold text-white">{t('card.popular')}</Text>
            </View>
          )}
          {badge === 'deal' && (
            <View className="absolute left-2 top-2 flex-row items-center rounded-full bg-red-500 px-2 py-1">
              <Ionicons name="pricetag" size={11} color="white" />
              <Text className="ml-1 text-[10px] font-bold text-white">{t('card.deal')}</Text>
            </View>
          )}
          {/* A promotion is the most scannable thing in a long list, so it is called out on the
              image as well as in the price — the price block is the far edge of a wide row. */}
          {discountLabel && badge !== 'deal' && (
            <View className="absolute bottom-2 left-2 rounded-md bg-red-500 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-white">{discountLabel}</Text>
            </View>
          )}
        </ServicePhoto>

        {/* ── substance ─────────────────────────────────────────────────────── */}
        <View className="flex-1 px-5" style={{ minWidth: 0 }}>
          <Text className={`text-base font-semibold ${textColor}`} numberOfLines={1}>
            {service.name}
          </Text>

          {/* Type · city · distance — the one-line "what and where". */}
          <View className="mt-1 flex-row flex-wrap items-center">
            <Text className="text-xs font-medium text-brand-600">{typeLabel}</Text>
            {city ? (
              <>
                <Text className={`text-xs ${subtextColor} mx-1.5`}>·</Text>
                <Text className={`text-xs ${subtextColor}`} numberOfLines={1}>
                  {city}
                </Text>
              </>
            ) : null}
            {distance ? (
              <>
                <Text className={`text-xs ${subtextColor} mx-1.5`}>·</Text>
                <View className="flex-row items-center">
                  <Ionicons name="location" size={11} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                  <Text className={`text-xs ${subtextColor} ml-0.5`}>{distance}</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Heading rule: the name and where-it-is are the row's header, and without a line the
              description ran straight into them as one grey paragraph. */}
          <View className={`mt-2.5 border-t ${hairline}`} />

          {description ? (
            <Text className={`text-xs ${subtextColor} mt-2.5 leading-5`} numberOfLines={2}>
              {description}
            </Text>
          ) : null}

          {/* Who it takes, and what it can do. */}
          {(speciesLabels.length > 0 || shownAddOns.length > 0 || supportsLiveTracking) && (
            <View className="mt-2.5 flex-row flex-wrap gap-1.5">
              {speciesLabels.slice(0, 3).map((label) => chip(label, `species-${label}`, 'paw'))}
              {shownAddOns.map((addon) =>
                chip(addon.name, `addon-${addon.id ?? addon.name}`, 'add-circle-outline')
              )}
              {extraAddOnCount > 0 &&
                chip(t('card.morePlus', { count: extraAddOnCount }), 'addon-more')}
              {supportsLiveTracking &&
                chip(t('card.liveTracking'), 'live', 'navigate-circle-outline')}
            </View>
          )}

          {/* The reassurance line, the way a booking site puts its green ticks under a room. Only
              claims backed by the record are shown — nothing here is decorative. */}
          {/* Guarded on having something to say: the rule belongs to the claims, so rendering the
              row unconditionally drew a stray line across the bottom of every service that
              happens to have neither. */}
          {(pricingOptions.length > 0 || (deposit <= 0 && price > 0)) && (
            <View
              className={`mt-2.5 flex-row flex-wrap gap-x-3 gap-y-1 border-t pt-2.5 ${hairline}`}>
              {pricingOptions.length > 0 && (
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={12} color="#16A34A" />
                  <Text className="ml-1 text-[11px] font-medium text-green-600">
                    {t('card.durationOptions', { count: pricingOptions.length })}
                  </Text>
                </View>
              )}
              {deposit <= 0 && price > 0 && (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                  <Text className="ml-1 text-[11px] font-medium text-green-600">
                    {t('card.noDeposit')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── decision ──────────────────────────────────────────────────────── */}
        <View
          className={`items-end justify-between border-l pl-5 ${hairline}`}
          style={{ width: 176 }}>
          {/* Score block. An unrated service says so rather than showing a hollow 0.0 — a new
              listing is not a bad one. */}
          {reviews > 0 ? (
            <View className="w-full flex-row items-center justify-end">
              <View className="mr-2 items-end">
                <Text className={`text-xs font-semibold ${textColor}`}>
                  {t(ratingWordKey(rating) as any)}
                </Text>
                <Text className={`text-[11px] ${subtextColor}`}>
                  {t('card.reviewCount', { count: reviews })}
                </Text>
              </View>
              <View className="h-9 w-10 items-center justify-center rounded-xl bg-brand-600">
                <Text className="text-sm font-bold text-white">{rating.toFixed(1)}</Text>
              </View>
            </View>
          ) : (
            <Text className={`text-[11px] ${subtextColor}`}>{t('card.a11yNoReviews')}</Text>
          )}

          <View className={`mt-3 w-full items-end border-t pt-3 ${hairline}`}>
            {price > 0 && (
              <>
                <Text className={`text-[10px] ${subtextColor}`}>{t('bookService.priceFrom')}</Text>
                <View className="flex-row items-baseline">
                  {hasDiscount && (
                    <Text className={`text-xs ${subtextColor} mr-1.5 line-through`}>
                      {money(basePrice)}
                    </Text>
                  )}
                  <Text className={`text-lg font-semibold ${textColor}`}>{money(price)}</Text>
                </View>
                {deposit > 0 && (
                  <Text className={`text-[10px] ${subtextColor} mt-0.5`}>
                    {t('card.depositNow', { amount: money(deposit) })}
                  </Text>
                )}
              </>
            )}

            {/* The row itself is the control; this reads as the affordance rather than adding a
                second tap target inside it, so it is presentation-only. */}
            <View
              className="mt-2.5 flex-row items-center rounded-xl bg-brand-600 px-3.5 py-2.5"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Text className="text-xs font-semibold text-white">{t('card.seeAvailability')}</Text>
              <Ionicons name="chevron-forward" size={13} color="white" style={{ marginLeft: 2 }} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
