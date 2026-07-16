import { apiAuthFetch, getApiBaseUrl, parseApiError, extractPageItems } from './http';

// PaymentMethodStatus enum (verified /enums): 0=Active, 1=Removed
export const PaymentMethodStatus = { Active: 0, Removed: 1 } as const;

export type PaymentMethodDto = {
  id?: number | null;
  userId: number;
  type: number; // PaymentType: 0=Cash, 1=Card, 2=BankTransfer, 3=Wallet
  provider?: string | null;
  providerPaymentMethodId?: string | null;
  cardHolderName?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  brand?: string | null;
  last4?: string | null;
  expirationMonth?: number | null;
  expirationYear?: number | null;
  providerToken?: string | null;
  isDefault: boolean;
  status: number; // PaymentMethodStatus
};

export async function getPaymentMethods(userId: number): Promise<PaymentMethodDto[]> {
  const url = `${getApiBaseUrl()}/api/payment-methods?UserId=${userId}&Page=1&PerPage=50`;
  const response = await apiAuthFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to load payment methods.', 'getPaymentMethods')
    );
  }

  const raw = await response.json();
  // Only surface active methods by default
  return extractPageItems<PaymentMethodDto>(raw).filter(
    (m) => m.status === PaymentMethodStatus.Active
  );
}

export async function createPaymentMethod(
  method: Omit<PaymentMethodDto, 'id'>
): Promise<PaymentMethodDto> {
  const url = `${getApiBaseUrl()}/api/payment-methods`;
  const response = await apiAuthFetch(url, {
    method: 'POST',
    body: JSON.stringify({ id: 0, ...method }),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to save payment method.', 'createPaymentMethod')
    );
  }

  return response.json();
}

export async function deletePaymentMethod(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/payment-methods/${id}`;
  const response = await apiAuthFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, 'Failed to remove payment method.', 'deletePaymentMethod')
    );
  }
}
