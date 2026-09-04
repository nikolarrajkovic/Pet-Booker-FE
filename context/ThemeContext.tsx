import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { getTheme, saveTheme } from '../services/theme-storage';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Restore the stored choice on start.
  //
  // Without this the toggle only held for as long as the tab lived: a reload on web, or a restart
  // on a handset, dropped the user straight back to light with no indication why. The setting
  // looked like it simply did not work.
  //
  // Deliberately not defaulting to the OS colour scheme — that would change the app's appearance
  // for every existing user the moment this shipped. Only an explicit choice is honoured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getTheme();
      if (!cancelled && stored) setIsDarkMode(stored === 'dark');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      // Fire-and-forget: the UI must not wait on storage to flip, and a failed write costs the
      // user a preference on next launch, not this one.
      void saveTheme(next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
