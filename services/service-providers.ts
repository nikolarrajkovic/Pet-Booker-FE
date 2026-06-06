import { apiAuthFetch } from './http';

function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set.');
  }

  return baseUrl.replace(/\/$/, '');
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
};

export async function createServiceProvider(formData: CreateServiceProviderPayload): Promise<void> {
  const url = `${getApiBaseUrl()}/api/service-providers`;

  const body = {
    name: formData.fullName,
    displayName: formData.fullName,
    type: 0,
    serviceType: formData.selectedServices.join(', '),
    city: formData.city,
    photoUrl: '',
    ratingAvg: 0,
    isApplicationPartner: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    address: {
      line1: formData.streetAddress,
      city: formData.city,
      state: formData.state,
      postalCode: formData.zipCode,
      country: 'US',
    },
    photos: [],
  };

  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = 'Failed to submit application.';
    try {
      const json = JSON.parse(text);
      message = json.message ?? json.detail ?? message;
    } catch {
      // use default message
    }
    throw new Error(message);
  }
}
