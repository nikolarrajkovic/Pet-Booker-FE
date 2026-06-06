import { apiAuthFetch } from './http';

function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set.');
  }
  return baseUrl.replace(/\/$/, '');
}

export type EnumEntry = {
  value: number;
  name: string;
};

export type EnumsData = {
  paymentType: EnumEntry[];
  serviceProviderType: EnumEntry[];
  discountType: EnumEntry[];
  bookingStatusType: EnumEntry[];
  paymentStatus: EnumEntry[];
  sex: EnumEntry[];
  paymentMethodStatus: EnumEntry[];
  bookingState: EnumEntry[];
  providerProfileStatus: EnumEntry[];
  pushPlatform: EnumEntry[];
  emailTemplateType: EnumEntry[];
  // future enum groups added by the backend will be available here too
  [key: string]: EnumEntry[];
};

export async function fetchEnums(): Promise<EnumsData> {
  const url = `${getApiBaseUrl()}/enums`;

  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to load enums (${response.status})`);
  }

  return response.json() as Promise<EnumsData>;
}
