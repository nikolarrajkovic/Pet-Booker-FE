import { apiJson, extractPage, type PagedResult } from './http';

/** One payment on the admin Payments screen (`GET /admin/payments`). */
export type AdminPaymentDto = {
  id: number;
  bookingId: number;
  /** PaymentType: 0 cash, 1 card. */
  type: number;
  /** PaymentStatus (services/payments.ts). */
  status: number;
  /** As charged, in `currency` (storage currency; never converted for display). */
  amount: number;
  currency: string;
  paidAt: string;
  refundedAt?: string | null;
  providerReference?: string | null;
  refundReference?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  serviceName: string;
  serviceProviderId: number;
  providerName: string;
  customerId: number;
  customerName: string;
  /** Wall clock, like every booking time (parseBookingDate). */
  bookingFrom: string;
  bookingStatus: number;
};

/** What every payment the search matched adds up to, whatever the status filter. */
export type AdminPaymentTotals = {
  count: number;
  captured: number;
  refunded: number;
  cardCaptured: number;
  cashCaptured: number;
  successful: number;
  refundedCount: number;
  pending: number;
  failed: number;
  currency: string;
};

export type AdminPaymentsParams = {
  status?: number;
  type?: number;
  query?: string;
  perPage?: number;
};

export type AdminPaymentsPage = PagedResult<AdminPaymentDto> & {
  totals: AdminPaymentTotals | null;
};

/** GET /admin/payments — every payment, newest first, plus the totals of what matched. */
export async function getAdminPaymentsPage(
  params: AdminPaymentsParams,
  page: number
): Promise<AdminPaymentsPage> {
  const raw = await apiJson<Record<string, unknown>>('/admin/payments', {
    query: {
      status: params.status,
      type: params.type,
      query: params.query || undefined,
      page,
      perPage: params.perPage ?? 20,
    },
    fallback: "Couldn't load payments.",
    context: 'getAdminPaymentsPage',
  });
  return {
    ...extractPage<AdminPaymentDto>(raw),
    totals: (raw?.totals as AdminPaymentTotals | undefined) ?? null,
  };
}
