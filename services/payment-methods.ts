import { apiJson, apiList, apiVoid } from './http';

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
  const methods = await apiList<PaymentMethodDto>('/api/payment-methods', {
    query: { UserId: userId, Page: 1, PerPage: 50 },
    fallback: 'Failed to load payment methods.',
    context: 'getPaymentMethods',
  });
  // Only surface active methods by default
  return methods.filter((m) => m.status === PaymentMethodStatus.Active);
}

/**
 * Drops keys whose value is `null`/`undefined`.
 *
 * The optional card fields are typed nullable here and *documented* as nullable, but the API
 * columns behind `cardHolderName`, `cardBrand`, `cardLast4` and `providerToken` are not: an
 * explicit `null` reaches the insert and comes back as a **500 with an opaque body** (verified
 * live 2026-08-10), while omitting the key is accepted and stored as empty. Since "no card
 * holder name" and "the JSON key is absent" mean the same thing to a caller, strip them rather
 * than making every call site remember which of the two spellings the server survives.
 */
function withoutNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) as Partial<T>;
}

export function createPaymentMethod(
  method: Omit<PaymentMethodDto, 'id'>
): Promise<PaymentMethodDto> {
  return apiJson<PaymentMethodDto>('/api/payment-methods', {
    method: 'POST',
    body: { id: 0, ...withoutNulls(method) },
    fallback: 'Failed to save payment method.',
    context: 'createPaymentMethod',
  });
}

export function deletePaymentMethod(id: number): Promise<void> {
  return apiVoid(`/api/payment-methods/${id}`, {
    method: 'DELETE',
    fallback: 'Failed to remove payment method.',
    context: 'deletePaymentMethod',
  });
}

/**
 * A usable paymentMethodId for the user — their default (or first) active method, creating a
 * placeholder one when they have none.
 *
 * Every booking must reference a real PaymentMethod row, and so must a group request (the
 * booking a provider creates by accepting it carries the request's method). Real payment UX is
 * future work, so a user with no saved method gets a `manual` placeholder rather than a dead end.
 * Shared by ReviewBooking and the group-request form so the two cannot drift.
 *
 * @param paymentType PaymentType for the placeholder, when one has to be created.
 */
export async function ensurePaymentMethodId(userId: number, paymentType: number): Promise<number> {
  const existing = await getPaymentMethods(userId);
  if (existing.length) {
    const def = existing.find((m) => m.isDefault) ?? existing[0];
    if (def.id != null) return def.id;
  }
  const created = await createPaymentMethod({
    userId,
    type: paymentType,
    provider: 'manual',
    providerPaymentMethodId: `manual-${userId}-${Date.now()}`,
    isDefault: true,
    status: PaymentMethodStatus.Active,
    cardHolderName: 'Account Holder',
  });
  if (created.id == null) throw new Error('Could not create a payment method.');
  return created.id;
}
