import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useToast } from '../../../context/ToastContext';
import { getErrorMessage } from '../../../services/http';
import type { PartnerApplication, ApplicationStatus, ApplicationImage } from '../components';
import {
  approveServiceProvider,
  declineServiceProvider,
  approveCertificate,
} from '../../../services/admin';

function formatBytes(n: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function openDownload(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open file', 'The file could not be opened.');
  }
}

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; bg: string; text: string; borderColor: string }
> = {
  pending: { label: 'Pending', bg: '#FEF9C3', text: '#A16207', borderColor: '#FDE047' },
  approved: { label: 'Approved', bg: '#DCFCE7', text: '#15803D', borderColor: '#86EFAC' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', text: '#B91C1C', borderColor: '#FCA5A5' },
};

export default function ApplicationReviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDarkMode, hex } = useThemeColors();
  const { showError } = useToast();
  const insets = useSafeAreaInsets();

  const application: PartnerApplication = route.params?.application;
  const [idFrontRevealed, setIdFrontRevealed] = useState(false);
  const [idBackRevealed, setIdBackRevealed] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>(application?.status ?? 'pending');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!application) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Application not found.</Text>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[status];
  const bgColor = hex.bg;
  const cardBg = hex.card;
  const textColor = hex.text;
  const subTextColor = hex.subtext;
  const borderColor = hex.border;
  const sectionBg = hex.card;
  const dividerColor = isDarkMode ? '#2d3748' : '#F3F4F6';

  const docs = application.documents;
  const providerId = application.providerId ?? Number(application.id);

  const handleApprove = async () => {
    if (!providerId) return;
    setIsSubmitting(true);
    try {
      await approveServiceProvider(providerId);
      await Promise.all((application.certificateIds ?? []).map((cid) => approveCertificate(cid)));
      setStatus('approved');
      navigation.goBack();
    } catch (e) {
      showError(getErrorMessage(e, 'Could not approve the application. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => {
    if (!providerId) return;
    Alert.alert(
      'Reject application?',
      `${application.applicantName}'s application will be marked as declined.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await declineServiceProvider(providerId, 'Application declined by admin');
              setStatus('rejected');
              navigation.goBack();
            } catch (e) {
              showError(getErrorMessage(e, 'Could not reject the application. Please try again.'));
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>
              Application Review
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              ID: {application.id}
            </Text>
          </View>
        </View>
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
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}>
          {/* ── Applicant summary card ── */}
          <View
            style={{
              backgroundColor: sectionBg,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}>
              {/* Avatar (profile photo) + name */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {docs.profilePhoto ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setViewerUri(docs.profilePhoto!.src)}
                    style={{ marginRight: 12 }}>
                    <Image
                      source={{ uri: docs.profilePhoto.src }}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: dividerColor,
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : (
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: dividerColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                    <Ionicons name="person" size={24} color={subTextColor} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textColor, fontSize: 18, fontWeight: '700' }}>
                    {application.applicantName}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="calendar-outline" size={13} color={subTextColor} />
                    <Text style={{ color: subTextColor, fontSize: 12, marginLeft: 4 }}>
                      Submitted {application.submittedDate} at {application.submittedTime}
                    </Text>
                  </View>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: cfg.bg,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: cfg.borderColor,
                  marginLeft: 8,
                }}>
                <Text style={{ color: cfg.text, fontSize: 12, fontWeight: '700' }}>
                  {cfg.label}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {application.services.map((svc) => (
                <View
                  key={svc}
                  style={{
                    backgroundColor: isDarkMode ? '#1e3a2f' : '#E8F5EF',
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}>
                  <Text style={{ color: '#00A85A', fontSize: 11, fontWeight: '500' }}>{svc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Personal Information ── */}
          <SectionCard
            icon="person-outline"
            title="Personal Information"
            sectionBg={sectionBg}
            borderColor={borderColor}
            textColor={textColor}>
            <LabelValueRow
              icon="mail-outline"
              label="Email"
              value={application.email}
              textColor={textColor}
              subTextColor={subTextColor}
            />
            <LabelValueRow
              icon="call-outline"
              label="Phone"
              value={application.phone}
              textColor={textColor}
              subTextColor={subTextColor}
            />
            <LabelValueRow
              icon="location-outline"
              label="Address"
              value={application.address}
              textColor={textColor}
              subTextColor={subTextColor}
            />
          </SectionCard>

          {/* ── Service Information ── */}
          <SectionCard
            icon="briefcase-outline"
            title="Service Information"
            sectionBg={sectionBg}
            borderColor={borderColor}
            textColor={textColor}>
            <View style={{ marginBottom: 10 }}>
              <Text
                style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
                Experience
              </Text>
              <Text style={{ color: textColor, fontSize: 13 }}>{application.experience}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 10 }} />
            <View style={{ marginBottom: 10 }}>
              <Text
                style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                About
              </Text>
              <Text style={{ color: textColor, fontSize: 13, lineHeight: 19 }}>
                {application.bio}
              </Text>
            </View>
            {application.certifications ? (
              <>
                <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 10 }} />
                <View style={{ marginBottom: 10 }}>
                  <Text
                    style={{
                      color: subTextColor,
                      fontSize: 11,
                      fontWeight: '600',
                      marginBottom: 2,
                    }}>
                    Certifications
                  </Text>
                  <Text style={{ color: textColor, fontSize: 13 }}>
                    {application.certifications}
                  </Text>
                </View>
              </>
            ) : null}
            <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 10 }} />
            <View>
              <Text
                style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
                Availability
              </Text>
              <Text style={{ color: textColor, fontSize: 13 }}>{application.availability}</Text>
            </View>
          </SectionCard>

          {/* ── Documents & Photos ── */}
          <SectionCard
            icon="document-text-outline"
            title="Documents & Photos"
            sectionBg={sectionBg}
            borderColor={borderColor}
            textColor={textColor}>
            {/* Profile Photo */}
            <DocBlock
              title="Profile Photo"
              icon="person-circle-outline"
              iconBg="#E8F5EF"
              iconColor="#00C870"
              isDarkMode={isDarkMode}
              borderColor={borderColor}
              textColor={textColor}>
              {docs.profilePhoto ? (
                <ViewableImage
                  uri={docs.profilePhoto.src}
                  height={180}
                  onPress={() => setViewerUri(docs.profilePhoto!.src)}
                />
              ) : (
                <EmptyDoc text="No profile photo uploaded" subTextColor={subTextColor} />
              )}
            </DocBlock>

            {/* Pet Photos */}
            <DocBlock
              title={`Pet Photos${docs.petPhotos.length ? ` (${docs.petPhotos.length})` : ''}`}
              icon="paw-outline"
              iconBg="#FEF3C7"
              iconColor="#D97706"
              isDarkMode={isDarkMode}
              borderColor={borderColor}
              textColor={textColor}>
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
                <EmptyDoc text="No pet photos uploaded" subTextColor={subTextColor} />
              )}
            </DocBlock>

            {/* Government ID — front & back */}
            <DocBlock
              title="Government ID"
              icon="shield-checkmark-outline"
              iconBg="#EEF2FF"
              iconColor="#6366F1"
              isDarkMode={isDarkMode}
              borderColor={borderColor}
              textColor={textColor}>
              {docs.governmentIdFront || docs.governmentIdBack ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <IdSide
                    label="Front"
                    img={docs.governmentIdFront}
                    revealed={idFrontRevealed}
                    onReveal={() => setIdFrontRevealed(true)}
                    onView={setViewerUri}
                    isDarkMode={isDarkMode}
                    textColor={textColor}
                    subTextColor={subTextColor}
                  />
                  <IdSide
                    label="Back"
                    img={docs.governmentIdBack}
                    revealed={idBackRevealed}
                    onReveal={() => setIdBackRevealed(true)}
                    onView={setViewerUri}
                    isDarkMode={isDarkMode}
                    textColor={textColor}
                    subTextColor={subTextColor}
                  />
                </View>
              ) : (
                <EmptyDoc text="No government ID uploaded" subTextColor={subTextColor} />
              )}
            </DocBlock>

            {/* Certificates */}
            <DocBlock
              title={`Certificates${docs.certificates.length ? ` (${docs.certificates.length})` : ''}`}
              icon="ribbon-outline"
              iconBg="#E8F5EF"
              iconColor="#00C870"
              isDarkMode={isDarkMode}
              borderColor={borderColor}
              textColor={textColor}
              last>
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
                          onPress={() => openDownload(c.fileSrc)}
                          style={{ padding: 8 }}>
                          <Ionicons name="open-outline" size={20} color="#00C870" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <EmptyDoc text="No certificates uploaded" subTextColor={subTextColor} />
              )}
            </DocBlock>
          </SectionCard>

          {/* ── Background Check info box ── */}
          <View
            style={{
              backgroundColor: isDarkMode ? '#1a2d3e' : '#EFF6FF',
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'flex-start',
              borderWidth: 1,
              borderColor: isDarkMode ? '#1e40af44' : '#BFDBFE',
            }}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#3B82F6"
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: '#1D4ED8', fontSize: 13, fontWeight: '700', marginBottom: 3 }}>
                Background Check
              </Text>
              <Text
                style={{ color: isDarkMode ? '#93C5FD' : '#3B82F6', fontSize: 12, lineHeight: 18 }}>
                A background check will be conducted as part of the approval process. This helps
                ensure the safety of all pets and pet owners on the platform.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* ── Sticky footer buttons ── */}
        {status === 'pending' && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: sectionBg,
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
              disabled={isSubmitting}
              onPress={handleReject}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: '#EF4444',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                opacity: isSubmitting ? 0.6 : 1,
              }}>
              <Ionicons
                name="close-circle-outline"
                size={18}
                color="#EF4444"
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '700' }}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isSubmitting}
              onPress={handleApprove}
              style={{
                flex: 2,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: '#00C870',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                opacity: isSubmitting ? 0.7 : 1,
              }}>
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="white"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>
                    Approve Application
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Status banner for already-processed applications */}
        {status !== 'pending' && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: STATUS_CONFIG[status].bg,
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
              borderTopWidth: 1,
              borderTopColor: STATUS_CONFIG[status].borderColor,
              alignItems: 'center',
            }}>
            <Text style={{ color: STATUS_CONFIG[status].text, fontSize: 15, fontWeight: '700' }}>
              Application {STATUS_CONFIG[status].label}
            </Text>
          </View>
        )}
      </View>

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

// ─── Helper components ──────────────────────────────────────────────────────────
function SectionCard({
  icon,
  title,
  children,
  sectionBg,
  borderColor,
  textColor,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  sectionBg: string;
  borderColor: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        backgroundColor: sectionBg,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
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
          <Ionicons name={icon} size={16} color="#00C870" />
        </View>
        <Text style={{ color: textColor, fontSize: 15, fontWeight: '700' }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function LabelValueRow({
  icon,
  label,
  value,
  textColor,
  subTextColor,
}: {
  icon: any;
  label: string;
  value: string;
  textColor: string;
  subTextColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
      <Ionicons name={icon} size={16} color={subTextColor} style={{ marginTop: 1 }} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={{ color: subTextColor, fontSize: 11, fontWeight: '600', marginBottom: 1 }}>
          {label}
        </Text>
        <Text style={{ color: textColor, fontSize: 13 }}>{value || '—'}</Text>
      </View>
    </View>
  );
}

/** A labelled grey block grouping one document type inside the Documents card. */
function DocBlock({
  title,
  icon,
  iconBg,
  iconColor,
  children,
  isDarkMode,
  borderColor,
  textColor,
  last,
}: {
  title: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
  isDarkMode: boolean;
  borderColor: string;
  textColor: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: isDarkMode ? '#243447' : '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        marginBottom: last ? 0 : 12,
        borderWidth: 1,
        borderColor,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
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
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{title}</Text>
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
        <Text style={{ color: 'white', fontSize: 11, marginLeft: 4 }}>Tap to view</Text>
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
  textColor,
  subTextColor,
}: {
  label: string;
  img: ApplicationImage | null;
  revealed: boolean;
  onReveal: () => void;
  onView: (uri: string) => void;
  isDarkMode: boolean;
  textColor: string;
  subTextColor: string;
}) {
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
              {revealed ? 'View' : 'Reveal'}
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
          <Text style={{ color: subTextColor, fontSize: 11, marginTop: 4 }}>Not provided</Text>
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
