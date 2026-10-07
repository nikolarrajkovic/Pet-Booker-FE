import { apiJson } from './http';

/**
 * Booking payments (`/payments/bookings/{id}/*`). The amount is always computed by the server from
 * the booking's frozen prices; the client only says which slice to pay. Card processing is a mock
 * gateway for now — every charge succeeds and no money moves — behind the same API the real
 * provider will use.
 */

/** Backend `BookingPaymentPhase`. */
export const PaymentPhase = { Deposit: 0, Balance: 1 } as const;
export type PaymentPhaseValue = (typeof PaymentPhase)[keyof typeof PaymentPhase];

/** Backend `PaymentStatus`. */
export const PaymentStatus = {
  Pending: 0,
  Successful: 1,
  PartiallySuccessful: 2,
  Failed: 3,
  Refunded: 4,
} as const;

export type BookingPaymentDto = {
  id: number;
  bookingId: number;
  paymentMethodId?: number | null;
  amount: number;
  currency: string;
  status: number;
  paidAt: string;
  refundedAt?: string | null;
};

export type BookingPaymentSummary = {
  bookingId: number;
  currency: string;
  totalPrice: number;
  depositAmount: number;
  amountPaid: number;
  amountRefunded: number;
  balanceDue: number;
  payments: BookingPaymentDto[];
};

/** What has been paid, refunded and is still owed. Readable by the customer and the provider. */
export function getPaymentSummary(bookingId: number): Promise<BookingPaymentSummary> {
  return apiJson<BookingPaymentSummary>(`/payments/bookings/${bookingId}/summary`, {
    fallback: 'Failed to load the payment summary.',
    context: 'getPaymentSummary',
  });
}

/** Pays the deposit or the rest. The customer (or an admin) only. */
export function payBooking(
  bookingId: number,
  phase: PaymentPhaseValue,
  paymentMethodId?: number | null
): Promise<BookingPaymentDto> {
  return apiJson<BookingPaymentDto>(`/payments/bookings/${bookingId}/pay`, {
    method: 'POST',
    body: { phase, paymentMethodId: paymentMethodId ?? null },
    fallback: 'The payment did not go through.',
    context: 'payBooking',
  });
}

/** Card brand from the number's leading digits — display only, never stored with the number. */
export function cardBrandOf(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(9891|6)/.test(digits)) return 'DinaCard';
  return 'Card';
}

/** "Visa •••• 4242" — the brand as a name, whatever case the gateway (or old seed data) stored it in. */
export function cardLabel(
  card: { cardBrand?: string | null; cardLast4?: string | null },
  fallbackBrand: string
): string {
  const brand = card.cardBrand?.trim();
  const name = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : fallbackBrand;
  return `${name} •••• ${card.cardLast4 ?? ''}`.trim();
}

/** Luhn check, so an obviously mistyped number is caught before anything is saved. */
export function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
