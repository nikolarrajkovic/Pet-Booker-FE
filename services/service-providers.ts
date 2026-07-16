import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';
import { uploadFilesBulk } from './files';

// ─── Shared DTO types ────────────────────────────────────────────────────────

export type PhotoDto = {
  id?: number | null;
  alt?: string | null;
  name?: string | null;
  src?: string | null;
  fileUploadId?: number | null;
  isSelected: boolean;
};

/** Geo coordinates carried by an address (added to AddressDto in the API update). */
export type LocationOnLatLngDto = {
  latitude: number;
  longitude: number;
};

export type AddressDto = {
  id?: number | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  // Lat/lng for map placement — the API now embeds this on every address
  // (null until the address has been geocoded). Sent inline on write too.
  location?: LocationOnLatLngDto | null;
};

export type GovernmentIdPhotoDto = {
  id?: number | null;
  alt?: string | null;
  name?: string | null;
  src?: string | null;
  fileUploadId?: number | null;
  isFront: boolean;
};

export type CertificateFileDto = {
  id: number;
  src?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  contentType?: number | null;
  sizeBytes?: number | null;
};

// ApprovalStatus enum (providers, certificates, reviews): 0=Pending, 1=Approved, 2=Declined
export const ApprovalStatus = { Pending: 0, Approved: 1, Declined: 2 } as const;

export type CertificateDto = {
  id?: number | null;
  serviceProviderId?: number | null;
  name?: string | null;
  issuer?: string | null;
  url?: string | null;
  issuedOn?: string | null;
  expiresOn?: string | null;
  fileIds?: number[] | null;
  // Read-only fields (GET only — approval is admin-controlled):
  approvalStatus?: number;
  declineReason?: string | null;
  isApproved?: boolean;
  files?: CertificateFileDto[];
};

export type ServiceProviderDto = {
  id?: number | null;
  name?: string | null;
  type: number;
  currency?: string | null;
  contactEmail?: string | null;
  userId?: number | null;
  providerProfileId?: number | null;
  address?: AddressDto;
  photos?: PhotoDto[];
  governmentIdPhotos?: GovernmentIdPhotoDto[];
  certificates?: CertificateDto[];
  // Read-only fields (GET only):
  approvalStatus?: number; // ApprovalStatus — admin-controlled via approve/decline endpoints
  declineReason?: string | null;
  isApproved?: boolean; // legacy mirror of approvalStatus === Approved
  ratingAvg?: number | null; // server-computed average rating (null until reviews exist)
  reviewCount?: number; // number of reviews backing ratingAvg (exposed at list level now)
  addressId?: number | null;
  isApplicationPartner?: boolean; // true when created via the partner-application flow
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Canonical provider shape passed through navigation params and used by all
 * screens (HomeScreen → SearchScreen → ProviderDetail → BookService → ReviewBooking).
 * Fields not yet available from the API (reviews count, distance, lat/lng) are
 * defaulted to 0/'' and will be populated in later phases.
 */
export type ProviderViewModel = {
  id: number;
  name: string;
  service: string; // mapped from ServiceProviderType enum
  rating: number; // from dto.ratingAvg (0 until reviews exist)
  reviews: number; // 0 until review count is exposed at list level (Phase 2)
  distance: string; // '' until geocoding (Phase 2)
  price: number; // 0 until services are loaded (populated in ProviderDetail)
  image: string; // first isSelected photo, or first photo
  verified: boolean; // = isApproved
  latitude: number; // 0 — not in API
  longitude: number; // 0 — not in API
  address?: AddressDto;
};

// Service-type labels sourced from /enums `displayName` at runtime. This is the
// single source of truth for service-type labels everywhere in the app —
// registerServiceProviderTypeLabels() fills it from the serviceProviderType enum
// once enums load (see EnumsContext). PROVIDER_TYPE_LABELS below is only the
// fallback used before enums have arrived.
let runtimeTypeLabels: Record<number, string> = {};

/**
 * Populates the runtime service-type labels from the /enums serviceProviderType
 * entries — uses each entry's `displayName` (falling back to `name`). Called by
 * EnumsContext when enums load; pass null/undefined to clear (on logout).
 */
export function registerServiceProviderTypeLabels(
  entries: { value: number; name?: string; displayName?: string }[] | null | undefined
): void {
  const map: Record<number, string> = {};
  for (const e of entries ?? []) {
    const label = e.displayName ?? e.name;
    if (label) map[e.value] = label;
  }
  runtimeTypeLabels = map;
}

// Static fallback labels (ServiceProviderType enum: 0=Sitter, 1=Walker,
// 2=Boarder, 3=PetHotel, 4=Groomer, 5=Transporter) — kept in sync with the enum
// `displayName`s so there's no flash of different text before /enums loads.
export const PROVIDER_TYPE_LABELS: Record<number, string> = {
  0: 'Sitter',
  1: 'Walker',
  2: 'Boarder',
  3: 'Pet Hotel',
  4: 'Groomer',
  5: 'Transporter',
};

/** Reverse of the service-type labels — label → ServiceProviderType value. */
export function providerTypeValue(label: string): number | undefined {
  const runtime = Object.entries(runtimeTypeLabels).find(([, l]) => l === label);
  if (runtime) return Number(runtime[0]);
  const entry = Object.entries(PROVIDER_TYPE_LABELS).find(([, l]) => l === label);
  return entry ? Number(entry[0]) : undefined;
}

/** Builds a full image URL from a relative `/files/...` path or returns as-is if already absolute. */
export function resolveImageUrl(src: string | null | undefined): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  try {
    return `${getApiBaseUrl()}${src}`;
  } catch {
    return src;
  }
}

