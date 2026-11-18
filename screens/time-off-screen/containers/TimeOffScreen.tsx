import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useResponsive } from '../../../hooks/useResponsive';
import { useBottomInset } from '../../../hooks/useSafeAreaSpacing';
import { useLocale } from '../../../context/LocaleContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useResource } from '../../../hooks/useResource';
import { usePageGutter } from '../../../hooks/usePageGutter';
import ScreenLayout from '../../../components/shared/ScreenLayout';
import DatePicker from '../../../components/shared/DatePicker';
import ReasonPromptModal from '../../../components/shared/ReasonPromptModal';
import AdminBookingRow from '../../../components/shared/AdminBookingRow';
import { linkTo } from '../../../navigation/links';
import { getErrorMessage } from '../../../services/http';
import { formatDateOnly, parseDateOnly } from '../../../services/date-only';
import { formatWeekdayDayMonth } from '../../../i18n/dates';
import {
  createTimeOff,
  deleteTimeOff,
  getTimeOff,
  type TimeOffDto,
} from '../../../services/time-off';
import {
  BookingState,
  declineBooking,
  formatBookingDate,
  getAllBookings,
  parseBookingDate,
  type BookingDto,
} from '../../../services/bookings';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Mon 24 Nov", or "Mon 24 Nov – Wed 26 Nov". */
function rangeLabel(from: string, to: string): string {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (!a || !b) return `${from} – ${to}`;
  return from === to
    ? formatWeekdayDayMonth(a)
    : `${formatWeekdayDayMonth(a)} – ${formatWeekdayDayMonth(b)}`;
}

/**
 * Days the partner's whole business is closed (decided 2026-11-18): a holiday, a sick day. Nobody
 * can book any of their services then. Bookings already on those days are listed under the days,
 * each with Decline: the customer is refunded in full and told why. The note is the partner's own.
 */
