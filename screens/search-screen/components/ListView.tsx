import React from 'react';
import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  ServiceDto,
  ServiceSortBy,
  serviceCurrency,
  type ServiceSortByValue,
} from '../../../services/services';
import { formatMoney } from '../../../services/currency';
import { useLocale } from '../../../context/LocaleContext';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import ServiceResultRow from '../../../components/shared/ServiceResultRow';
import { useResponsive } from '../../../hooks/useResponsive';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useTabBarSpacing } from '../../../hooks/useSafeAreaSpacing';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';

export interface ServiceSearchItem {
  id: number;
  name: string;
  service: string; // service-type displayName (e.g. "Walker")
  rating: number;
  reviews: number;
  distance: string;
  price: number;
  image: string;
  // Pin position from the service address (null = not geocoded → no map pin)
  latitude: number | null;
  longitude: number | null;
  dto: ServiceDto; // the real service record — booking targets this
}

/** The sort options offered, in the order they are shown. */
const SORT_OPTIONS: { value: ServiceSortByValue; labelKey: string }[] = [
  { value: ServiceSortBy.Default, labelKey: 'search.sortDefault' },
  { value: ServiceSortBy.PriceAsc, labelKey: 'search.sortPriceAsc' },
  { value: ServiceSortBy.PriceDesc, labelKey: 'search.sortPriceDesc' },
  { value: ServiceSortBy.RatingDesc, labelKey: 'search.sortRating' },
  { value: ServiceSortBy.MostReviewed, labelKey: 'search.sortMostReviewed' },
  { value: ServiceSortBy.Popularity, labelKey: 'search.sortPopularity' },
  { value: ServiceSortBy.Newest, labelKey: 'search.sortNewest' },
];

interface ListViewProps {
  services: ServiceSearchItem[];
  // When the list is scoped to a Home category (Most Popular / Special Deals),
  // every row carries the same banner the Home cards show.
  badge?: 'popular' | 'deal';
  /**
   * Paging, when the caller's list is paged. Omit for a complete list and no footer renders. The
   * next page loads as the user nears the bottom — phone-first — with the footer's button as the
   * manual fallback.
   */
  paging?: {
    total: number;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
  };
  /** Sort control. Omitted for a fixed list (a Home rail), which has its own order. */
  sort?: {
    value: ServiceSortByValue;
    onChange: (next: ServiceSortByValue) => void;
  };
  /** Rendered above the results on the phone design — the filter button and its active count. */
  header?: React.ReactNode;
}

/**
 * The search results: one per line, paging themselves as the reader scrolls.
 *
 * **Why one per line.** On the web design this used to be a two-to-three column grid, which meant
 * each result was a 340px card with room for a name, a type and a price. Everything that decides
 * between two providers — what they actually do, which pets they take, what the extras cost,
 * whether that price is a promotion — only existed on the detail screen, so comparing meant
 * opening and backing out of result after result. A vertical list is also what a paging scroll
 * wants: a grid re-flows its columns every time a page lands, so rows visibly jump sideways under
 * the reader's eye as they scroll.
 *
 * **Two presentations, one behaviour.** A wide column gets `ServiceResultRow`, which spends its
 * width answering those questions in place. A narrow one keeps the compact card: squeezed below
 * about 640px the wide row's three regions leave the middle one too thin to hold a service name,
 * so every row ellipsises to "Tracked ..." and the design does the opposite of its job.
 *
 * The choice is made from the column's OWN measured width, not from the layout mode. What is left
 * for the results is the window minus the sidebar minus the filter rail, so the mode alone does
 * not know it: at 800px the web design is active and there is less room here than on a phone.
 * Everything around the presentation — one per line, the infinite scroll, the sort, and filters
 * applied by the server across the whole result set — is the same either way.
 */

/**
 * Narrowest column the full-width row still reads well in: its image (208) and price block (176)
 * are fixed, so anything below this is taken out of the middle column that carries the name,
 * the description and the chips.
 */
