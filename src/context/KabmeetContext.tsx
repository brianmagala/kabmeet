import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AuthUser, SiteFooterConfig, UserRole } from '../types/kabmeet';
import {
  buildPath,
  parsePath,
  safeReturnPath,
  SIGN_IN_ROUTES,
  type AppRoute,
} from '../lib/routes';

export type { AppRoute };

/** Reads the CSRF value the server put in a cookie. It is not secret: it only proves the request came from our own pages. */
function readCsrfToken(): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith('kab_csrf='));
  return match ? decodeURIComponent(match.slice('kab_csrf='.length)) : null;
}

const DEFAULT_SESSION_ID = 'sess-ml-python';

export type ThemeMode = 'light' | 'dark';

export interface ToastItem {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'error';
}

interface KabmeetContextValue {
  route: AppRoute;
  activeSessionId: string;
  activeCommunitySlug: string | null;
  navigate: (
    route: AppRoute,
    opts?: { sessionId?: string; communitySlug?: string | null; replace?: boolean },
  ) => void;

  user: AuthUser | null;
  role: UserRole;
  /** True when the browser holds a signed-in session (the token itself lives in an httpOnly cookie). */
  signedIn: boolean;
  allowedRoutes: string[];
  adminConfigured: boolean;
  authLoading: boolean;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    fullName: string;
    universityId?: string;
    department?: string;
    password: string;
  }) => Promise<void>;
  claimAdmin: (payload: { email: string; fullName: string; password: string; setupCode: string }) => Promise<void>;
  updateUserProfile: (payload: {
    fullName: string;
    nickname?: string | null;
    department?: string | null;
    avatarUrl?: string | null;
  }) => Promise<AuthUser>;
  siteFooter: SiteFooterConfig;
  updateSiteFooter: (payload: Omit<SiteFooterConfig, 'updatedAt'>) => Promise<SiteFooterConfig>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;

  theme: ThemeMode;
  toggleTheme: () => void;
  dataSaver: boolean;
  toggleDataSaver: () => void;

  toasts: ToastItem[];
  pushToast: (message: string, tone?: ToastItem['tone']) => void;
  dismissToast: (id: string) => void;

  pendingRequests: number;
  isBusy: boolean;
  isNavigating: boolean;
  isSlowRequest: boolean;
  isSlowConnection: boolean;
  isSlowNetwork: boolean;
}

const KabmeetContext = createContext<KabmeetContextValue | null>(null);

const THEME_KEY = 'kabmeet-theme';
const DATA_SAVER_KEY = 'kabmeet-data-saver';

export function useKabmeet(): KabmeetContextValue {
  const ctx = useContext(KabmeetContext);
  if (!ctx) {
    throw new Error('useKabmeet must be used inside KabmeetProvider');
  }
  return ctx;
}

export function useOptionalKabmeet(): KabmeetContextValue | null {
  return useContext(KabmeetContext);
}

