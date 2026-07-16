import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeContext';
import ToastView, { ToastItem, ToastVariant } from '../components/shared/Toast';

type ToastContextType = {
  /** Generic — show a toast of any variant (defaults to 'error'). */
  showToast: (message: string, variant?: ToastVariant) => void;
  /** Show a red error toast — the primary API-failure entry point. */
  showError: (message: string) => void;
  /** Show a green success toast. */
  showSuccess: (message: string) => void;
  /** Show a blue info toast. */
  showInfo: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const AUTO_DISMISS_MS = 4500;
const MAX_TOASTS = 3;

/**
 * App-wide toast host. Renders its children plus a top overlay that surfaces
 * transient messages (primarily API errors). Mounted high in the tree (under
 * ThemeProvider) so every screen can call `useToast().showError(...)`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { isDarkMode } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'error') => {
      const msg = (message ?? '').toString().trim();
      if (!msg) return;
      const id = ++idRef.current;
      setToasts((prev) => {
        // Drop any existing toast with the same text so we don't stack duplicates,
        // then cap the visible count.
        const next = [...prev.filter((t) => t.message !== msg), { id, message: msg, variant }];
        return next.slice(-MAX_TOASTS);
      });
      timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const showError = useCallback((m: string) => showToast(m, 'error'), [showToast]);
  const showSuccess = useCallback((m: string) => showToast(m, 'success'), [showToast]);
  const showInfo = useCallback((m: string) => showToast(m, 'info'), [showToast]);

  // Clear any pending timers if the provider unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo }}>
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <SafeAreaView style={{ flex: 1 }} pointerEvents="box-none">
          <View
            pointerEvents="box-none"
            style={{
              paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 8,
              paddingHorizontal: 16,
            }}>
            {toasts.map((t) => (
              <ToastView key={t.id} toast={t} isDarkMode={isDarkMode} onDismiss={dismiss} />
            ))}
          </View>
        </SafeAreaView>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
