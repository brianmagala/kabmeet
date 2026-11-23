'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Gauge, Moon, Radio, Sun } from 'lucide-react';
import { useTheme, useToast } from '@/components/layout/Providers';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Discover' },
  { href: '/communities', label: 'Communities' },
  { href: '/classes', label: 'Classes' },
  { href: '/host-panel', label: 'Host Panel' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme, dataSaver, toggleDataSaver } = useTheme();
  const { pushToast } = useToast();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleToggleDataSaver = () => {
    toggleDataSaver();
    pushToast(
      dataSaver
        ? 'Data saver turned off. Standard video quality restored.'
        : 'Data saver active. Rooms will prefer audio-only and 360p streams.',
      'info',
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-amber-gold/35 bg-indaba-deep-green text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:gap-8 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-2xl font-bold uppercase tracking-[0.08em] text-white transition-opacity duration-fast hover:opacity-90"
        >
          <Radio className="h-5 w-5 text-signal-green" strokeWidth={2} aria-hidden="true" />
          <span>Kabmeet</span>
        </Link>

        {/* Zone 2: Spaced-Capital Desktop Navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-6 md:flex lg:gap-8"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative shrink-0 whitespace-nowrap py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors duration-fast',
                  isActive
                    ? 'text-signal-green'
                    : 'text-white/85 hover:text-white',
                )}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-pill bg-signal-green"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Utility Controls + Primary Action */}
        <div className="relative flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleToggleDataSaver}
            aria-pressed={dataSaver}
            aria-label={dataSaver ? 'Disable data saver mode' : 'Enable data saver mode'}
            title={dataSaver ? 'Data saver on (360p / audio)' : 'Data saver off'}
            className={cn(
              'inline-flex h-10 min-w-[40px] items-center justify-center gap-1.5 rounded-pill border px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-fast',
              dataSaver
                ? 'border-sun-yellow bg-sun-yellow text-night-forest'
                : 'border-white/25 bg-white/10 text-white hover:border-amber-gold hover:bg-white/15',
            )}
          >
            <Gauge className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="hidden lg:inline">Data saver</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-white/25 bg-white/10 text-white transition-colors duration-fast hover:border-amber-gold hover:bg-white/15"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            aria-expanded={notificationsOpen}
            aria-label="Open notifications"
            className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-white/25 bg-white/10 text-white transition-colors duration-fast hover:border-amber-gold hover:bg-white/15"
          >
            <Bell className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>

          <Link
            href="/auth/login"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-pill bg-signal-green px-4 text-xs font-semibold uppercase tracking-[0.08em] text-night-forest whitespace-nowrap transition-transform duration-fast hover:brightness-95 active:scale-[0.98]"
          >
            Sign in
          </Link>

          {notificationsOpen && (
            <div
              role="dialog"
              aria-label="Notifications"
              className="absolute right-0 top-12 z-50 w-72 rounded-card border border-border bg-surface-elevated p-4 text-foreground shadow-card dark:shadow-card-dark"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.08em]">
                  Notifications
                </h2>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-xs font-medium text-kab-blue hover:underline dark:text-signal-green"
                >
                  Close
                </button>
              </div>
              <p className="py-4 text-xs text-muted">
                No session reminders yet. Reminders you set on upcoming IndabaX or class sessions will show up here.
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
