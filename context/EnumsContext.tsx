import React, { createContext, useState, useContext, useEffect, useRef, ReactNode } from 'react';
import { fetchEnums, EnumsData } from '../services/enums';
import { getErrorMessage } from '../services/http';
import { registerServiceProviderTypeLabels } from '../services/service-providers';
import { useAuth } from './AuthContext';
import { useLocale } from './LocaleContext';
import { useToast } from './ToastContext';

type EnumsContextType = {
  enums: EnumsData | null;
  isLoading: boolean;
};

const EnumsContext = createContext<EnumsContextType | undefined>(undefined);

export const EnumsProvider = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn } = useAuth();
  const { language } = useLocale();
  const { showError } = useToast();
  const [enums, setEnums] = useState<EnumsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Which language the cached enums were fetched for — a ref, not state, so recording it
  // can't itself re-run the effect that sets it.
  const loadedForLanguage = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      // Clear cache on logout so a fresh fetch happens on next login
      setEnums(null);
      loadedForLanguage.current = null;
      registerServiceProviderTypeLabels(null);
      return;
    }

    // Cached *for this language* — no need to fetch again. The cache used to be keyed on
    // nothing but "have we fetched yet?", and /enums is localized by Accept-Language, so
    // every label it feeds (service types, booking states, species…) stayed frozen in
    // whatever language was active at login: switching to Serbian translated the chrome
    // while the labels beside it stayed English until the next logout.
    if (loadedForLanguage.current === language) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchEnums();
        if (!cancelled) {
          loadedForLanguage.current = language;
          setEnums(data);
          // Feed the serviceProviderType displayNames into the service-type label
          // resolver so labels everywhere come from /enums, not a static map.
          registerServiceProviderTypeLabels(data.serviceProviderType);
        }
      } catch (error) {
        if (!cancelled) {
          showError(getErrorMessage(error, 'Some app data could not be loaded. Please try again.'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, language, showError]);

  return <EnumsContext.Provider value={{ enums, isLoading }}>{children}</EnumsContext.Provider>;
};

export const useEnums = () => {
  const context = useContext(EnumsContext);
  if (!context) {
    throw new Error('useEnums must be used within EnumsProvider');
  }
  return context;
};