export default function TimeOffScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation<any>();
  const { goUp } = useAppNavigation();
  const { hex, isDarkMode, inputBg, inputText, placeholderColor } = useThemeColors();
  const { isWebLayout } = useResponsive();
  const bottomInset = useBottomInset();
  const { t } = useLocale();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const providerId = currentUser?.serviceProviderId ?? 0;

  const today = formatDateOnly(new Date());
  const {
    data: stretches,
    isLoading,
    refresh,
  } = useResource(['time-off', providerId, today], () => getTimeOff(today), {
    enabled: providerId > 0,
  });

  // Bookings still open on any of the closed days, to decline.
  const { data: affected, refresh: refreshAffected } = useResource(
    ['time-off-bookings', providerId, JSON.stringify(stretches ?? [])],
    async () => {
      const result = new Map<number, BookingDto[]>();
      for (const s of stretches ?? []) {
        const from = parseDateOnly(s.from);
        const to = parseDateOnly(s.to);
        if (!from || !to) continue;
        const end = new Date(to.getTime() + DAY_MS);
        const rows = await getAllBookings({
          serviceProviderId: providerId,
          states: [BookingState.Upcoming, BookingState.Accepted],
          // A stay that began the day before still counts; the overlap is judged below.
          bookingFrom: formatBookingDate(new Date(from.getTime() - 7 * DAY_MS)),
          bookingTo: formatBookingDate(new Date(end.getTime() + 30 * DAY_MS)),
        });
        result.set(
          Number(s.id),
          rows.filter(
            (b) =>
              parseBookingDate(b.bookingFrom).getTime() < end.getTime() &&
              parseBookingDate(b.bookingTo).getTime() > from.getTime()
          )
        );
      }
      return result;
    },
    { enabled: providerId > 0 && (stretches?.length ?? 0) > 0 }
  );

  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [saving, setSaving] = useState(false);
  const [declining, setDeclining] = useState<BookingDto | null>(null);
  const [declineBusy, setDeclineBusy] = useState(false);

  const add = useCallback(async () => {
    if (!from) return;
    setSaving(true);
    try {
      await createTimeOff({
        serviceProviderId: providerId,
        from: formatDateOnly(from),
        to: formatDateOnly(to ?? from),
        note: note.trim() || null,
      });
      setFrom(null);
      setTo(null);
      setNote('');
      showSuccess(t('timeOff.added'));
      refresh();
    } catch (e) {
      showError(getErrorMessage(e, t('timeOff.saveFailed')));
    } finally {
      setSaving(false);
    }
  }, [from, to, note, providerId, refresh, showError, showSuccess, t]);

  const remove = useCallback(
    async (s: TimeOffDto) => {
      try {
        await deleteTimeOff(Number(s.id));
        refresh();
      } catch (e) {
        showError(getErrorMessage(e, t('timeOff.saveFailed')));
      }
    },
    [refresh, showError, t]
  );

  const field = (label: string, value: Date | null, which: 'from' | 'to', testID: string) => (
    <View style={{ flex: 1 }}>
      <Text style={{ color: hex.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
        {label}
      </Text>
      <TouchableOpacity
        testID={testID}
        accessibilityRole="button"
        onPress={() => setPicker(picker === which ? null : which)}
        className={`${inputBg} flex-row items-center rounded-xl border px-3 py-3`}
        style={{ borderColor: hex.border }}>
        <Ionicons name="calendar-outline" size={16} color={hex.subtext} />
        <Text style={{ marginLeft: 8, color: value ? hex.text : hex.subtext, fontSize: 14 }}>
          {value
            ? formatWeekdayDayMonth(value)
            : which === 'to' && from
              ? formatWeekdayDayMonth(from)
              : t('timeOff.pickDay')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const card = {
    backgroundColor: hex.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: hex.border,
  } as const;

  return (
    <ScreenLayout
      headerVariant="standard"
      showBackButton
      onBackPress={() => goUp('PartnerHub')}
      headerTitle={t('timeOff.title')}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: gutter.value,
          paddingTop: 16,
          paddingBottom: 32 + (isWebLayout ? 0 : bottomInset),
        }}>
        <View style={{ maxWidth: 640, width: '100%' }}>
          <Text style={{ color: hex.subtext, fontSize: 13, marginBottom: 14 }}>
            {t('timeOff.intro')}
          </Text>

          <View style={card}>
            <Text style={{ color: hex.text, fontSize: 15, fontWeight: '700', marginBottom: 12 }}>
              {t('timeOff.addTitle')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {field(t('timeOff.from'), from, 'from', 'time-off-from')}
              {field(t('timeOff.to'), to, 'to', 'time-off-to')}
            </View>
            {picker ? (
              <View style={{ marginTop: 10 }}>
                <DatePicker
                  value={(picker === 'from' ? from : (to ?? from)) ?? new Date()}
                  minDate={picker === 'to' && from ? from : new Date()}
                  isDarkMode={isDarkMode}
                  onChange={(date) => {
                    if (picker === 'from') {
                      setFrom(date);
                      if (date && to && to < date) setTo(null);
                    } else {
                      setTo(date);
                    }
                    setPicker(null);
                  }}
                  onClose={() => setPicker(null)}
                />
              </View>
            ) : null}
            <Text
              style={{
                color: hex.text,
                fontSize: 13,
                fontWeight: '600',
                marginTop: 12,
                marginBottom: 6,
              }}>
              {t('timeOff.note')}
            </Text>
            <TextInput
              testID="time-off-note"
              value={note}
              onChangeText={setNote}
              maxLength={500}
              placeholder={t('timeOff.notePlaceholder')}
              placeholderTextColor={placeholderColor}
              className={`${inputBg} ${inputText} rounded-xl border px-3 py-3`}
              style={{ borderColor: hex.border, fontSize: 14 }}
            />
            <TouchableOpacity
              testID="time-off-add"
              accessibilityRole="button"
              disabled={!from || saving}
              onPress={add}
              className="mt-4 items-center rounded-xl py-3"
              style={{ backgroundColor: BRAND_GREEN, opacity: !from || saving ? 0.5 : 1 }}>
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-semibold text-white">{t('timeOff.add')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={{ color: hex.text, fontSize: 15, fontWeight: '700', marginBottom: 10 }}>
            {t('timeOff.upcoming')}
          </Text>
          {isLoading && !stretches ? (
            <ActivityIndicator color={BRAND_GREEN} style={{ alignSelf: 'flex-start' }} />
          ) : (stretches ?? []).length === 0 ? (
            <Text style={{ color: hex.subtext, fontSize: 13 }}>{t('timeOff.none')}</Text>
          ) : (
            (stretches ?? []).map((s) => {
              const open = affected?.get(Number(s.id)) ?? [];
              return (
                <View key={s.id} style={card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="moon-outline" size={18} color={BRAND_GREEN} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ color: hex.text, fontSize: 14, fontWeight: '700' }}>
                        {rangeLabel(s.from, s.to)}
                      </Text>
                      {s.note ? (
                        <Text style={{ color: hex.subtext, fontSize: 12 }}>{s.note}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={t('timeOff.remove')}
                      onPress={() => remove(s)}
                      className="flex-row items-center px-2 py-1">
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={{ color: '#DC2626', fontSize: 12, marginLeft: 4 }}>
                        {t('timeOff.remove')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {open.length > 0 ? (
                    <View style={{ marginTop: 12 }}>
                      <Text
                        style={{
                          color: '#B45309',
                          fontSize: 12,
                          fontWeight: '600',
                          marginBottom: 8,
                        }}>
                        {t('timeOff.openBookings', { count: open.length })}
                      </Text>
                      {open.map((b) => (
                        <View key={b.id}>
                          <AdminBookingRow
                            booking={b}
                            hide="partner"
                            link={linkTo(navigation, 'BookingDetails', { bookingId: b.id })}
                          />
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => setDeclining(b)}
                            className="-mt-1 mb-3 self-end px-2 py-1">
                            <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '600' }}>
                              {t('timeOff.decline')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <ReasonPromptModal
        visible={declining != null}
        title={t('timeOff.declineTitle')}
        subtitle={t('timeOff.declineSubtitle')}
        placeholder={t('timeOff.declinePlaceholder')}
        confirmLabel={t('timeOff.decline')}
        submitting={declineBusy}
        onClose={() => setDeclining(null)}
        onConfirm={async (reason) => {
          if (!declining?.id) return;
          setDeclineBusy(true);
          try {
            await declineBooking(declining.id, reason);
            setDeclining(null);
            refreshAffected();
          } catch (e) {
            showError(getErrorMessage(e, t('timeOff.saveFailed')));
          } finally {
            setDeclineBusy(false);
          }
        }}
      />
    </ScreenLayout>
  );
}
