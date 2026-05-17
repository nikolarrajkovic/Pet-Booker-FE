import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { loginWithEmailPassword } from '../services/auth';
import { saveTokens, getAccessToken, clearTokens } from '../services/token-storage';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  isLoggedIn: boolean;
  isLoading: boolean;
  isPartner: boolean;
  isAdmin: boolean;
  signIn: (accessToken: string, refreshToken?: string) => Promise<void>;
  signInWithCredentials: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // TODO: fetch partner status from backend after login
  const [isPartner, setIsPartner] = useState(true);
  // TODO: fetch admin status from backend after login
  const [isAdmin, setIsAdmin] = useState(true);

  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID',
  });

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await getAccessToken();
        setIsLoggedIn(!!token);
      } catch {
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuthStatus();
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
    setIsLoggedIn(true);
  };

  const signInWithCredentials = async (identifier: string, password: string) => {
    const { accessToken, refreshToken } = await loginWithEmailPassword({ identifier, password });
    await signIn(accessToken, refreshToken ?? undefined);
  };

  const signOut = async () => {
    await clearTokens();
    setIsLoggedIn(false);
  };

  const signInWithGoogle = () => {
    googlePromptAsync();
  };

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, isLoading, isPartner, isAdmin, signIn, signInWithCredentials, signOut, signInWithGoogle }}
    >
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
