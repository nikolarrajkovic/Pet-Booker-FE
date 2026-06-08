import { apiAuthFetch, getApiBaseUrl, parseApiError } from './http';
import { uploadFilesBulk } from './files';

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
  petPhotoFiles: Array<{ uri: string; fileName?: string }>;
  governmentIdFiles: Array<{ uri: string; fileName?: string; isFront: boolean }>;
  certificateFiles: Array<{ uri: string; fileName?: string; certName?: string; issuer?: string; issuedDate?: string }>;
  userId: number;
};

export async function createServiceProvider(payload: CreateServiceProviderPayload): Promise<void> {
  const url = `${getApiBaseUrl()}/api/service-providers`;

  // Build a single flat upload list, tracking where each group starts:
  // [profilePhoto?, ...petPhotos, ...governmentIdFiles, ...certificateFiles]
  const allFiles: Array<{ uri: string; fileName?: string }> = [];

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
    userId: payload.userId,
    providerProfileId: 0,
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
