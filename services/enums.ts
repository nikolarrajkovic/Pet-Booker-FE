import { apiAuthFetch, getApiBaseUrl } from './http';

export type EnumEntry = {
  value: number;
  // PascalCase identifier-style name, e.g. "PetHotel", "BankTransfer".
  name: string;
  // Human-readable, spaced label, e.g. "Pet Hotel", "Bank Transfer" (added by
  // the API). Prefer this over `name` when rendering an enum value to the user.
  displayName?: string;
};

export type EnumsData = {
  paymentType: EnumEntry[];
  serviceProviderType: EnumEntry[];
  discountType: EnumEntry[];
  bookingStatusType: EnumEntry[];
  paymentStatus: EnumEntry[];
  sex: EnumEntry[];
  // FLAGS enum: 0=None, 1=Dog, 2=Cat, 4=Parrot, 8=Turtle, 16=Fish, 32=Snake, 63=All
  petSpeciesType: EnumEntry[];
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
