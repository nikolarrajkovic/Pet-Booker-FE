import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Pressable,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_GREEN, useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import { formatMoney } from '../../../services/currency';
import type { Partner, PartnerStatus, ServiceHistoryItem } from '../components';
import { useResponsive } from '../../../hooks/useResponsive';
import { CONTENT_WIDTHS } from '../../../components/shared/ContentContainer';
import BackLink from '../../../components/shared/BackLink';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { showAlert } from '../../../services/alert';
import {
  getServiceProvider,
  extractProviderDocuments,
  providerTypeValue,
  type ProviderDocuments,
  type ProviderDocumentImage,
  type ServiceProviderDto,
} from '../../../services/service-providers';
import {
  banPartner,
  getModerationHistory,
  liftPartnerTimeout,
  timeoutPartner,
  unbanPartner,
  type ModerationHistoryEntry,
} from '../../../services/admin';
import ModerationModal, { type ModerationMode } from '../components/ModerationModal';
import ModerationPanel from '../components/ModerationPanel';
import { partnerStatusOf } from '../providerToPartner';
import { usePageGutter } from '../../../hooks/usePageGutter';

// Labels are translation keys, resolved with t() at render.
const STATUS_CFG: Record<
  PartnerStatus,
  { labelKey: string; bg: string; text: string; borderColor: string; icon: any }
> = {
  active: {
    labelKey: 'admin.statusActive',
    bg: '#DCFCE7',
    text: '#15803D',
    borderColor: '#86EFAC',
    icon: 'checkmark-circle-outline',
  },
  timeout: {
    labelKey: 'admin.statusTimeout',
    bg: '#FEF9C3',
    text: '#A16207',
    borderColor: '#FDE047',
    icon: 'time-outline',
  },
  banned: {
    labelKey: 'admin.statusBanned',
    bg: '#FEE2E2',
    text: '#B91C1C',
    borderColor: '#FCA5A5',
    icon: 'ban-outline',
  },
};

const HISTORY_STATUS_CFG = {
  completed: { label: 'Completed', color: BRAND_GREEN },
  cancelled: { label: 'Cancelled', color: '#6B7280' },
  refunded: { label: 'Refunded', color: '#EF4444' },
};

