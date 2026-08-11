import { apiJson, apiList, apiVoid } from './http';
import { declaredWriteCurrency } from './currency';

// DiscountType enum (verified /enums): 0=Percent, 1=Fixed
export const DiscountType = { Percent: 0, Fixed: 1 } as const;

export type ServiceDiscountDto = {
  id?: number | null;
  serviceId: number;
  type: number; // DiscountType
  amount: number; // fixed amount (or generic amount)
  applyFrom: string; // ISO date-time
  /**
   * ISO date-time, optional (open-ended). Must be strictly AFTER `applyFrom` — and the active
   * window is inclusive on both ends, so a picked end DATE has to be sent as the last instant
   * of that day (`endOfDayIso`) or the offer stops before the day it names. See
   * `toWritableDiscount`.
   */
  applyTo?: string | null;
  isEnabled: boolean;
  percentAmount?: number | null; // percent value when type === Percent
  /**
   * Currency a Fixed discount's `amount` is expressed in — a Percent one is currency-free
   * and the server leaves its amount alone.
   *
   * Read: what the server converted the amount to, stamped with the code it used.
   * Write: what the amount is DECLARED to be (stamped below — omitting it would mean RSD
   * and silently rescale a discount the partner typed in EUR).
   */
  currency?: string | null;
};

/** The last instant of `d`'s local day — what "the offer runs through this date" means. */
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * A picked END DATE as the `applyTo` instant to send: the last moment of that day.
 *
 * The date pickers hand back midnight, and the server's active window is inclusive
 * (`applyFrom <= now <= applyTo`) — so sending midnight ends the promotion 24h before the
 * partner expects, and on a one-day offer makes `applyTo === applyFrom`, which the API rejects.
 */
export const endOfDayIso = (d: Date): string => endOfDay(d).toISOString();

/**
 * Makes a discount coherent before it goes on the wire.
 *
 * The API validates `Type` against the amount fields and 422s a row where they disagree
 * (`ServiceDiscountDtoValidator`, added 2026-08-06). Three rules, all enforced here rather
 * than at the call sites, because a row that reaches the server incoherent is a failed save
 * for the partner and the screens had three separate copies of the mapping:
 *
 * - **Percent** must carry a `percentAmount` in `(0, 100]`. (It may repeat the figure in
 *   `amount`; only a Fixed amount is treated as money and currency-converted.)
 * - **Fixed** must carry `amount > 0` and **no** `percentAmount` — carrying one would make
 *   the row bill as a percentage while every label read it as a flat amount.
 * - **`applyTo` must be strictly after `applyFrom`.** The screens pick whole days, so a
 *   one-day offer arrived as `applyTo === applyFrom` and was rejected outright. Pushing the
 *   end to the last instant of its day is also what the partner meant: the active window is
 *   inclusive (`applyFrom <= now <= applyTo`), so a midnight `applyTo` ended the promotion
 *   *before* the day it names had begun.
 *
 * Out-of-range amounts are left alone — clamping a mistyped "150%" to 100 would silently
 * sell something at half price. The screens validate those and say so.
 */
function toWritableDiscount(discount: ServiceDiscountDto): ServiceDiscountDto {
  const isPercent = discount.type === DiscountType.Percent;
  const percentAmount = isPercent ? (discount.percentAmount ?? discount.amount) : null;

  let applyTo = discount.applyTo ?? null;
  if (applyTo) {
    const to = new Date(applyTo);
    const from = new Date(discount.applyFrom);
    if (!isNaN(to.getTime()) && !isNaN(from.getTime()) && to <= from) {
      applyTo = endOfDay(to).toISOString();
    }
  }

  return {
    ...discount,
    percentAmount,
    applyTo,
    // See `declaredWriteCurrency` — a Fixed discount's amount is money and must say so.
    currency: declaredWriteCurrency(discount.currency),
  };
}

export type GetServiceDiscountsParams = {
  serviceId?: number;
  type?: number;
  page?: number;
  perPage?: number;
};

export function getServiceDiscounts(
  params?: GetServiceDiscountsParams
): Promise<ServiceDiscountDto[]> {
  return apiList<ServiceDiscountDto>('/api/service-discounts', {
    query: {
      ServiceId: params?.serviceId,
      Type: params?.type,
      Page: params?.page ?? 1,
      PerPage: params?.perPage ?? 50,
    },
    fallback: 'Failed to load discounts.',
    context: 'getServiceDiscounts',
  });
}

export function createServiceDiscount(discount: ServiceDiscountDto): Promise<ServiceDiscountDto> {
  return apiJson<ServiceDiscountDto>('/api/service-discounts', {
    method: 'POST',
    body: { id: 0, ...toWritableDiscount(discount) },
    fallback: 'Failed to create discount.',
    context: 'createServiceDiscount',
  });
}

export function updateServiceDiscount(
  id: number,
  discount: ServiceDiscountDto
): Promise<ServiceDiscountDto> {
  return apiJson<ServiceDiscountDto>(`/api/service-discounts/${id}`, {
    method: 'PUT',
    body: { ...toWritableDiscount(discount), id },
    fallback: 'Failed to update discount.',
    context: 'updateServiceDiscount',
  });
}

export function deleteServiceDiscount(id: number): Promise<void> {
  return apiVoid(`/api/service-discounts/${id}`, {
    method: 'DELETE',
    fallback: 'Failed to delete discount.',
    context: 'deleteServiceDiscount',
  });
}
