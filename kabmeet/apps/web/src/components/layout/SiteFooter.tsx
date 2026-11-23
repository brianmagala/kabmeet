import React from 'react';
import Link from 'next/link';
import { ExternalLink, Radio, ShieldCheck } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-[0.08em] text-indaba-deep-green dark:text-signal-green">
            <Radio className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span>Kabmeet</span>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            Built by students for the Kabale University AI Club and IndabaX community at{' '}
            <span className="font-medium text-foreground">ai.kab.ac.ug/indabax</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <Link
            href="/"
            className="whitespace-nowrap text-muted transition-colors duration-fast hover:text-foreground"
          >
            Discover
          </Link>
          <Link
            href="/communities"
            className="whitespace-nowrap text-muted transition-colors duration-fast hover:text-foreground"
          >
            Communities
          </Link>
          <Link
            href="/classes"
            className="whitespace-nowrap text-muted transition-colors duration-fast hover:text-foreground"
          >
            Virtual Classes
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 whitespace-nowrap text-muted transition-colors duration-fast hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            <span>My Dashboard</span>
          </Link>
          <a
            href="https://ai.kab.ac.ug"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-pill bg-kab-blue px-4 text-xs font-semibold text-white transition-opacity duration-fast hover:opacity-90"
          >
            <span>KAB AI Home</span>
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
