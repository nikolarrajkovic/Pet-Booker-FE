import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import type { Appointment, CheckoutSection } from '../screens/book-service-screen/appointment';
import type { ServiceDto } from '../services/services';

type BookingCartContextType = {
  /** Services set aside for one checkout, each with its appointments, in the order added. */
  sections: CheckoutSection[];
  /** Appointments across every service in the cart. */
  count: number;
  /** Puts a service's appointments in the cart (after any already there for that service). */
  add: (service: ServiceDto, appointments: Appointment[]) => void;
  /** Takes a service out of the cart, with its appointments. */
  removeService: (serviceId: number) => void;
  /** The cart plus one more service's appointments, merged when it is already in it. */
  withSection: (service: ServiceDto, appointments: Appointment[]) => CheckoutSection[];
  clear: () => void;
};

/**
 * Outside the provider (a screen rendered on its own, in a test) the cart is simply empty and
 * keeps nothing: the booking form then checks out its own service alone, as it always did.
 */
const EMPTY_CART: BookingCartContextType = {
  sections: [],
  count: 0,
  add: () => {},
  removeService: () => {},
  withSection: (service, appointments) =>
    appointments.length > 0 ? [{ service, appointments }] : [],
  clear: () => {},
};

const BookingCartContext = createContext<BookingCartContextType>(EMPTY_CART);

// The browser tab's session storage, where there is one (the web app): a reload in the middle of
// adding services keeps them, and closing the tab forgets them. Elsewhere the cart is memory only.
const STORAGE_KEY = 'booking_cart_v1';
type Stored = { accountId: number; sections: CheckoutSection[] };

function sessionStore(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null; // storage blocked
  }
}

function readStored(accountId: number | null): CheckoutSection[] {
  if (accountId == null) return [];
  try {
    const raw = sessionStore()?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as Stored;
    // Another account's cart is never shown.
    return stored.accountId === accountId && Array.isArray(stored.sections) ? stored.sections : [];
  } catch {
    return [];
  }
}

function writeStored(accountId: number | null, sections: CheckoutSection[]) {
  // No account yet is also the moment after a reload, before the session is restored: writing
  // then would wipe the cart the reload was meant to keep. Another account never reads it anyway.
  if (accountId == null) return;
  try {
    const store = sessionStore();
    if (!store) return;
    if (sections.length === 0) store.removeItem(STORAGE_KEY);
    else store.setItem(STORAGE_KEY, JSON.stringify({ accountId, sections } satisfies Stored));
  } catch {
    // Full or blocked storage: the cart still works for this page.
  }
}

/**
 * Booking several different services in one checkout (feedback 2026-10-21): a walk from one
 * partner and a grooming from another, sent together and kept all or nothing by the server's batch
 * create. The booking form puts its appointments here ("Add another service"), Search and Home
 * show what is waiting, and Review sends the lot.
 *
 * For the session only — memory, and the tab's session storage on the web so a reload keeps it: a
 * half-made booking from yesterday would book against prices and free times that have moved since.
 * Cleared on a successful checkout, and kept per account, so one person's half-made booking never
 * shows to the next.
 */
export function BookingCartProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const accountId = currentUser?.id ?? null;
  const [sections, setSections] = useState<CheckoutSection[]>(() => readStored(accountId));
  // A different account (or signing out) starts from that account's own cart.
  useEffect(() => setSections(readStored(accountId)), [accountId]);
  useEffect(() => writeStored(accountId, sections), [accountId, sections]);

  const merge = useCallback(
    (current: CheckoutSection[], service: ServiceDto, appointments: Appointment[]) => {
      if (appointments.length === 0) return current;
      const at = current.findIndex((s) => s.service.id === service.id);
      if (at < 0) return [...current, { service, appointments }];
      return current.map((s, i) =>
        i === at ? { service, appointments: [...s.appointments, ...appointments] } : s
      );
    },
    []
  );

  const add = useCallback(
    (service: ServiceDto, appointments: Appointment[]) =>
      setSections((current) => merge(current, service, appointments)),
    [merge]
  );
  const removeService = useCallback(
    (serviceId: number) =>
      setSections((current) => current.filter((s) => s.service.id !== serviceId)),
    []
  );
  const clear = useCallback(() => setSections([]), []);
  const withSection = useCallback(
    (service: ServiceDto, appointments: Appointment[]) => merge(sections, service, appointments),
    [merge, sections]
  );

  const value = useMemo(
    () => ({
      sections,
      count: sections.reduce((n, s) => n + s.appointments.length, 0),
      add,
      removeService,
      withSection,
      clear,
    }),
    [sections, add, removeService, withSection, clear]
  );

  return <BookingCartContext.Provider value={value}>{children}</BookingCartContext.Provider>;
}

export function useBookingCart(): BookingCartContextType {
  return useContext(BookingCartContext);
}