/** Maps a raw ServiceProviderDto to the ProviderViewModel used by all screens. */
export function providerToViewModel(dto: ServiceProviderDto): ProviderViewModel {
  const selectedPhoto = dto.photos?.find((p) => p.isSelected) ?? dto.photos?.[0];
  return {
    id: dto.id ?? 0,
    name: dto.name ?? 'Unknown Provider',
    service: providerTypeLabel(dto.type),
    rating: dto.ratingAvg ?? 0,
    reviews: dto.reviewCount ?? 0,
    distance: '',
    price: 0,
    image: resolveImageUrl(selectedPhoto?.src),
    verified:
      dto.approvalStatus != null
        ? dto.approvalStatus === ApprovalStatus.Approved
        : !!dto.isApproved,
    // The address now carries geo coords (null until geocoded) — use them for
    // map markers instead of the old 0/0 placeholder.
    latitude: dto.address?.location?.latitude ?? 0,
    longitude: dto.address?.location?.longitude ?? 0,
    address: dto.address,
  };
}

// ─── Provider documents (profile photo / pet photos / gov ID / certificates) ──

/** A viewable image document — absolute URL ready for <Image>. */
export type ProviderDocumentImage = { src: string; name: string };

/** A certificate file: an image (viewable inline) or another file type (downloadable). */
export type ProviderDocumentCertificate = {
  name: string;
  issuer: string;
  fileSrc: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  isImage: boolean;
};

/** The full set of documents a provider/applicant uploads, with resolved URLs. */
export type ProviderDocuments = {
  profilePhoto: ProviderDocumentImage | null;
  petPhotos: ProviderDocumentImage[];
  governmentIdFront: ProviderDocumentImage | null;
  governmentIdBack: ProviderDocumentImage | null;
  certificates: ProviderDocumentCertificate[];
};

/**
 * Pulls a provider's documents out of a ServiceProviderDto into a flat,
 * render-ready shape with absolute URLs. Single source of truth for the
 * profile-photo / pet-photo / government-ID / certificate split used by the
 * admin review and partner-details screens.
 *
 * - profile photo = the `isSelected` photo (or the first photo)
 * - pet photos    = every other uploaded photo
 * - government ID  = `governmentIdPhotos` split into front/back via `isFront`
 * - certificates   = every certificate's files flattened into viewable entries
 */
