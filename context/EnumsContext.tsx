import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { fetchEnums, EnumsData } from '../services/enums';
import { getErrorMessage } from '../services/http';
import { registerServiceProviderTypeLabels } from '../services/service-providers';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

type EnumsContextType = {
  enums: EnumsData | null;
  isLoading: boolean;
};

const EnumsContext = createContext<EnumsContextType | undefined>(undefined);

export const EnumsProvider = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn } = useAuth();
  const { showError } = useToast();
  const [enums, setEnums] = useState<EnumsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      // Clear cache on logout so a fresh fetch happens on next login
      setEnums(null);
      registerServiceProviderTypeLabels(null);
      return;
    }

    // Already cached — no need to fetch again
    if (enums !== null) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchEnums();
        if (!cancelled) {
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

    return () => { cancelled = true; };
  }, [isLoggedIn]);

  return (
    <EnumsContext.Provider value={{ enums, isLoading }}>
      {children}
    </EnumsContext.Provider>
  );
};

export const useEnums = () => {
  const context = useContext(EnumsContext);
  if (!context) {
    throw new Error('useEnums must be used within EnumsProvider');
  }
  return context;
};
