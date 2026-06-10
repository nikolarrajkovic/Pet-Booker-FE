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

export type AddressDto = {
  id?: number | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
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

export type CertificateDto = {
  id?: number | null;
  serviceProviderId?: number | null;
  name?: string | null;
  issuer?: string | null;
  url?: string | null;
  issuedOn?: string | null;
  expiresOn?: string | null;
  isApproved: boolean;
  fileIds?: number[] | null;
  // GET inflates this even though the swagger DTO omits it.
  files?: CertificateFileDto[];
};

export type ServiceProviderDto = {
  id?: number | null;
  name?: string | null;
  type: number;
  isApproved: boolean;
  ratingAvg?: number | null;       // server-computed average rating (null until reviews exist)
  userId?: number | null;
  providerProfileId?: number | null;
  addressId?: number | null;
  isApplicationPartner?: boolean;  // true when created via the partner-application flow
  createdAt?: string;
  updatedAt?: string;
  address?: AddressDto;
  photos?: PhotoDto[];
  governmentIdPhotos?: GovernmentIdPhotoDto[];
  certificates?: CertificateDto[];
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
  service: string;     // mapped from ServiceProviderType enum
  rating: number;      // from dto.ratingAvg (0 until reviews exist)
  reviews: number;     // 0 until review count is exposed at list level (Phase 2)
  distance: string;    // '' until geocoding (Phase 2)
  price: number;       // 0 until services are loaded (populated in ProviderDetail)
  image: string;       // first isSelected photo, or first photo
  verified: boolean;   // = isApproved
  latitude: number;    // 0 — not in API
  longitude: number;   // 0 — not in API
  address?: AddressDto;
};

// ServiceProviderType enum (verified against /enums): 0=Sitter, 1=Walker,
// 2=Boarder, 3=PetHotel, 4=Groomer. Mapped here to the friendly labels used by
// the HomeScreen service-type pills.
const PROVIDER_TYPE_LABELS: Record<number, string> = {
  0: 'Pet Sitting',
  1: 'Dog Walking',
  2: 'Boarding',
  3: 'Pet Hotel',
  4: 'Grooming',
};

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
    service: PROVIDER_TYPE_LABELS[dto.type] ?? 'Pet Care',
    rating: dto.ratingAvg ?? 0,
    reviews: 0,
    distance: '',
    price: 0,
    image: resolveImageUrl(selectedPhoto?.src),
    verified: dto.isApproved,
    latitude: 0,
    longitude: 0,
    address: dto.address,
  };
}

// ─── Read functions ──────────────────────────────────────────────────────────

export type GetServiceProvidersParams = {
  name?: string;
  city?: string;
  type?: number;
  page?: number;
  perPage?: number;
};

export async function getServiceProviders(params?: GetServiceProvidersParams): Promise<ServiceProviderDto[]> {
  const query = new URLSearchParams();
  if (params?.name) query.set('Name', params.name);
  if (params?.city) query.set('City', params.city);
  if (params?.type !== undefined) query.set('Type', String(params.type));
  query.set('Page', String(params?.page ?? 1));
  query.set('PerPage', String(params?.perPage ?? 50));

  const url = `${getApiBaseUrl()}/api/service-providers?${query.toString()}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load providers.', 'getServiceProviders'));
  }

  const raw = await response.json();
  return extractPageItems<ServiceProviderDto>(raw);
}

export async function getServiceProvider(id: number): Promise<ServiceProviderDto> {
  const url = `${getApiBaseUrl()}/api/service-providers/${id}`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to load provider.', 'getServiceProvider'));
  }

  return response.json();
}

/**
 * Resolves the current user's own service-provider record.
 * BACKEND-GAP (P1): there is no `userId` filter on GET /api/service-providers,
 * so we fetch the list and match client-side. Returns null if the user has none.
 */
export async function getMyProvider(userId: number): Promise<ServiceProviderDto | null> {
  const providers = await getServiceProviders({ perPage: 200 });
  return providers.find((p) => p.userId === userId) ?? null;
}

export async function deleteServiceProvider(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/service-providers/${id}`;
  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await parseApiError(response, 'Failed to delete provider.', 'deleteServiceProvider'));
  }
}

/** Returns the friendly service-type label for a ServiceProviderType enum value. */
export function providerTypeLabel(type: number): string {
  return PROVIDER_TYPE_LABELS[type] ?? 'Pet Care';
}

export type CreateServiceProviderPayload = {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  selectedServices: string[];
  yearsOfExperience: string;
  aboutYou: string;
  certifications: string;
  availability: string;
  // files
  profilePhoto: { uri: string; fileName?: string } | null;
  petPhotoFiles: { uri: string; fileName?: string }[];
  governmentIdFiles: { uri: string; fileName?: string; isFront: boolean }[];
  certificateFiles: { uri: string; fileName?: string; certName?: string; issuer?: string; issuedDate?: string }[];
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
  // serviceProviderId is omitted — the provider does not exist yet (created in this request).
  const certificates = certUploads.map((f, i) => {
    const originalFile = payload.certificateFiles[i];
    return {
      id: Number(f.id),
      name: originalFile.certName ?? f.originalName,
      issuer: originalFile.issuer ?? '',
      url: '',
      issuedOn: originalFile.issuedDate || today,
      expiresOn: today,
      isApproved: false,
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
    // New applications are not approved yet — an admin reviews and approves later
    isApproved: false,
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
      state: payload.state,
      postalCode: payload.zipCode,
      country: 'US',
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
    throw new Error(await parseApiError(response, 'Failed to submit application.', 'createServiceProvider'));
  }
}