export function extractProviderDocuments(dto: ServiceProviderDto): ProviderDocuments {
  const photos = dto.photos ?? [];
  const profilePhotoDto = photos.find((p) => p.isSelected) ?? photos[0];
  const petPhotoDtos = photos.filter((p) => p !== profilePhotoDto && p.src);
  const govIds = dto.governmentIdPhotos ?? [];
  const govFrontDto = govIds.find((p) => p.isFront) ?? govIds[0];
  const govBackDto = govIds.find((p) => p !== govFrontDto);
  const certificates = (dto.certificates ?? []).flatMap((cert) =>
    (cert.files ?? [])
      .filter((f) => f.src)
      .map((f) => ({
        name: cert.name ?? 'Certificate',
        issuer: cert.issuer ?? '',
        fileSrc: resolveImageUrl(f.src ?? ''),
        fileName: f.originalName ?? 'certificate',
        sizeBytes: f.sizeBytes ?? 0,
        mimeType: f.mimeType ?? '',
        isImage: (f.mimeType ?? '').startsWith('image/'),
      }))
  );

  return {
    profilePhoto: profilePhotoDto?.src
      ? { src: resolveImageUrl(profilePhotoDto.src), name: profilePhotoDto.name ?? 'Profile Photo' }
      : null,
    petPhotos: petPhotoDtos.map((p) => ({
      src: resolveImageUrl(p.src as string),
      name: p.name ?? 'Pet Photo',
    })),
    governmentIdFront: govFrontDto?.src
      ? { src: resolveImageUrl(govFrontDto.src), name: govFrontDto.name ?? 'Government ID (Front)' }
      : null,
    governmentIdBack: govBackDto?.src
      ? { src: resolveImageUrl(govBackDto.src), name: govBackDto.name ?? 'Government ID (Back)' }
      : null,
    certificates,
  };
}

// ─── Read functions ──────────────────────────────────────────────────────────

export type GetServiceProvidersParams = {
  name?: string;
  city?: string;
  type?: number;
  isApproved?: boolean;
  approvalStatus?: number; // ApprovalStatus
  page?: number;
  perPage?: number;
};

export async function getServiceProviders(
  params?: GetServiceProvidersParams
): Promise<ServiceProviderDto[]> {
  const query = new URLSearchParams();
  if (params?.name) query.set('Name', params.name);
  if (params?.city) query.set('City', params.city);
  if (params?.type !== undefined) query.set('Type', String(params.type));
  if (params?.isApproved !== undefined) query.set('IsApproved', String(params.isApproved));
  if (params?.approvalStatus !== undefined)
    query.set('ApprovalStatus', String(params.approvalStatus));
  query.set('Page', String(params?.page ?? 1));
  query.set('PerPage', String(params?.perPage ?? 50));

  const url = `${getApiBaseUrl()}/api/service-providers?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to load providers.', 'getServiceProviders')
    );
  }

  const raw = await response.json();
  return extractPageItems<ServiceProviderDto>(raw);
}

export async function getServiceProvider(id: number): Promise<ServiceProviderDto> {
  const url = `${getApiBaseUrl()}/api/service-providers/${id}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to load provider.', 'getServiceProvider')
    );
  }

  return response.json();
}

// NOTE: a partner's own provider id is now exposed on /auth/me as
// `currentUser.serviceProviderId` (P1 resolved) — read it directly instead of
// fetching the provider list. (The old getMyProvider helper has been removed.)

