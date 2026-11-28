import React, { useState } from 'react';
import {
  CalendarDays,
  Download,
  Gauge,
  LogOut,
  Moon,
  Play,
  Radio,
  Sun,
  Trophy,
  UserCircle2,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useKabmeet, type AppRoute } from '../context/KabmeetContext';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { KabmeetSignalPrism, TopNetworkBar } from './KabmeetLoader';
import { NotificationBell } from './NotificationBell';
import { PushOptIn } from './PushOptIn';
import { SiteFooter } from './SiteFooter';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-3 text-xs font-medium text-white transition-colors duration-150 hover:border-amber-gold hover:bg-white/15"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        <span className="hidden xl:inline">Install app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-3 text-xs font-medium text-white transition-colors duration-150 hover:border-amber-gold hover:bg-white/15"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          <span className="hidden xl:inline">Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl border border-border bg-surface-elevated p-6 text-foreground shadow-xl">
              <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
                Install Kabmeet on iPhone or iPad
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                1. Tap the <strong>Share</strong> button in Safari.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 h-10 w-full rounded-full bg-signal-green text-xs font-semibold uppercase tracking-wider text-night-forest"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-full border border-amber-gold bg-night-forest px-3.5 py-2 text-xs font-medium text-sun-yellow shadow-lg md:bottom-6"
    >
      <WifiOff className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      <span>Offline mode — showing cached sessions</span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    route,
    navigate,
    user,
    role,
    theme,
    toggleTheme,
    dataSaver,
    toggleDataSaver,
    logout,
    toasts,
    dismissToast,
    isBusy,
    isSlowRequest,
    isSlowConnection,
    isSlowNetwork,
  } = useKabmeet();
  const isOnline = useOnlineStatus();

  const navLinks: Array<{ key: AppRoute; label: string; visible: boolean }> = [
    { key: 'discover', label: 'Discover', visible: true },
    { key: 'communities', label: 'Communities', visible: true },
    { key: 'events', label: 'Events', visible: true },
    { key: 'classes', label: 'Classes', visible: role !== 'VISITOR' },
    { key: 'leaderboard', label: 'Leaderboard', visible: role !== 'VISITOR' },
    {
      key: 'host-panel',
      label: 'Host Panel',
      visible: role === 'HOST' || role === 'MODERATOR' || role === 'LECTURER' || role === 'ADMIN',
    },
    { key: 'admin', label: 'Admin', visible: role === 'ADMIN' },
  ];

  const mobileTabs: Array<{ key: AppRoute; label: string; icon: typeof Radio }> = [
    { key: 'discover', label: 'Discover', icon: Radio },
    { key: 'communities', label: 'Clubs', icon: Users },
    { key: 'events', label: 'Events', icon: Trophy },
    { key: 'classes', label: 'Classes', icon: CalendarDays },
    { key: 'watch', label: 'Watch', icon: Play },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-sun-yellow focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-night-forest"
      >
        Skip to content
      </a>

      {/* IndabaX Master Header */}
      <header className="sticky top-0 z-40 w-full border-b border-amber-gold/35 bg-indaba-deep-green text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:gap-8 lg:px-8">
          {/* Brand Wordmark + Live Activity Beacon */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('discover', { communitySlug: null })}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-display text-xl font-bold uppercase tracking-[0.06em] text-white transition-opacity duration-150 hover:opacity-90 sm:gap-2 sm:text-2xl sm:tracking-[0.08em]"
            >
              <Radio className="h-4 w-4 text-signal-green sm:h-5 sm:w-5" strokeWidth={2} aria-hidden="true" />
              <span>Kabmeet</span>
            </button>
            {isBusy && (
              <span
                title={isSlowNetwork ? 'Weak network — still loading' : 'Loading section'}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-sun-yellow"
              >
                <KabmeetSignalPrism size="xs" label="Loading Kabmeet" />
                <span className="hidden sm:inline">
                  {isSlowRequest ? 'Slow link' : 'Syncing'}
                </span>
              </span>
            )}
          </div>

          {/* Spaced-Capitals Primary Nav */}
          <nav aria-label="Primary navigation" className="hidden items-center gap-5 md:flex lg:gap-7">
            {navLinks
              .filter((l) => l.visible)
              .map((link) => {
                const active = route === link.key || (link.key === 'events' && route === 'event');
                return (
                  <button
                    key={link.key}
                    type="button"
                    onClick={() => navigate(link.key, { communitySlug: null })}
                    className={`relative shrink-0 whitespace-nowrap py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-150 ${
                      active ? 'text-signal-green' : 'text-white/85 hover:text-white'
                    }`}
                  >
                    {link.label}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-signal-green"
                      />
                    )}
                  </button>
                );
              })}
          </nav>

          {/* Actions */}
          <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggleDataSaver}
              aria-pressed={dataSaver}
              aria-label={dataSaver ? 'Disable data saver mode' : 'Enable data saver mode'}
              title={dataSaver ? 'Data saver on (360p / audio)' : 'Data saver off'}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border text-xs font-medium transition-colors duration-150 sm:h-10 sm:w-auto sm:min-w-[40px] sm:px-2.5 ${
                dataSaver
                  ? 'border-sun-yellow bg-sun-yellow text-night-forest'
                  : 'border-white/25 bg-white/10 text-white hover:border-amber-gold hover:bg-white/15'
              }`}
            >
              <Gauge className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="hidden lg:inline">Data saver</span>
            </button>

            <PWAInstallButton />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-colors duration-150 hover:border-amber-gold hover:bg-white/15 sm:h-10 sm:w-10"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              )}
            </button>

            <NotificationBell buttonClass="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-colors duration-150 hover:border-amber-gold hover:bg-white/15 sm:h-10 sm:w-10" />

            {user ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate('profile')}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-signal-green px-2.5 text-xs font-semibold text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98] sm:h-10 sm:gap-2 sm:px-3.5"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="h-5 w-5 shrink-0 rounded-full border border-night-forest/20 object-cover sm:h-6 sm:w-6"
                    />
                  ) : (
                    <UserCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  )}
                  <span className="max-w-[68px] truncate sm:max-w-[110px]">
                    {user.nickname?.trim() || user.fullName.split(' ')[0]}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Sign out"
                  title="Sign out"
                  className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-colors duration-150 hover:border-live-red hover:bg-live-red/20 sm:inline-flex sm:h-10 sm:w-10"
                >
                  <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('auth')}
                className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-signal-green px-4 text-xs font-semibold uppercase tracking-[0.08em] text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
              >
                Sign in
              </button>
            )}

          </div>
        </div>
      </header>

      <TopNetworkBar active={isBusy} slow={isSlowNetwork} />

      <main id="main-content" className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      <SiteFooter />

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-amber-gold/35 bg-indaba-deep-green text-white md:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const active = route === tab.key || (tab.key === 'events' && route === 'event');
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate(tab.key)}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-1 px-1 transition-colors duration-150 ${
                  active ? 'text-signal-green' : 'text-white/80 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em]">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <OfflineIndicator />
      <PushOptIn />

      {/* Poor / Slow Network Floating Pill with Kabmeet Signal Prism */}
      {isOnline && (isSlowRequest || (isSlowConnection && isBusy)) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-4 z-50 flex items-center gap-3 rounded-2xl border border-amber-gold/60 bg-night-forest/95 px-3.5 py-2.5 text-xs text-white shadow-xl backdrop-blur-md md:bottom-6"
        >
          <KabmeetSignalPrism size="sm" label="Poor network connection" />
          <div className="min-w-0">
            <p className="font-semibold text-sun-yellow">
              {isSlowRequest ? 'Poor network — still connecting' : 'Slow network detected'}
            </p>
            <p className="text-[11px] text-mist/80">
              {dataSaver
                ? 'Data saver is protecting your stream.'
                : 'Wait a moment or switch to Data saver.'}
            </p>
          </div>
          {!dataSaver && (
            <button
              type="button"
              onClick={toggleDataSaver}
              className="shrink-0 rounded-full bg-signal-green px-3 py-1 text-[11px] font-semibold text-night-forest"
            >
              Data saver
            </button>
          )}
        </div>
      )}

      {/* Toast Live Region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-full max-w-sm flex-col gap-2 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border bg-night-forest px-4 py-3 text-xs font-medium text-white shadow-xl ${
              t.tone === 'error'
                ? 'border-live-red/75'
                : t.tone === 'success'
                  ? 'border-signal-green/70'
                  : 'border-amber-gold/55'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${
                  t.tone === 'error'
                    ? 'bg-live-red'
                    : t.tone === 'success'
                      ? 'bg-signal-green'
                      : 'bg-sun-yellow'
                }`}
              />
              <span>{t.message}</span>
            </span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss message"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-mist/75 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