const RICH_ROW_MIN_WIDTH = 640;
export default function ListView({ services, badge, paging, sort, header }: ListViewProps) {
  const navigation = useNavigation();
  const tabBarSpacing = useTabBarSpacing();
  const { t } = useLocale();
  const { isWebLayout } = useResponsive();
  const { textColor, subtextColor, borderColor, cardBg } = useThemeColors();

  const [sortOpen, setSortOpen] = React.useState(false);
  // Measured rather than derived: see the note above. Starts at 0, which renders the compact card
  // for the first frame — the safe default, since it is legible at any width.
  const [columnWidth, setColumnWidth] = React.useState(0);
  const useRichRow = isWebLayout && columnWidth >= RICH_ROW_MIN_WIDTH;
  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort?.value)?.labelKey ?? 'search.sortDefault';

  // Auto-load on the web design's page scroller. The ScrollView's own onScroll below covers the
  // phone; on web that ScrollView is flattened into ScreenLayout's single scroll pane and never
  // fires, so without this the "infinite" scroll stopped dead at page one on every desktop.
  const listRef = useNearBottomLoader(!!paging, paging?.onLoadMore ?? (() => {}));

  // `paging.total` is the server's count for the whole search, not the rows on screen — which is
  // the point of moving filtering to the server. While it was done in the client this read
  // "12 services found" for a filter that matched 12 of the 25 rows that happened to be loaded.
  const resultCount = paging?.total ?? services.length;

  /**
   * The phone's result card: a wide, short row with a thumbnail. Unchanged from the design that
   * ships today — see the note above for why the width-hungry web row is not used here.
   */
  const compactCard = (item: ServiceSearchItem) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={item.id}
      onPress={() => (navigation as any).navigate('ServiceDetail', { service: item.dto })}
      className={`${cardBg} mb-3 flex-row rounded-2xl border p-3 shadow-sm ${borderColor}`}
      activeOpacity={0.9}>
      {/* Service image + category banner (Popular / Deal) */}
      <View className="relative">
        <Image source={{ uri: item.image }} className="h-20 w-20 rounded-xl" resizeMode="cover" />
        {badge === 'popular' && (
          <View className="absolute left-1 top-1 flex-row items-center rounded-full bg-amber-500 px-1.5 py-0.5">
            <Ionicons name="flame" size={10} color="white" />
            <Text className="ml-0.5 text-[9px] font-bold text-white">{t('card.popular')}</Text>
          </View>
        )}
        {badge === 'deal' && (
          <View className="absolute left-1 top-1 flex-row items-center rounded-full bg-red-500 px-1.5 py-0.5">
            <Ionicons name="pricetag" size={10} color="white" />
            <Text className="ml-0.5 text-[9px] font-bold text-white">{t('card.deal')}</Text>
          </View>
        )}
      </View>

      {/* Service info */}
      <View className="ml-3 flex-1 justify-between">
        <View>
          <Text className={`text-base font-semibold ${textColor}`} numberOfLines={1}>
            {item.name}
          </Text>
          {item.service ? (
            <Text className={`text-sm ${subtextColor} mt-0.5`}>{item.service}</Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-3">
          {item.rating > 0 && (
            <View className="flex-row items-center">
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text className={`text-sm ${textColor} ml-1 font-medium`}>
                {item.rating.toFixed(1)} <Text className={subtextColor}>({item.reviews})</Text>
              </Text>
            </View>
          )}
          {item.distance ? (
            <View className="flex-row items-center">
              <Ionicons name="location" size={14} color="#6B7280" />
              <Text className={`text-sm ${subtextColor} ml-1`}>{item.distance}</Text>
            </View>
          ) : null}
        </View>

        {/* Each service prices in its own provider's currency, so format per item. */}
        <Text className="mt-1 font-semibold text-brand-600">
          {t('bookService.priceFrom')} {formatMoney(item.price, serviceCurrency(item.dto))}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      className="flex-1"
      scrollEventThrottle={16}
      // Search is a tab screen, and the tab bar is an absolutely-positioned overlay — nothing in
      // the flow reserves room for it, so without this the last result sits underneath it.
      contentContainerStyle={{ paddingBottom: tabBarSpacing }}
      onScroll={paging ? (e) => (isNearBottom(e) ? paging.onLoadMore() : undefined) : undefined}>
      {/* The screen's own side gutter: on web the content column is `noPadding` (screens own
          their gutters), so without this the results sat flush against the sidebar with nothing
          between the navigation and the first card. 32 on web is `ContentContainer`'s desktop
          gutter, which is what the page title above is inset by — 24 here left the cards eight
          pixels to the left of their own heading. The phone keeps its 24. */}
      <View
        ref={listRef}
        className={isWebLayout ? 'px-8 pt-2' : 'px-6 pt-6'}
        onLayout={(e) => setColumnWidth(e.nativeEvent.layout.width)}>
        {header}

        {/* Count + sort. The count is the search's, so it is worth stating plainly. */}
        {/* The sort panel opens downwards OVER the first result rows, so this row has to out-rank
            them in paint order. A z-index only competes inside its own stacking context, and the
            cards are later siblings of this row — so raising it on the panel alone left the panel
            underneath them. It is set here in `style` rather than as a `z-*` class because RN
            resolves zIndex from the style object. */}
        <View className="mb-4 flex-row items-center justify-between" style={{ zIndex: 20 }}>
          <Text className={`text-sm font-medium ${textColor}`}>
            {t('search.resultsCount', { count: resultCount })}
          </Text>

          {sort && (
            <View style={{ zIndex: 20 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${t('search.sortBy')}: ${t(activeSortLabel as any)}`}
                onPress={() => setSortOpen((open) => !open)}
                className={`flex-row items-center rounded-full border px-3 py-2 ${borderColor} ${cardBg}`}>
                <Ionicons name="swap-vertical" size={14} color="#6B7280" />
                <Text className={`ml-1.5 text-xs font-medium ${textColor}`} numberOfLines={1}>
                  {t(activeSortLabel as any)}
                </Text>
                <Ionicons
                  name={sortOpen ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color="#6B7280"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {/* An inline panel rather than a Modal: the control sits in the scroll, and a
                  full-screen overlay for a seven-item list is heavier than the choice deserves. */}
              {sortOpen && (
                <View
                  className={`absolute right-0 top-11 w-56 rounded-xl border py-1 ${borderColor} ${cardBg}`}
                  style={{
                    // Above the rows on every platform: zIndex for web/iOS, and elevation, which
                    // is what actually orders overlapping views on Android — the result cards
                    // carry elevation 2, so a panel without one paints under them there even
                    // with a higher zIndex.
                    zIndex: 30,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 8,
                  }}>
                  {SORT_OPTIONS.map((option) => {
                    const active = option.value === sort.value;
                    return (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        key={option.value}
                        onPress={() => {
                          sort.onChange(option.value);
                          setSortOpen(false);
                        }}
                        className="flex-row items-center justify-between px-3 py-2.5">
                        <Text
                          className={`text-xs ${active ? 'font-semibold text-brand-600' : subtextColor}`}>
                          {t(option.labelKey as any)}
                        </Text>
                        {active && <Ionicons name="checkmark" size={14} color="#16A34A" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        {services.map((item) =>
          useRichRow ? (
            <ServiceResultRow
              key={item.id}
              service={item.dto}
              image={item.image}
              typeLabel={item.service}
              distance={item.distance}
              badge={badge}
              onPress={() => (navigation as any).navigate('ServiceDetail', { service: item.dto })}
            />
          ) : (
            compactCard(item)
          )
        )}

        {services.length === 0 && (
          <View className="items-center py-16">
            <Ionicons name="search-outline" size={44} color="#9CA3AF" />
            <Text className={`${subtextColor} mt-3 text-center text-sm`}>
              {t('search.noServices')}
            </Text>
          </View>
        )}
      </View>

      {paging && services.length > 0 && (
        <LoadMoreFooter
          loaded={services.length}
          total={paging.total}
          hasMore={paging.hasMore}
          isLoadingMore={paging.isLoadingMore}
          onLoadMore={paging.onLoadMore}
        />
      )}

      {/* The end of an endless scroll should say so — otherwise a list that simply stops looks
          like one that failed to load the next page. */}
      {paging && !paging.hasMore && !paging.isLoadingMore && services.length > 0 && (
        <Text className={`${subtextColor} px-6 pb-2 pt-4 text-center text-xs`}>
          {t('search.endOfResults', { count: services.length })}
        </Text>
      )}

      {/* Bottom spacing — clears the phone's pinned tab bar, which the web design does not have. */}
      <View className={isWebLayout ? 'h-8' : 'h-24'} />
    </ScrollView>
  );
}