export function KabmeetProvider({ children }: { children: React.ReactNode }) {
  // The address bar is the source of truth at start-up, so refresh and shared links open the right screen.
  const initial = useMemo(() => parsePath(window.location.pathname), []);
  const [route, setRoute] = useState<AppRoute>(initial?.route ?? 'discover');
  const [activeSessionId, setActiveSessionId] = useState<string>(initial?.sessionId ?? DEFAULT_SESSION_ID);
  const [activeCommunitySlug, setActiveCommunitySlug] = useState<string | null>(initial?.communitySlug ?? null);
  // Where to go after sign-in when a signed-out person opened a link that needs an account.
  const returnToRef = useRef<string | null>(null);

  // The sign-in token lives in an httpOnly cookie that scripts cannot read. We only keep the user here.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>(['/', '/communities']);
  const [adminConfigured, setAdminConfigured] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [theme, setTheme] = useState<ThemeMode>('light');
  const [explicitTheme, setExplicitTheme] = useState<boolean>(false);
  const [dataSaver, setDataSaver] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [siteFooter, setSiteFooter] = useState<SiteFooterConfig>({
    tagline:
      'Kabale University AI Club & IndabaX · Self-hosted live sessions and labs at ai.kab.ac.ug/indabax',
    docsLabel: 'KAB AI Docs',
    docsUrl: 'https://ai.kab.ac.ug/indabax',
    githubLabel: 'GitHub Repository',
    githubUrl: 'https://github.com/kabale-ai/kabmeet',
    contactEmail: 'indabax@kab.ac.ug',
    contactPhone: '+256 392 890 120',
    campusLocation: 'Kikungiri Hill, Kabale University, Uganda',
  });

  const [pendingRequests, setPendingRequests] = useState<number>(0);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isSlowRequest, setIsSlowRequest] = useState<boolean>(false);
  const [isSlowConnection, setIsSlowConnection] = useState<boolean>(false);
  const navTimerRef = useRef<number | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, tone: ToastItem['tone'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => {
        if (prev.some((t) => t.message === message)) return prev;
        return [...prev.slice(-2), { id, message, tone }];
      });
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast],
  );

  // Monitor browser Network Information API for poor/slow network conditions
  useEffect(() => {
    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    };
    const conn = nav.connection;
    if (!conn) return;

    const evaluate = () => {
      const slowType =
        conn.effectiveType === 'slow-2g' ||
        conn.effectiveType === '2g' ||
        conn.effectiveType === '3g';
      const highLatency = typeof conn.rtt === 'number' && conn.rtt > 450;
      const lowBandwidth = typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < 1.2;
      setIsSlowConnection(Boolean(slowType || highLatency || lowBandwidth || conn.saveData));
    };

    evaluate();
    conn.addEventListener?.('change', evaluate);
    return () => {
      conn.removeEventListener?.('change', evaluate);
    };
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
      setPendingRequests((c) => c + 1);
      const slowTimer = window.setTimeout(() => {
        setIsSlowRequest(true);
      }, 650);

      try {
        const headers = new Headers(init.headers);
        if (!headers.has('Content-Type') && init.body) {
          headers.set('Content-Type', 'application/json');
        }
        const method = (init.method ?? 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD') {
          const csrf = readCsrfToken();
          if (csrf) headers.set('X-CSRF-Token', csrf);
        }
        const res = await fetch(url, { ...init, headers, credentials: 'same-origin' });
        if (!res.ok) {
          let message = 'Something went wrong. Please try again.';
          try {
            const data = (await res.json()) as { message?: string };
            if (data.message) message = data.message;
          } catch {
            // Use fallback
          }
          throw new Error(message);
        }
        return (await res.json()) as T;
      } finally {
        window.clearTimeout(slowTimer);
        setPendingRequests((c) => {
          const next = Math.max(0, c - 1);
          if (next === 0) setIsSlowRequest(false);
          return next;
        });
      }
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch<{
        authenticated: boolean;
        user: AuthUser | null;
        allowedRoutes: string[];
        adminConfigured: boolean;
      }>('/api/auth/session');
      setUser(data.user);
      setAllowedRoutes(data.allowedRoutes);
      setAdminConfigured(data.adminConfigured);
    } catch {
      // Non-fatal on initial probe
    } finally {
      setAuthLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    let active = true;
    apiFetch<{ footer: SiteFooterConfig }>('/api/site-footer')
      .then((res) => {
        if (active && res.footer) setSiteFooter(res.footer);
      })
      .catch(() => {
        // Keep defaults if offline
      });
    return () => {
      active = false;
    };
  }, [apiFetch]);

  // Hydrate theme & data saver preferences
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(THEME_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
        setExplicitTheme(true);
      }
      if (window.localStorage.getItem(DATA_SAVER_KEY) === 'true') {
        setDataSaver(true);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  // Watch and Room default to dark unless the user manually toggled
  useEffect(() => {
    if (!explicitTheme) {
      setTheme(route === 'watch' || route === 'room' ? 'dark' : 'light');
    }
  }, [route, explicitTheme]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setExplicitTheme(true);
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const toggleDataSaver = useCallback(() => {
    setDataSaver((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(DATA_SAVER_KEY, String(next));
      } catch {
        // Ignore
      }
      pushToast(
        next
          ? 'Data saver active: rooms prefer audio-only and 360p video.'
          : 'Data saver turned off. Standard HD video restored.',
        'info',
      );
      return next;
    });
  }, [pushToast]);

  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const showNavigating = useCallback(() => {
    setIsNavigating(true);
    if (navTimerRef.current) window.clearTimeout(navTimerRef.current);
    navTimerRef.current = window.setTimeout(() => setIsNavigating(false), 280);
  }, []);

  const navigate = useCallback(
    (
      nextRoute: AppRoute,
      opts?: { sessionId?: string; communitySlug?: string | null; replace?: boolean },
    ) => {
      const sessionId = opts?.sessionId ?? activeSessionIdRef.current;
      const communitySlug = opts && 'communitySlug' in opts ? (opts.communitySlug ?? null) : undefined;
      if (opts?.sessionId) setActiveSessionId(opts.sessionId);
      if (communitySlug !== undefined) setActiveCommunitySlug(communitySlug);
      showNavigating();
      setRoute(nextRoute);
      const path = buildPath(nextRoute, { sessionId, communitySlug: communitySlug ?? null });
      if (path !== window.location.pathname) {
        window.history[opts?.replace ? 'replaceState' : 'pushState'](null, '', path);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [showNavigating],
  );

  /** Opens an address (from the Back button, or the saved "return to" link after sign-in). */
  const applyPath = useCallback(
    (pathname: string, mode: 'none' | 'replace') => {
      const parsed = parsePath(pathname);
      if (!parsed) {
        window.history.replaceState(null, '', '/');
        setRoute('discover');
        setActiveCommunitySlug(null);
        return;
      }
      if (parsed.sessionId) setActiveSessionId(parsed.sessionId);
      setActiveCommunitySlug(parsed.communitySlug ?? null);
      showNavigating();
      setRoute(parsed.route);
      if (mode === 'replace' && pathname !== window.location.pathname) {
        window.history.replaceState(null, '', pathname);
      }
    },
    [showNavigating],
  );

  // Back and Forward buttons.
  useEffect(() => {
    const onPop = () => applyPath(window.location.pathname, 'none');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyPath]);

  // An unknown address (for example /nonsense) is tidied to "/" once, at start-up.
  useEffect(() => {
    if (!initial) window.history.replaceState(null, '', '/');
  }, [initial]);

  // After sign-in: back to the link the person came for, otherwise Discover.
  const finishSignIn = useCallback(() => {
    const target = safeReturnPath(returnToRef.current);
    returnToRef.current = null;
    if (target) applyPath(target.split(/[?#]/)[0], 'replace');
    else navigate('discover', { replace: true });
  }, [applyPath, navigate]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{
        user: AuthUser;
        allowedRoutes: string[];
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUser(res.user);
      setAllowedRoutes(res.allowedRoutes);
      pushToast(`Welcome back, ${res.user.fullName}.`, 'success');
      finishSignIn();
    },
    [apiFetch, pushToast, finishSignIn],
  );

  const register = useCallback(
    async (payload: {
      email: string;
      fullName: string;
      universityId?: string;
      department?: string;
      password: string;
    }) => {
      const res = await apiFetch<{
        user: AuthUser;
        allowedRoutes: string[];
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setUser(res.user);
      setAllowedRoutes(res.allowedRoutes);
      pushToast(`Account created! Welcome to Kabmeet, ${res.user.fullName}.`, 'success');
      finishSignIn();
    },
    [apiFetch, pushToast, finishSignIn],
  );

  const claimAdmin = useCallback(
    async (payload: { email: string; fullName: string; password: string; setupCode: string }) => {
      const res = await apiFetch<{
        user: AuthUser;
        allowedRoutes: string[];
      }>('/api/auth/claim-admin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setUser(res.user);
      setAllowedRoutes(res.allowedRoutes);
      setAdminConfigured(true);
      pushToast('Admin account claimed. You now have full platform access.', 'success');
      finishSignIn();
    },
    [apiFetch, pushToast, finishSignIn],
  );

  const updateUserProfile = useCallback(
    async (payload: {
      fullName: string;
      nickname?: string | null;
      department?: string | null;
      avatarUrl?: string | null;
    }): Promise<AuthUser> => {
      const res = await apiFetch<{ user: AuthUser }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setUser(res.user);
      pushToast('Your profile has been updated.', 'success');
      return res.user;
    },
    [apiFetch, pushToast],
  );

  const updateSiteFooter = useCallback(
    async (payload: Omit<SiteFooterConfig, 'updatedAt'>): Promise<SiteFooterConfig> => {
      const res = await apiFetch<{ footer: SiteFooterConfig }>('/api/admin/site-footer', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSiteFooter(res.footer);
      pushToast('Site footer updated across Kabmeet.', 'success');
      return res.footer;
    },
    [apiFetch, pushToast],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // The server also drops the cookie on its next check, so clear the screen regardless.
    }
    returnToRef.current = null;
    setUser(null);
    setAllowedRoutes(['/', '/communities']);
    pushToast('Signed out cleanly.', 'info');
    navigate('discover', { replace: true });
  }, [apiFetch, pushToast, navigate]);

  // A signed-out visitor who opens a link that needs an account is sent to sign in, then back to that link.
  useEffect(() => {
    if (authLoading || user || !SIGN_IN_ROUTES.has(route)) return;
    returnToRef.current = window.location.pathname;
    pushToast('Please sign in to open that page.', 'info');
    navigate('auth', { replace: true });
  }, [authLoading, user, route, navigate, pushToast]);

  const isBusy = pendingRequests > 0 || isNavigating;
  const isSlowNetwork = isSlowRequest || isSlowConnection;

  const value = useMemo<KabmeetContextValue>(
    () => ({
      route,
      activeSessionId,
      activeCommunitySlug,
      navigate,
      user,
      role: user?.role ?? 'VISITOR',
      signedIn: Boolean(user),
      allowedRoutes,
      adminConfigured,
      authLoading,
      apiFetch,
      login,
      register,
      claimAdmin,
      updateUserProfile,
      siteFooter,
      updateSiteFooter,
      logout,
      refreshSession,
      theme,
      toggleTheme,
      dataSaver,
      toggleDataSaver,
      toasts,
      pushToast,
      dismissToast,
      pendingRequests,
      isBusy,
      isNavigating,
      isSlowRequest,
      isSlowConnection,
      isSlowNetwork,
    }),
    [
      route,
      activeSessionId,
      activeCommunitySlug,
      navigate,
      user,
      allowedRoutes,
      adminConfigured,
      authLoading,
      apiFetch,
      login,
      register,
      claimAdmin,
      updateUserProfile,
      siteFooter,
      updateSiteFooter,
      logout,
      refreshSession,
      theme,
      toggleTheme,
      dataSaver,
      toggleDataSaver,
      toasts,
      pushToast,
      dismissToast,
      pendingRequests,
      isBusy,
      isNavigating,
      isSlowRequest,
      isSlowConnection,
      isSlowNetwork,
    ],
  );

  return <KabmeetContext.Provider value={value}>{children}</KabmeetContext.Provider>;
}
