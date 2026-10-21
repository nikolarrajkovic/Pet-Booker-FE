import type { BookingAdditionalServiceReadDto } from '../../services/bookings';
import type { AddressDto } from '../../services/service-providers';
import type { ServiceDto } from '../../services/services';

/**
 * One appointment as the booking form builds it and Review shows and sends it — shared by the
 * two screens and the booking cart, which used to declare it twice.
 */
export type Appointment = {
  id: number;
  service: { id: number; name: string; price: number };
  pet: { id: number; name: string; image: string };
  // The extras as the SERVER priced them: name, amount, and for a per-distance extra the fees and
  // that leg's distance behind the number — everything Review needs to itemize the charge without
  // recomputing anything.
  addons: BookingAdditionalServiceReadDto[];
  // The ids the booking create will send (the quote priced exactly these).
  addonIds: number[];
  bookingFrom: string;
  bookingTo: string;
  total: number;
  // The chosen pricing option (duration/price variant) — required when the service defines
  // options. Frozen at add time: changing the selector never mutates an already-added
  // appointment. `pricingOptionBase` keeps the pre-discount option price for Review's discount line.
  pricingOptionId?: number;
  pricingOptionName?: string;
  pricingOptionBase?: number;
  // Required when a selected extra needs that side; sent inline on booking create.
  pickupAddress?: AddressDto;
  leaveOverAddress?: AddressDto;
  // The distances the server measured for each leg when it priced this selection. Display only —
  // the create re-measures from the addresses above rather than trusting a client value.
  pickupDistanceKm?: number | null;
  leaveOverDistanceKm?: number | null;
  /** What the customer wants the provider to know (feedback 2026-10-21). */
  note?: string;
};

/** One service's appointments in a checkout: what Review shows as a section. */
export type CheckoutSection = { service: ServiceDto; appointments: Appointment[] };
