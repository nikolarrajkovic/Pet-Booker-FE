import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { loginWithEmailPassword, getMe, logout as logoutApi, CurrentUser } from '../services/auth';
import { saveTokens, getAccessToken, clearTokens } from '../services/token-storage';
import { registerSessionExpiredHandler } from '../services/http';
import { resetShownOnce } from '../hooks/useShowOnce';
import { registerDisplayCurrency, DEFAULT_CURRENCY } from '../services/currency';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  isLoggedIn: boolean;
  isLoading: boolean;
  isPartner: boolean;
  isAdmin: boolean;
  isProviderProfile: boolean;
  currentUser: CurrentUser | null;
  signIn: (accessToken: string, refreshToken?: string) => Promise<void>;
  signInWithCredentials: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Both collections are optional-chained. `groups` always was; `roles` was not, and an
  // `/auth/me` body without it threw here — inside the provider that wraps the whole tree, with no
  // error boundary above it, so the app rendered a blank white page and nothing said why. The
  // type says `string[]`, but that is an assertion about JSON off the wire, not a guarantee.
  const isAdmin =
    (currentUser?.roles?.includes('Admin') || currentUser?.groups?.includes('Admin')) ?? false;
  // The backend marks an approved partner by adding them to the 'ServiceProvider'
  // group (there is no 'Partner' role); keep the role check as a fallback.
  const isPartner =
    (currentUser?.groups?.includes('ServiceProvider') || currentUser?.roles?.includes('Partner')) ??
    false;
  // A managed ProviderProfile login: an account that has no Domain.User behind it at all. That
  // is a different question from isPartner (a pet owner who also runs services is a User who
  // owns a ServiceProvider), and it is the one that decides whether per-user rows — notification
  // settings, pets, push devices — can exist for this session. /auth/me returns 0 here for every
  // account that does have a user row.
  const isProviderProfile = (currentUser?.providerProfileId ?? 0) > 0;

  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID',
  });

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          setIsLoggedIn(true);
          const user = await getMe();
          setCurrentUser(user);
        }
      } catch {
        setIsLoggedIn(false);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  // Mirror the user's display-currency preference into services/currency so that pure
  // formatting code can reach it. Only amounts the API doesn't stamp with a currency of
  // their own fall back to this; signing out returns it to the app default.
  useEffect(() => {
    registerDisplayCurrency(currentUser?.preferredCurrency ?? DEFAULT_CURRENCY);
  }, [currentUser?.preferredCurrency]);

  // Register a handler so http.ts can trigger sign-out when a token refresh fails,
  // without creating a circular import between services and context.
  useEffect(() => {
    registerSessionExpiredHandler(async () => {
      await clearTokens();
      setCurrentUser(null);
      setIsLoggedIn(false);
    });
  }, []);

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const token = googleResponse.authentication?.accessToken;
      if (token) {
        signIn(token);
      }
    }
  }, [googleResponse]);

  const signIn = async (accessToken: string, refreshToken?: string) => {
    await saveTokens(accessToken, refreshToken);
    const user = await getMe();
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const signInWithCredentials = async (identifier: string, password: string) => {
    const { accessToken, refreshToken } = await loginWithEmailPassword({ identifier, password });
    await signIn(accessToken, refreshToken ?? undefined);
  };

  const signOut = async () => {
    // Best-effort server-side logout; clear local state regardless of the result.
    try {
      await logoutApi();
    } catch {
      /* ignore — proceed with local sign-out */
    }
    await clearTokens();
    // Session-scoped "show this once" flags belong to the account that just left — without this
    // the next person to sign in on the same device never sees their own welcome.
    resetShownOnce();
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  const refreshUser = async () => {
    const user = await getMe();
    setCurrentUser(user);
  };

  const signInWithGoogle = () => {
    googlePromptAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isLoading,
        isPartner,
        isAdmin,
        isProviderProfile,
        currentUser,
        signIn,
        signInWithCredentials,
        signOut,
        signInWithGoogle,
        refreshUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
