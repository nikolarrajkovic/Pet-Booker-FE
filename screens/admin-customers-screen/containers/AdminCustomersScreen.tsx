import React, { useCallback, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useBottomInset } from '../../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../../context/LocaleContext';
import { usePagedList } from '../../../hooks/usePagedList';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useNearBottomLoader } from '../../../hooks/useNearBottomLoader';
import { usePageGutter } from '../../../hooks/usePageGutter';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import ListState from '../../../components/shared/ListState';
import LoadMoreFooter, { isNearBottom } from '../../../components/shared/LoadMoreFooter';
import AdminSearchField from '../../../components/shared/AdminSearchField';
import { linkTo } from '../../../navigation/links';
import { searchUsersPage, type UserDto } from '../../../services/users';
import { resolveImageUrl } from '../../../services/service-providers';
import { formatShortDate } from '../../../i18n/dates';

const PAGE_SIZE = 20;

/** "Ana Petrović", else the username. */
export function fullName(user: Pick<UserDto, 'firstName' | 'lastName' | 'userName'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.userName || '—';
}

/**
 * Every customer account, newest first, for support (app review 2026-11-13, finding 41): searched
 * by account number, name, username, email or phone. A row opens the customer's page — their
 * profile, bookings and pets.
 */
export default function AdminCustomersScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { hex, subtextColor } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const bottomInset = useBottomInset();
  const { t } = useLocale();

  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 300);
  const fetchPage = useCallback(
    (page: number) =>
      searchUsersPage({ query: query || undefined, newestFirst: true, page, perPage: PAGE_SIZE }),
    [query]
  );
  const list = usePagedList<UserDto>(fetchPage, {
    errorFallback: t('adminCustomers.loadFailed'),
    resource: 'users',
  });
  const listRef = useNearBottomLoader(true, list.loadMore);

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={() => goUp('AdminDashboard')}
      headerTitle={t('adminCustomers.title')}
      headerChildren={
        <AdminSearchField
          testID="admin-customers-search"
          value={search}
          onChange={setSearch}
          placeholder={t('adminCustomers.searchPlaceholder')}
        />
      }>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 + (isWebLayout ? 0 : bottomInset) }}
        showsVerticalScrollIndicator={isWebLayout}
        scrollEventThrottle={16}
        onScroll={(e) => (isNearBottom(e) ? list.loadMore() : undefined)}>
        <View ref={listRef} style={{ paddingHorizontal: gutter.value, paddingTop: 12 }}>
          <ListState
            isLoading={list.isLoading}
            error={list.error}
            isEmpty={list.items.length === 0}
            emptyIcon="people-outline"
            emptyMessage={t('adminCustomers.empty')}>
            {list.items.map((user) => {
              const joined = user.createdAt ? new Date(user.createdAt) : null;
              const avatar = resolveImageUrl(user.avatarUrl);
              return (
                <TouchableOpacity
                  key={user.id}
                  {...(linkTo(navigation, 'AdminCustomerDetails', {
                    userId: user.id,
                    user,
                  }) as object)}
                  accessibilityRole="link"
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: hex.card,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: hex.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: 'rgba(0,168,90,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                      overflow: 'hidden',
                    }}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={{ width: 40, height: 40 }} />
                    ) : (
                      <Ionicons name="person" size={18} color="#00A85A" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: hex.text, fontSize: 14, fontWeight: '600' }}
                      numberOfLines={1}>
                      {fullName(user)}
                    </Text>
                    <Text style={{ color: hex.subtext, fontSize: 12 }} numberOfLines={1}>
                      {[user.email, user.phone].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={{ color: hex.subtext, fontSize: 11, marginLeft: 8 }}>
                    #{user.id}
                    {joined && !isNaN(joined.getTime()) ? ` · ${formatShortDate(joined)}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ListState>
          {list.items.length > 0 && (
            <LoadMoreFooter
              loaded={list.items.length}
              total={list.totalItems}
              hasMore={list.hasMore}
              isLoadingMore={list.isLoadingMore}
              onLoadMore={list.loadMore}
            />
          )}
          {list.items.length > 0 && !list.hasMore && !list.isLoadingMore && (
            <Text className={`pt-4 text-center text-xs ${subtextColor}`}>
              {t('admin.endOfList', { count: list.totalItems })}
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
