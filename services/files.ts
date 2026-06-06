import { Platform } from 'react-native';
import { apiAuthFetch } from './http';

/**
 * Maps a MIME type to a file extension.
 */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
  };
  return map[mime] ?? mime.split('/')[1] ?? 'bin';
}

/**
 * Converts a base64 data URI (e.g. "data:image/jpeg;base64,/9j/...") into a
 * File object without making any network/blob-URL request.
 */
function dataUriToFile(dataUri: string, name: string): File {
  const [header, base64] = dataUri.split(',');
  const type = header.split(':')[1].split(';')[0];
  const ext = mimeToExt(type);
  // Ensure the name always carries the correct extension.
  const nameWithExt = name.includes('.') ? name : `${name}.${ext}`;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], nameWithExt, { type });
}

function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set.');
  }

  return baseUrl.replace(/\/$/, '');
}

export type UploadedFile = {
  id: string;
  src: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

/**
 * Uploads an image (or any file) to /files/upload.
 *
 * @param uri      - Local file URI from expo-image-picker / expo-document-picker
 * @param fileName - Original file name (e.g. "photo.jpg"). Falls back to the last segment of the URI.
 * @param mimeType - MIME type (e.g. "image/jpeg"). Defaults to "image/jpeg".
 */
export async function uploadFile(
  uri: string,
  fileName?: string,
  mimeType?: string,
): Promise<UploadedFile> {
  const url = `${getApiBaseUrl()}/files/upload`;

  const formData = new FormData();
  if (Platform.OS === 'web') {
    // On web the URI is a base64 data URI — derive the name and extension from
    // the embedded MIME type; do not attempt to parse the data URI as a path.
    const detectedMime = uri.split(',')[0].split(':')[1].split(';')[0];
    const ext = mimeToExt(detectedMime);
    const webName = fileName ?? `upload.${ext}`;
    const file = dataUriToFile(uri, webName);
    formData.append('file', file);
  } else {
    // React Native requires the { uri, name, type } object shape when appending a file
    const name = fileName ?? uri.split('/').pop() ?? 'upload';
    const type = mimeType ?? 'image/jpeg';
    formData.append('file', { uri, name, type } as unknown as Blob);
  }

  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `File upload failed (${response.status}).`;
    try {
      const json = JSON.parse(text);
      message = json.message ?? json.detail ?? json.title ?? text ?? message;
    } catch {
      if (text) message = text;
    }
    console.error('[uploadFile] error', response.status, text);
    throw new Error(message);
  }

  return response.json() as Promise<UploadedFile>;
}

/**
 * Uploads multiple files to /files/upload/bulk in a single request.
 *
 * @param files - Array of { uri, fileName?, mimeType? } descriptors
 */
export async function uploadFilesBulk(
  files: Array<{ uri: string; fileName?: string; mimeType?: string }>,
): Promise<UploadedFile[]> {
  const url = `${getApiBaseUrl()}/files/upload/bulk`;

  const formData = new FormData();

  if (Platform.OS === 'web') {
    files.forEach(({ uri, fileName }) => {
      // Derive name and extension from the MIME type embedded in the data URI.
      const mimeType = uri.split(',')[0].split(':')[1].split(';')[0];
      const ext = mimeToExt(mimeType);
      const name = fileName ?? `upload.${ext}`;
      const file = dataUriToFile(uri, name);
      formData.append('files', file);
    });
  } else {
    files.forEach(({ uri, fileName, mimeType }) => {
      const name = fileName ?? uri.split('/').pop() ?? 'upload';
      const type = mimeType ?? 'image/jpeg';
      formData.append('files', { uri, name, type } as unknown as Blob);
    });
  }

  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Bulk file upload failed (${response.status}).`;
    try {
      const json = JSON.parse(text);
      message = json.message ?? json.detail ?? json.title ?? text ?? message;
    } catch {
      if (text) message = text;
    }
    console.error('[uploadFilesBulk] error', response.status, text);
    throw new Error(message);
  }

  return response.json() as Promise<UploadedFile[]>;
}
