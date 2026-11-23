'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  dataSaver: boolean;
  toggleDataSaver: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  tone?: 'success' | 'info' | 'error';
}

interface ToastContextValue {
  pushToast: (message: string, tone?: ToastItem['tone']) => void;
  dismissToast: (id: string) => void;
}

const THEME_STORAGE_KEY = 'kabmeet-theme';
const DATA_SAVER_STORAGE_KEY = 'kabmeet-data-saver';

const ThemeContext = createContext<ThemeContextValue | null>(null);
const ToastContext = createContext<ToastContextValue | null>(null);

function isDarkDefaultRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith('/watch') || pathname.startsWith('/room');
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside Providers');
  }
  return ctx;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside Providers');
  }
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [hasExplicitChoice, setHasExplicitChoice] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Hydrate theme and data saver preferences on mount
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeState(savedTheme);
        setHasExplicitChoice(true);
      } else if (isDarkDefaultRoute(pathname)) {
        setThemeState('dark');
      }

      const savedDataSaver = window.localStorage.getItem(DATA_SAVER_STORAGE_KEY);
      if (savedDataSaver === 'true') {
        setDataSaver(true);
      }
    } catch {
      // Ignore storage failures in restricted contexts
    }
  }, [pathname]);

  // Default Watch and Room routes to dark unless the user explicitly chose otherwise
  useEffect(() => {
    if (!hasExplicitChoice) {
      setThemeState(isDarkDefaultRoute(pathname) ? 'dark' : 'light');
    }
  }, [pathname, hasExplicitChoice]);

  // Apply .dark class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    setHasExplicitChoice(true);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const toggleDataSaver = useCallback(() => {
    setDataSaver((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(DATA_SAVER_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, tone: ToastItem['tone'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4000);
    },
    [dismissToast],
  );

  const themeValue = useMemo(
    () => ({ theme, setTheme, toggleTheme, dataSaver, toggleDataSaver }),
    [theme, setTheme, toggleTheme, dataSaver, toggleDataSaver],
  );

  const toastValue = useMemo(
    () => ({ pushToast, dismissToast }),
    [pushToast, dismissToast],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={themeValue}>
        <ToastContext.Provider value={toastValue}>
          {children}

          {/* Accessible Toast Live Region */}
          <div
            aria-live="polite"
            aria-atomic="true"
            className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-full max-w-sm flex-col gap-2 md:bottom-6"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role="status"
                className="pointer-events-auto flex items-center justify-between gap-3 rounded-card border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground shadow-card transition-all duration-fast"
              >
                <div className="flex items-center gap-2.5">
                  {toast.tone === 'success' && (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-indaba-deep-green dark:text-signal-green"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                  {toast.tone === 'error' && (
                    <AlertCircle
                      className="h-4 w-4 shrink-0 text-live-red"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                  {(!toast.tone || toast.tone === 'info') && (
                    <Info
                      className="h-4 w-4 shrink-0 text-kab-blue"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                  <span>{toast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-muted transition-colors duration-fast hover:bg-background hover:text-foreground"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </ToastContext.Provider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}
