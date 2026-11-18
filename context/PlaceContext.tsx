import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';
import { useLocale } from './LocaleContext';
import { DEFAULT_LOCATION, locationLabel, useLocation } from '../hooks/useLocation';
import { useResource } from '../hooks/useResource';
import { getUser } from '../services/users';
import { addressLabel } from '../services/geocoding';

/**
 * Where the customer is searching from (app review 2026-11-13, finding 44): where they are now,
 * their home address, or a place they picked on the map. Search ranks "nearest" and "our top picks"
 * from it and every card shows its distance; Home's Near You rail uses it too. The label in the
 * Home header opens the picker.
 */
export type PlaceChoice =
  | { mode: 'current' }
  | { mode: 'home' }
  | { mode: 'map'; latitude: number; longitude: number; label: string };

/** The place in use: the choice, or the next best when it can't be had. */
export type ResolvedPlace = {
  /** `default` = nothing known: the Belgrade placeholder, which nothing should rank from. */
  mode: 'current' | 'home' | 'map' | 'default';
  latitude: number;
  longitude: number;
  label: string;
  /** A real place: rank and measure from it. */
  known: boolean;
  /** Still waiting for the device's fix. */
  loading: boolean;
};

type PlaceContextValue = {
  choice: PlaceChoice;
  setChoice: (choice: PlaceChoice) => void;
};

const PlaceContext = createContext<PlaceContextValue>({
  choice: { mode: 'current' },
  setChoice: () => {},
});

const STORAGE_KEY = 'search_place_v1';

// SecureStore on native, localStorage on web, as the other per-device settings.
const store = {
  get: async (): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(STORAGE_KEY);
    return SecureStore.getItemAsync(STORAGE_KEY);
  },
  set: async (value: string) => {
    if (Platform.OS === 'web') localStorage.setItem(STORAGE_KEY, value);
    else await SecureStore.setItemAsync(STORAGE_KEY, value);
  },
};

function parseChoice(raw: string | null): PlaceChoice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.mode === 'current' || value?.mode === 'home') return { mode: value.mode };
    if (
      value?.mode === 'map' &&
      typeof value.latitude === 'number' &&
      typeof value.longitude === 'number'
    ) {
      return {
        mode: 'map',
        latitude: value.latitude,
        longitude: value.longitude,
        label: String(value.label ?? ''),
      };
    }
  } catch {
    /* a broken entry is no choice */
  }
  return null;
}

/** Remembers the choice on this device; a failed read or write just means "where I am". */
export function PlaceProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<PlaceChoice>({ mode: 'current' });

  useEffect(() => {
    let cancelled = false;
    store
      .get()
      .then((raw) => {
        const stored = parseChoice(raw);
        if (!cancelled && stored) setChoiceState(stored);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setChoice = useCallback((next: PlaceChoice) => {
    setChoiceState(next);
    store.set(JSON.stringify(next)).catch(() => {});
  }, []);

  return <PlaceContext.Provider value={{ choice, setChoice }}>{children}</PlaceContext.Provider>;
}

/** The signed-in customer's home, when it has a pin; `loading` while it is still being read. */
export function useHomePlace(): {
  home: { latitude: number; longitude: number; label: string } | null;
  loading: boolean;
} {
  const { isLoggedIn, currentUser, isProviderProfile } = useAuth();
  const userId = currentUser?.id;
  const { data: me, isLoading } = useResource(['user', userId], () => getUser(userId as number), {
    enabled: isLoggedIn && userId != null && !isProviderProfile,
  });
  const location = me?.address?.location;
  if (!location) return { home: null, loading: isLoading };
  return {
    home: {
      latitude: location.latitude,
      longitude: location.longitude,
      label: addressLabel(me!.address!) || '',
    },
    loading: false,
  };
}

/**
 * The place to search from, resolved: the customer's choice when it can be had, else where they
 * are, else their home, else nothing known.
 */
export function usePlace() {
  const { choice, setChoice } = useContext(PlaceContext);
  const device = useLocation();
  const { home, loading: homeLoading } = useHomePlace();
  const { t } = useLocale();

  const deviceReady = !device.loading && !device.error;
  let place: ResolvedPlace;
  if (choice.mode === 'map') {
    place = {
      mode: 'map',
      latitude: choice.latitude,
      longitude: choice.longitude,
      label: choice.label || t('place.pickedOnMap'),
      known: true,
      loading: false,
    };
  } else if (choice.mode === 'home' && home) {
    place = {
      mode: 'home',
      ...home,
      label: home.label || t('place.home'),
      known: true,
      loading: false,
    };
  } else if (deviceReady) {
    place = {
      mode: 'current',
      latitude: device.latitude,
      longitude: device.longitude,
      label: locationLabel(device, t),
      known: true,
      loading: false,
    };
  } else if ((device.loading && choice.mode === 'current') || homeLoading) {
    // Still waiting for the device's fix, or for the home address it would fall back to: search
    // waits rather than loading from nowhere and again a moment later.
    place = {
      mode: 'current',
      ...DEFAULT_LOCATION,
      label: t('home.currentLocation'),
      known: false,
      loading: true,
    };
  } else if (home) {
    place = {
      mode: 'home',
      ...home,
      label: home.label || t('place.home'),
      known: true,
      loading: false,
    };
  } else {
    place = {
      mode: 'default',
      ...DEFAULT_LOCATION,
      label: t('home.defaultArea'),
      known: false,
      loading: false,
    };
  }

  return { place, choice, setChoice, home, deviceAvailable: !device.error };
}