export async function deleteServiceProvider(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/service-providers/${id}`;
  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to delete provider.', 'deleteServiceProvider')
    );
  }
}

/** Returns the service-type label (enum `displayName`) for a ServiceProviderType value. */
export function providerTypeLabel(type: number): string {
  return runtimeTypeLabels[type] ?? PROVIDER_TYPE_LABELS[type] ?? 'Pet Care';
}

export type CreateServiceProviderPayload = {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  // State is no longer collected in the partner application (Belgrade-first);
  // the address `state` falls back to an empty string (accepted by the backend).
  state?: string;
  // ISO country code chosen in the phone-number country picker; used as the
  // address country. Defaults to Serbia when unset.
  country?: string;
  zipCode: string;
  selectedServices: string[];
  yearsOfExperience: string;
  aboutYou: string;
  motivation: string;
  // files
  profilePhoto: { uri: string; fileName?: string } | null;
  petPhotoFiles: { uri: string; fileName?: string }[];
  governmentIdFiles: { uri: string; fileName?: string; isFront: boolean }[];
  certificateFiles: {
    uri: string;
    fileName?: string;
    certName?: string;
    issuer?: string;
    issuedDate?: string;
  }[];
  userId: number;
};

export async function createServiceProvider(payload: CreateServiceProviderPayload): Promise<void> {
  const url = `${getApiBaseUrl()}/api/service-providers`;

  // Build a single flat upload list, tracking where each group starts:
  // [profilePhoto?, ...petPhotos, ...governmentIdFiles, ...certificateFiles]
  const allFiles: { uri: string; fileName?: string }[] = [];

  const profileIndex = payload.profilePhoto ? 0 : -1;
  if (payload.profilePhoto) allFiles.push(payload.profilePhoto);

  const petStartIndex = allFiles.length;
  allFiles.push(...payload.petPhotoFiles);

  const govIdStartIndex = allFiles.length;
  allFiles.push(...payload.governmentIdFiles);

  const certStartIndex = allFiles.length;
  allFiles.push(...payload.certificateFiles);

  // One bulk upload for everything — same pattern as createPet
  const uploaded = allFiles.length ? await uploadFilesBulk(allFiles) : [];

  const profileUpload = profileIndex >= 0 ? (uploaded[profileIndex] ?? null) : null;
  const petUploads = uploaded.slice(petStartIndex, govIdStartIndex);
  const govIdUploads = uploaded.slice(govIdStartIndex, certStartIndex);
  const certUploads = uploaded.slice(certStartIndex);

  const today = new Date().toISOString().split('T')[0];

  // One certificate entry per uploaded file, referencing it by fileIds[].
  // serviceProviderId is omitted — the provider does not exist yet (created in
  // this request). Approval state is server-controlled (starts Pending).
  const certificates = certUploads.map((f, i) => {
    const originalFile = payload.certificateFiles[i];
    return {
      // The certificate is a NEW entity — its id must be 0 so the DB generates it.
      // Sending the file-upload id here 500s with "Cannot insert explicit value for
      // identity column in table 'Certificates'". The upload is referenced via fileIds.
      id: 0,
      name: originalFile.certName ?? f.originalName,
      issuer: originalFile.issuer ?? '',
      url: '',
      issuedOn: originalFile.issuedDate || today,
      expiresOn: today,
      fileIds: [Number(f.id)],
    };
  });

  // Government ID photos — front/back flagged via isFront
  const governmentIdPhotos = govIdUploads.map((f, i) => ({
    id: Number(f.id),
    alt: f.originalName,
    name: f.originalName,
    src: f.src,
    fileUploadId: Number(f.id),
    isFront: payload.governmentIdFiles[i].isFront,
  }));

  // Pet photos go into the provider's photos[] array alongside the profile photo
  const petPhotoEntries = petUploads.map((f) => ({
    id: Number(f.id),
    alt: f.originalName,
    name: f.originalName,
    src: f.src,
    fileUploadId: Number(f.id),
    isSelected: false,
  }));

  const body = {
    id: 0,
    name: payload.fullName,
    type: 0,
    // Approval is server-controlled: new applications start Pending — an admin
    // approves/declines later via the /admin endpoints.
    contactEmail: payload.email,
    // The API enforces a XOR: exactly ONE of userId / providerProfileId may be set.
    // An applicant is a user, so providerProfileId MUST be null here (sending 0 counts
    // as "provided" and trips the CK_ServiceProvider_OwnerXor DB constraint → 500).
    userId: payload.userId,
    providerProfileId: null,
    address: {
      id: 0,
      line1: payload.streetAddress,
      line2: '',
      city: payload.city,
      // State is no longer collected in the application (Belgrade-first). The
      // backend accepts an empty string (verified live), and leaving it blank
      // keeps the admin address line clean (no duplicated city).
      state: payload.state ?? '',
      postalCode: payload.zipCode,
      // Country comes from the phone-number country picker (ISO code), defaulting
      // to Serbia (the Belgrade-first audience) when not set.
      country: payload.country || 'RS',
    },
    photos: [
      ...(profileUpload
        ? [
            {
              id: Number(profileUpload.id),
              alt: profileUpload.originalName,
              name: profileUpload.originalName,
              src: profileUpload.src,
              fileUploadId: Number(profileUpload.id),
              isSelected: true,
            },
          ]
        : []),
      ...petPhotoEntries,
    ],
    governmentIdPhotos,
    certificates,
  };

  console.log('[createServiceProvider] body', JSON.stringify(body, null, 2));

  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to submit application.', 'createServiceProvider')
    );
  }
}
