import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { translate, tEnumLabel, type Language, type TranslationKey, type EnumName } from '../i18n';
import { getLanguage, saveLanguage } from '../services/locale-storage';
import { registerApiLanguage } from '../services/http';

type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string;
type TEnumFn = (enumName: EnumName, value: number | null | undefined, fallback?: string) => string;

type LocaleContextType = {
  language: Language;
  /** False until the user has picked a language (drives the first-run chooser). */
  hasChosen: boolean;
  /** True while the persisted language is being restored on app start. */
  isLoading: boolean;
  setLanguage: (lang: Language) => void;
  t: TFn;
  tEnum: TEnumFn;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  // Default to English for rendering behind the first-run chooser; the real
  // choice is restored from storage (or picked by the user) below.
  const [language, setLanguageState] = useState<Language>('en');
  const [hasChosen, setHasChosen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getLanguage();
        if (cancelled) return;
        if (stored) {
          setLanguageState(stored);
          setHasChosen(true);
          registerApiLanguage(stored);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    setHasChosen(true);
    // Backend localizes validation messages / notifications / emails from the
    // Accept-Language header — keep the HTTP layer in sync with the UI language.
    registerApiLanguage(lang);
    // Persist best-effort; failure just means we ask again next cold start.
    saveLanguage(lang).catch(() => {});
  }, []);

  const t = useCallback<TFn>((key, params) => translate(language, key, params), [language]);
  const tEnum = useCallback<TEnumFn>(
    (enumName, value, fallback) => tEnumLabel(language, enumName, value, fallback),
    [language]
  );

  const value = useMemo(
    () => ({ language, hasChosen, isLoading, setLanguage, t, tEnum }),
    [language, hasChosen, isLoading, setLanguage, t, tEnum]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
};