function formatBytes(n: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function openDownload(
  url: string,
  t: (key: any, params?: Record<string, string | number>) => string
) {
  try {
    await Linking.openURL(url);
  } catch {
    showAlert(t('admin.fileOpenErrorTitle'), t('admin.fileOpenErrorMsg'));
  }
}

export default function PartnerDetailsScreen() {
  const gutter = usePageGutter();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, hex } = useThemeColors();
  const { t, tEnum } = useLocale();
  const { isWebLayout } = useResponsive();
  const insets = useSafeAreaInsets();

  const partner: Partner = route.params?.partner;
  const [docs, setDocs] = useState<ProviderDocuments | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [idFrontRevealed, setIdFrontRevealed] = useState(false);
  const [idBackRevealed, setIdBackRevealed] = useState(false);
  // The provider as the server last answered — the moderation fields come from here, so a timeout
  // or ban set a moment ago (by anyone) shows, rather than the list row this screen was opened with.
  const [provider, setProvider] = useState<ServiceProviderDto | null>(null);
  const [history, setHistory] = useState<ModerationHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [moderation, setModeration] = useState<ModerationMode | null>(null);

  const loadHistory = useCallback(async () => {
    if (!partner?.id) return;
    setLoadingHistory(true);
    try {
      setHistory(await getModerationHistory(Number(partner.id)));
    } catch (e) {
      console.warn('[PartnerDetails] load moderation history failed', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [partner?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Fetch the full provider DTO so we can render its real documents/photos
  useEffect(() => {
    if (!partner?.id) {
      setLoadingDocs(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDocs(true);
      try {
        const dto = await getServiceProvider(Number(partner.id));
        if (!cancelled) {
          setProvider(dto);
          setDocs(extractProviderDocuments(dto));
        }
      } catch (e) {
        console.warn('[PartnerDetails] load documents failed', e);
        if (!cancelled) setDocs(null);
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partner?.id]);

  // Esc dismisses the image viewer (the moderation dialog handles its own). Declared above the
  // `!partner` guard: a hook after a conditional return runs in a different order between renders.
  useEscapeToClose(!!viewerUri, () => setViewerUri(null));

  if (!partner) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>{t('admin.partnerNotFound')}</Text>
      </View>
    );
  }

  const partnerStatus: PartnerStatus = provider
    ? partnerStatusOf(provider.moderationStatus)
    : partner.status;
  const cfg = STATUS_CFG[partnerStatus];
  const bgColor = hex.bg;
  const cardBg = hex.card;
  const textColor = hex.text;
  const subTextColor = hex.subtext;
  const borderColor = hex.border;
  const dividerColor = isDarkMode ? '#2d3748' : '#F3F4F6';

  const coverUri = docs?.profilePhoto?.src || partner.image;
  const avatarUri = partner.image || docs?.profilePhoto?.src || '';

  const handleTimeout = () =>
    setModeration(partnerStatus === 'timeout' ? 'liftTimeout' : 'timeout');
  const handleBan = () => setModeration(partnerStatus === 'banned' ? 'unban' : 'ban');

  const runModeration = async ({ reason, until }: { reason: string; until?: Date }) => {
    const id = Number(partner.id);
    const updated =
      moderation === 'timeout'
        ? await timeoutPartner(id, until!, reason)
        : moderation === 'liftTimeout'
          ? await liftPartnerTimeout(id, reason)
          : moderation === 'ban'
            ? await banPartner(id, reason)
            : await unbanPartner(id, reason);
    setProvider((prev) => ({ ...(prev ?? {}), ...updated }));
    setModeration(null);
    loadHistory();
  };

  // A banned partner can't be put on timeout (unban first); the server refuses it too.
  const timeoutDisabled = partnerStatus === 'banned';
  const moderationButtons = (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: timeoutDisabled }}
        activeOpacity={0.8}
        onPress={handleTimeout}
        disabled={timeoutDisabled}
        style={{
          flex: 1,
          paddingVertical: 13,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: '#D97706',
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          opacity: timeoutDisabled ? 0.4 : 1,
        }}>
        <Ionicons
          name={partnerStatus === 'timeout' ? 'play-circle-outline' : 'time-outline'}
          size={17}
          color="#D97706"
          style={{ marginRight: 6 }}
        />
        <Text style={{ color: '#D97706', fontSize: 14, fontWeight: '700' }}>
          {partnerStatus === 'timeout' ? t('admin.liftTimeout') : t('admin.timeout')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.8}
        onPress={handleBan}
        style={{
          flex: 1,
          paddingVertical: 13,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: partnerStatus === 'banned' ? BRAND_GREEN : '#EF4444',
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
        }}>
        <Ionicons
          name={partnerStatus === 'banned' ? 'checkmark-circle-outline' : 'ban-outline'}
          size={17}
          color={partnerStatus === 'banned' ? BRAND_GREEN : '#EF4444'}
          style={{ marginRight: 6 }}
        />
        <Text
          style={{
            color: partnerStatus === 'banned' ? BRAND_GREEN : '#EF4444',
            fontSize: 14,
            fontWeight: '700',
          }}>
          {partnerStatus === 'banned' ? t('admin.unbanPartner') : t('admin.banPartner')}
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View
      // Transparent on the web design, not the page ground: the shell already paints that ground
      // and the pattern texture behind every screen, and repainting it here covers both.
      style={{ flex: 1, backgroundColor: isWebLayout ? 'transparent' : BRAND_GREEN }}>
      {/* ── Header ── green slab on a phone, a plain page title on the web design ── */}
      <View
        style={{
          backgroundColor: isWebLayout ? 'transparent' : BRAND_GREEN,
          paddingHorizontal: gutter.value,
          paddingTop: isWebLayout ? 32 : insets.top + 12,
          paddingBottom: isWebLayout ? 12 : 28,
          width: '100%',
          maxWidth: isWebLayout ? CONTENT_WIDTHS.default : undefined,
          alignSelf: 'center',
        }}>
        {isWebLayout && <BackLink />}
        {!isWebLayout && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
        )}
        <Text
          style={{
            color: isWebLayout ? hex.text : 'white',
            fontSize: isWebLayout ? 28 : 20,
            fontWeight: '700',
            marginTop: 10,
          }}>
          {t('admin.partnerDetails')}
        </Text>
      </View>

      {/* ── Scrollable content ── */}
      <View
        style={{
          flex: 1,
          // Same reason as the root: on the web design the shell's ground and pattern show
          // through, and an opaque sheet here would hide the texture on this screen only.
          backgroundColor: isWebLayout ? 'transparent' : bgColor,
          borderTopLeftRadius: isWebLayout ? 0 : 24,
          borderTopRightRadius: isWebLayout ? 0 : 24,
          marginTop: isWebLayout ? 0 : -20,
        }}>
        <ScrollView
          contentContainerStyle={
            isWebLayout
              ? {
                  paddingBottom: 40,
                  width: '100%',
                  maxWidth: CONTENT_WIDTHS.default,
                  alignSelf: 'center',
                }
              : { paddingBottom: 100 + insets.bottom }
          }
          showsVerticalScrollIndicator={false}>
          {/* ── Profile card ── */}
          <View
            style={{
              backgroundColor: cardBg,
              marginHorizontal: gutter.value,
              marginTop: 20,
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor,
              marginBottom: 16,
            }}>
            {/* Large cover image */}
            {coverUri ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.9}
                onPress={() => setViewerUri(coverUri)}>
                <Image
                  source={{ uri: coverUri }}
                  style={{ width: '100%', height: 180, backgroundColor: dividerColor }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  width: '100%',
                  height: 180,
                  backgroundColor: dividerColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="image-outline" size={36} color={subTextColor} />
              </View>
            )}
            <View style={{ padding: 16 }}>
              {/* Small avatar + name + status */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: cardBg,
                        marginRight: 10,
                        backgroundColor: dividerColor,
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        marginRight: 10,
                        backgroundColor: dividerColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="person" size={24} color={subTextColor} />
                    </View>
                  )}
                  <Text style={{ color: textColor, fontSize: 18, fontWeight: '700', flex: 1 }}>
                    {partner.name}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: cfg.bg,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: cfg.borderColor,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginLeft: 8,
                  }}>
                  <Ionicons name={cfg.icon} size={13} color={cfg.text} style={{ marginRight: 4 }} />
                  <Text style={{ color: cfg.text, fontSize: 12, fontWeight: '700' }}>
                    {t(cfg.labelKey as any)}
                  </Text>
                </View>
              </View>

              {/* Rating + service tag + location */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 10,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text
                    style={{ color: textColor, fontSize: 13, fontWeight: '600', marginLeft: 3 }}>
                    {partner.rating.toFixed(1)}
                  </Text>
                  <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 3 }}>
                    ({partner.reviews} reviews)
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: isDarkMode ? '#1e3a2f' : '#E8F5EF',
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}>
                  <Text style={{ color: '#00A85A', fontSize: 12, fontWeight: '500' }}>
                    {(() => {
                      const v = providerTypeValue(partner.services[0]);
                      return v != null
                        ? tEnum('serviceProviderType', v, partner.services[0])
                        : partner.services[0];
                    })()}
                  </Text>
                </View>
                {partner.distance ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="location-outline" size={13} color={subTextColor} />
                    <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 3 }}>
                      {partner.distance}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Contact */}
              {partner.email ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="mail-outline" size={13} color={subTextColor} />
                  <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 6 }}>
                    {partner.email}
                  </Text>
                </View>
              ) : null}
              {partner.phone ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="call-outline" size={13} color={subTextColor} />
                  <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 6 }}>
                    {partner.phone}
                  </Text>
                </View>
              ) : null}
              {partner.bio ? (
                <Text style={{ color: textColor, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                  {partner.bio}
                </Text>
              ) : null}
              {partner.address ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
                  <Ionicons
                    name="home-outline"
                    size={13}
                    color={subTextColor}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 6, flex: 1 }}>
                    {partner.address}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── Moderation: status, reason, history (and the actions, on the web design) ── */}
          <View style={{ marginHorizontal: gutter.value, marginBottom: 16 }}>
            <ModerationPanel
              status={partnerStatus}
              reason={provider?.moderationReason ?? partner.moderationReason}
              timedOutUntil={provider?.timedOutUntil ?? partner.timedOutUntil}
              bannedAt={provider?.bannedAt ?? partner.bannedAt}
              history={history}
              loadingHistory={loadingHistory}
              actions={isWebLayout ? moderationButtons : undefined}
            />
          </View>

          {/* ── Stats row ── */}
          <View
            style={{
              flexDirection: 'row',
              marginHorizontal: gutter.value,
              marginBottom: 16,
              backgroundColor: cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor,
              overflow: 'hidden',
            }}>
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: textColor, fontSize: 20, fontWeight: '800' }}>
                {partner.totalServices}
              </Text>
              <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>
                {t('admin.totalServices')}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: dividerColor }} />
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: textColor, fontSize: 20, fontWeight: '800' }}>
                {partner.avgRating.toFixed(1)}
              </Text>
              <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>
                {t('admin.avgRating')}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: dividerColor }} />
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: textColor, fontSize: 20, fontWeight: '800' }}>
                {formatMoney(partner.startingPrice, partner.currency)}
              </Text>
              <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>
                Starting Price
              </Text>
            </View>
          </View>

          {/* ── Partner Documents ── */}
          <View style={{ marginHorizontal: gutter.value, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: '#E8F5EF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}>
                <Ionicons name="document-text-outline" size={16} color={BRAND_GREEN} />
              </View>
              <Text style={{ color: textColor, fontSize: 15, fontWeight: '700' }}>
                {t('admin.partnerDocuments')}
              </Text>
            </View>

            {loadingDocs ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator color={BRAND_GREEN} />
              </View>
            ) : docs ? (
              <>
                {/* Profile Photo */}
                <DocCard
                  isDarkMode={isDarkMode}
                  borderColor={borderColor}
                  textColor={textColor}
                  subTextColor={subTextColor}
                  iconBg="#E8F5EF"
                  iconColor={BRAND_GREEN}
                  iconName="person-circle-outline"
                  title={t('admin.profilePhoto')}
                  subtitle={docs.profilePhoto ? t('admin.uploaded') : t('admin.notProvided')}
                  uploaded={!!docs.profilePhoto}>
                  {docs.profilePhoto ? (
                    <ViewableImage
                      uri={docs.profilePhoto.src}
                      height={180}
                      onPress={() => setViewerUri(docs.profilePhoto!.src)}
                    />
                  ) : (
                    <EmptyDoc text={t('admin.noProfilePhoto')} subTextColor={subTextColor} />
                  )}
                </DocCard>

                {/* Pet Photos */}
                <DocCard
                  isDarkMode={isDarkMode}
                  borderColor={borderColor}
                  textColor={textColor}
                  subTextColor={subTextColor}
                  iconBg="#FEF3C7"
                  iconColor="#D97706"
                  iconName="paw-outline"
                  title={
                    docs.petPhotos.length
                      ? t('admin.petPhotosCount', { n: docs.petPhotos.length })
                      : t('admin.petPhotos')
                  }
                  subtitle={docs.petPhotos.length ? t('admin.uploaded') : t('admin.notProvided')}
                  uploaded={docs.petPhotos.length > 0}>
                  {docs.petPhotos.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {docs.petPhotos.map((p, i) => (
                        <TouchableOpacity
                          accessibilityRole="button"
                          key={`${p.src}-${i}`}
                          activeOpacity={0.85}
                          onPress={() => setViewerUri(p.src)}
                          style={{ width: '31.7%', aspectRatio: 1 }}>
                          <Image
                            source={{ uri: p.src }}
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: 10,
                              backgroundColor: isDarkMode ? '#1a2332' : '#fff',
                            }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <EmptyDoc text={t('admin.noPetPhotos')} subTextColor={subTextColor} />
                  )}
                </DocCard>

                {/* Government ID — front & back */}
                <DocCard
                  isDarkMode={isDarkMode}
                  borderColor={borderColor}
                  textColor={textColor}
                  subTextColor={subTextColor}
                  iconBg="#EEF2FF"
                  iconColor="#6366F1"
                  iconName="shield-checkmark-outline"
                  title={t('admin.governmentId')}
                  subtitle={
                    docs.governmentIdFront || docs.governmentIdBack
                      ? t('admin.driversLicense')
                      : t('admin.notProvided')
                  }
                  uploaded={!!(docs.governmentIdFront || docs.governmentIdBack)}>
                  {docs.governmentIdFront || docs.governmentIdBack ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <IdSide
                        label={t('admin.front')}
                        img={docs.governmentIdFront}
                        revealed={idFrontRevealed}
                        onReveal={() => setIdFrontRevealed(true)}
                        onView={setViewerUri}
                        isDarkMode={isDarkMode}
                        subTextColor={subTextColor}
                      />
                      <IdSide
                        label={t('admin.back')}
                        img={docs.governmentIdBack}
                        revealed={idBackRevealed}
                        onReveal={() => setIdBackRevealed(true)}
                        onView={setViewerUri}
                        isDarkMode={isDarkMode}
                        subTextColor={subTextColor}
                      />
                    </View>
                  ) : (
                    <EmptyDoc text={t('admin.noGovernmentId')} subTextColor={subTextColor} />
                  )}
                </DocCard>

                {/* Certificates */}
                <DocCard
                  isDarkMode={isDarkMode}
                  borderColor={borderColor}
                  textColor={textColor}
                  subTextColor={subTextColor}
                  iconBg="#E8F5EF"
                  iconColor={BRAND_GREEN}
                  iconName="ribbon-outline"
                  title={
                    docs.certificates.length
                      ? t('admin.certificatesCount', { n: docs.certificates.length })
                      : t('admin.certificates')
                  }
                  subtitle={docs.certificates.length ? t('admin.uploaded') : t('admin.notProvided')}
                  uploaded={docs.certificates.length > 0}>
                  {docs.certificates.length ? (
                    docs.certificates.map((c, i) => (
                      <View key={`${c.fileSrc}-${i}`} style={{ marginTop: i === 0 ? 0 : 12 }}>
                        <Text style={{ color: textColor, fontSize: 12, fontWeight: '600' }}>
                          {c.name}
                        </Text>
                        {c.issuer ? (
                          <Text style={{ color: subTextColor, fontSize: 11, marginBottom: 6 }}>
                            {c.issuer}
                          </Text>
                        ) : (
                          <View style={{ height: 6 }} />
                        )}
                        {c.isImage ? (
                          <ViewableImage
                            uri={c.fileSrc}
                            height={150}
                            onPress={() => setViewerUri(c.fileSrc)}
                          />
                        ) : (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isDarkMode ? '#1a2332' : 'white',
                              borderRadius: 8,
                              padding: 10,
                              borderWidth: 1,
                              borderColor,
                            }}>
                            <Ionicons name="document-text-outline" size={22} color={subTextColor} />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                              <Text
                                style={{ color: textColor, fontSize: 12, fontWeight: '500' }}
                                numberOfLines={1}>
                                {c.fileName}
                              </Text>
                              <Text style={{ color: subTextColor, fontSize: 11 }}>
                                {[formatBytes(c.sizeBytes), c.mimeType].filter(Boolean).join(' • ')}
                              </Text>
                            </View>
                            <TouchableOpacity
                              accessibilityRole="button"
                              activeOpacity={0.8}
                              onPress={() => openDownload(c.fileSrc, t)}
                              style={{ padding: 8 }}>
                              <Ionicons name="open-outline" size={20} color={BRAND_GREEN} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <EmptyDoc text={t('admin.noCertificates')} subTextColor={subTextColor} />
                  )}
                </DocCard>
              </>
            ) : (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={28} color={subTextColor} />
                <Text style={{ color: subTextColor, fontSize: 13, marginTop: 8 }}>
                  Could not load documents.
                </Text>
              </View>
            )}
          </View>

          {/* ── Recent Service History ── */}
          {partner.serviceHistory.length > 0 && (
            <View style={{ marginHorizontal: gutter.value, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: '#EEF2FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}>
                  <Ionicons name="calendar-outline" size={16} color="#6366F1" />
                </View>
                <Text style={{ color: textColor, fontSize: 15, fontWeight: '700' }}>
                  Recent Service History
                </Text>
              </View>
              {partner.serviceHistory.map((item) => (
                <ServiceHistoryCard
                  key={item.id}
                  item={item}
                  currency={partner.currency}
                  cardBg={cardBg}
                  textColor={textColor}
                  subTextColor={subTextColor}
                  borderColor={borderColor}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* ── Phone: the actions pinned at the bottom. On the web design they sit in the
            moderation panel instead — a fixed white strip across a desktop window, detached from
            the content, read as a separate panel. ── */}
        {!isWebLayout && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: cardBg,
              paddingHorizontal: gutter.value,
              paddingTop: 12,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
              borderTopWidth: 1,
              borderTopColor: borderColor,
              flexDirection: 'row',
              gap: 12,
            }}>
            {moderationButtons}
          </View>
        )}
      </View>

      <ModerationModal
        mode={moderation}
        partnerName={partner.name}
        onClose={() => setModeration(null)}
        onSubmit={runModeration}
      />

      {/* ── Full-screen image viewer ── */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setViewerUri(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.93)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}>
          {viewerUri ? (
            <Image
              source={{ uri: viewerUri }}
              style={{ width: '100%', height: '82%' }}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setViewerUri(null)}
            style={{
              position: 'absolute',
              top: insets.top + 14,
              right: 18,
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="close" size={26} color="white" />
          </TouchableOpacity>
          <Text
            style={{
              position: 'absolute',
              bottom: insets.bottom + 22,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 12,
            }}>
            Tap anywhere to close
          </Text>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Helper sub-components ──────────────────────────────────────────────────────
function DocCard({
  isDarkMode,
  borderColor,
  textColor,
  subTextColor,
  iconBg,
  iconColor,
  iconName,
  title,
  subtitle,
  uploaded = true,
  children,
}: {
  isDarkMode: boolean;
  borderColor: string;
  textColor: string;
  subTextColor: string;
  iconBg: string;
  iconColor: string;
  iconName: any;
  title: string;
  subtitle: string;
  uploaded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: isDarkMode ? '#243447' : '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}>
            <Ionicons name={iconName} size={18} color={iconColor} />
          </View>
          <View>
            <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{title}</Text>
            {subtitle ? (
              <Text style={{ color: subTextColor, fontSize: 11 }}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
        <Ionicons
          name={uploaded ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={uploaded ? BRAND_GREEN : subTextColor}
        />
      </View>
      {children}
    </View>
  );
}

/** A tappable image that opens the full-screen viewer, with a small "expand" hint. */
function ViewableImage({
  uri,
  height,
  onPress,
}: {
  uri: string;
  height: number;
  onPress: () => void;
}) {
  const { t } = useLocale();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.9}
      onPress={onPress}
      style={{ position: 'relative' }}>
      <Image
        source={{ uri }}
        style={{ width: '100%', height, borderRadius: 10 }}
        resizeMode="cover"
      />
      <View
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Ionicons name="expand-outline" size={13} color="white" />
        <Text style={{ color: 'white', fontSize: 11, marginLeft: 4 }}>{t('admin.tapToView')}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** One side (front/back) of the government ID — blurred until revealed, then tappable to view full. */
function IdSide({
  label,
  img,
  revealed,
  onReveal,
  onView,
  isDarkMode,
  subTextColor,
}: {
  label: string;
  img: ProviderDocumentImage | null;
  revealed: boolean;
  onReveal: () => void;
  onView: (uri: string) => void;
  isDarkMode: boolean;
  subTextColor: string;
}) {
  const { t } = useLocale();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>
        {label}
      </Text>
      {img ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.9}
          onPress={() => (revealed ? onView(img.src) : onReveal())}
          style={{ position: 'relative' }}>
          <Image
            source={{ uri: img.src }}
            style={{ width: '100%', height: 110, borderRadius: 10 }}
            resizeMode="cover"
            blurRadius={revealed ? 0 : 14}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: 7,
              paddingHorizontal: 7,
              paddingVertical: 3,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <Ionicons name={revealed ? 'expand-outline' : 'eye-outline'} size={12} color="white" />
            <Text style={{ color: 'white', fontSize: 10, marginLeft: 3 }}>
              {revealed ? t('admin.view') : t('admin.reveal')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View
          style={{
            height: 110,
            borderRadius: 10,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="image-outline" size={20} color={subTextColor} />
          <Text style={{ color: subTextColor, fontSize: 11, marginTop: 4 }}>
            {t('admin.notProvided')}
          </Text>
        </View>
      )}
    </View>
  );
}

function EmptyDoc({ text, subTextColor }: { text: string; subTextColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
      <Ionicons name="close-circle-outline" size={16} color={subTextColor} />
      <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 6 }}>{text}</Text>
    </View>
  );
}

function ServiceHistoryCard({
  item,
  currency,
  cardBg,
  textColor,
  subTextColor,
  borderColor,
}: {
  item: ServiceHistoryItem;
  /** The partner's currency — every amount in their history is in it. */
  currency?: string | null;
  cardBg: string;
  textColor: string;
  subTextColor: string;
  borderColor: string;
}) {
  const cfg = HISTORY_STATUS_CFG[item.status];
  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor,
      }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}>
        <Text style={{ color: subTextColor, fontSize: 11 }}>
          {item.id} • {item.date}
        </Text>
        <Text style={{ color: textColor, fontSize: 14, fontWeight: '700' }}>
          {formatMoney(item.price, currency)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>
            {item.clientName}
          </Text>
          <Text style={{ color: subTextColor, fontSize: 12, marginTop: 1 }}>{item.service}</Text>
        </View>
        <Text style={{ color: cfg.color, fontSize: 13, fontWeight: '600' }}>{cfg.label}</Text>
      </View>
    </View>
  );
}
