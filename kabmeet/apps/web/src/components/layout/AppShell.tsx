import React from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-sun-yellow focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-night-forest"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main-content" className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
