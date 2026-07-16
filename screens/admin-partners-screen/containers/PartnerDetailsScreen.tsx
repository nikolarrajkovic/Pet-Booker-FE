import React, { useState, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useLocale } from '../../../context/LocaleContext';
import type { Partner, PartnerStatus, ServiceHistoryItem } from '../components';
import {
  getServiceProvider,
  extractProviderDocuments,
  providerTypeValue,
  type ProviderDocuments,
  type ProviderDocumentImage,
} from '../../../services/service-providers';

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
  completed: { label: 'Completed', color: '#00C870' },
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
    Alert.alert(t('admin.fileOpenErrorTitle'), t('admin.fileOpenErrorMsg'));
  }
}

export default function PartnerDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, hex } = useThemeColors();
  const { t, tEnum } = useLocale();
  const insets = useSafeAreaInsets();

  const partner: Partner = route.params?.partner;
  const [docs, setDocs] = useState<ProviderDocuments | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [idFrontRevealed, setIdFrontRevealed] = useState(false);
  const [idBackRevealed, setIdBackRevealed] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>(partner?.status ?? 'active');
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: () => void;
  } | null>(null);

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
        if (!cancelled) setDocs(extractProviderDocuments(dto));
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

  if (!partner) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>{t('admin.partnerNotFound')}</Text>
      </View>
    );
  }

  const cfg = STATUS_CFG[partnerStatus];
  const bgColor = hex.bg;
  const cardBg = hex.card;
  const textColor = hex.text;
  const subTextColor = hex.subtext;
  const borderColor = hex.border;
  const dividerColor = isDarkMode ? '#2d3748' : '#F3F4F6';

  const coverUri = docs?.profilePhoto?.src || partner.image;
  const avatarUri = partner.image || docs?.profilePhoto?.src || '';

  const handleTimeout = () => {
    if (partnerStatus === 'timeout') {
      setConfirm({
        title: t('admin.liftTimeout'),
        message: t('admin.liftTimeoutMsg', { name: partner.name }),
        confirmLabel: t('admin.restore'),
        confirmColor: '#00C870',
        onConfirm: () => {
          setPartnerStatus('active');
          navigation.navigate('AdminPartners', { updatedId: partner.id, updatedStatus: 'active' });
        },
      });
    } else {
      setConfirm({
        title: t('admin.timeoutPartner'),
        message: t('admin.timeoutPartnerMsg', { name: partner.name }),
        confirmLabel: t('admin.timeout'),
        confirmColor: '#D97706',
        onConfirm: () => {
          setPartnerStatus('timeout');
          navigation.navigate('AdminPartners', { updatedId: partner.id, updatedStatus: 'timeout' });
        },
      });
    }
  };

  const handleBan = () => {
    if (partnerStatus === 'banned') {
      setConfirm({
        title: t('admin.unbanPartner'),
        message: t('admin.unbanPartnerMsg', { name: partner.name }),
        confirmLabel: t('admin.unban'),
        confirmColor: '#00C870',
        onConfirm: () => {
          setPartnerStatus('active');
          navigation.navigate('AdminPartners', { updatedId: partner.id, updatedStatus: 'active' });
        },
      });
    } else {
      setConfirm({
        title: t('admin.banPartner'),
        message: t('admin.banPartnerMsg', { name: partner.name }),
        confirmLabel: t('admin.banPartner'),
        confirmColor: '#EF4444',
        onConfirm: () => {
          setPartnerStatus('banned');
          navigation.navigate('AdminPartners', { updatedId: partner.id, updatedStatus: 'banned' });
        },
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#00C870' }}>
      {/* ── Green header ── */}
      <View
        style={{
          backgroundColor: '#00C870',
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 28,
        }}>
        <TouchableOpacity
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
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginTop: 10 }}>
          {t('admin.partnerDetails')}
        </Text>
      </View>

      {/* ── Scrollable content ── */}
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          marginTop: -20,
        }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}>
          {/* ── Profile card ── */}
          <View
            style={{
              backgroundColor: cardBg,
              marginHorizontal: 20,
              marginTop: 20,
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor,
              marginBottom: 16,
            }}>
            {/* Large cover image */}
            {coverUri ? (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerUri(coverUri)}>
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

          {/* ── Stats row ── */}
          <View
            style={{
              flexDirection: 'row',
              marginHorizontal: 20,
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
                ${partner.startingPrice}
              </Text>
              <Text style={{ color: subTextColor, fontSize: 11, marginTop: 2 }}>
                Starting Price
              </Text>
            </View>
          </View>

          {/* ── Partner Documents ── */}
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
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
                <Ionicons name="document-text-outline" size={16} color="#00C870" />
              </View>
              <Text style={{ color: textColor, fontSize: 15, fontWeight: '700' }}>
                {t('admin.partnerDocuments')}
              </Text>
            </View>

            {loadingDocs ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator color="#00C870" />
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
                  iconColor="#00C870"
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
                  iconColor="#00C870"
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
                              activeOpacity={0.8}
                              onPress={() => openDownload(c.fileSrc, t)}
                              style={{ padding: 8 }}>
                              <Ionicons name="open-outline" size={20} color="#00C870" />
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
            <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
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
                  cardBg={cardBg}
                  textColor={textColor}
                  subTextColor={subTextColor}
                  borderColor={borderColor}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* ── Sticky footer ── */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: cardBg,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
            borderTopWidth: 1,
            borderTopColor: borderColor,
            flexDirection: 'row',
            gap: 12,
          }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleTimeout}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#D97706',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}>
            <Ionicons name="time-outline" size={17} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={{ color: '#D97706', fontSize: 14, fontWeight: '700' }}>
              {partnerStatus === 'timeout' ? t('admin.liftTimeout') : t('admin.timeout')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBan}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#EF4444',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            }}>
            <Ionicons name="ban-outline" size={17} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700' }}>
              {partnerStatus === 'banned' ? t('admin.unbanPartner') : t('admin.banPartner')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Confirmation modal ── */}
      <Modal
        visible={!!confirm}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirm(null)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setConfirm(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ backgroundColor: cardBg, borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ color: textColor, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>
              {confirm?.title}
            </Text>
            <Text style={{ color: subTextColor, fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              {confirm?.message}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setConfirm(null)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor,
                  alignItems: 'center',
                }}>
                <Text style={{ color: subTextColor, fontSize: 14, fontWeight: '600' }}>
                  {t('admin.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  confirm?.onConfirm();
                  setConfirm(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: confirm?.confirmColor,
                  alignItems: 'center',
                }}>
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>
                  {confirm?.confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Full-screen image viewer ── */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}>
        <Pressable
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
          color={uploaded ? '#00C870' : subTextColor}
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
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={{ position: 'relative' }}>
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
  cardBg,
  textColor,
  subTextColor,
  borderColor,
}: {
  item: ServiceHistoryItem;
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
        <Text style={{ color: textColor, fontSize: 14, fontWeight: '700' }}>$ {item.price}</Text>
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
