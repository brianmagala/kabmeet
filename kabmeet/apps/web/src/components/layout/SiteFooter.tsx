'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Code2,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Radio,
  ShieldCheck,
  X,
} from 'lucide-react';

export interface SiteFooterData {
  tagline: string;
  docsLabel: string;
  docsUrl: string;
  githubLabel: string;
  githubUrl: string;
  contactEmail: string;
  contactPhone: string;
  campusLocation: string;
}

const DEFAULT_FOOTER: SiteFooterData = {
  tagline:
    'Built by students for the Kabale University AI Club and IndabaX community at ai.kab.ac.ug/indabax.',
  docsLabel: 'KAB AI Docs',
  docsUrl: 'https://ai.kab.ac.ug/indabax',
  githubLabel: 'GitHub Repository',
  githubUrl: 'https://github.com/kabale-ai/kabmeet',
  contactEmail: 'indabax@kab.ac.ug',
  contactPhone: '+256 392 890 120',
  campusLocation: 'Kikungiri Hill, Kabale University, Uganda',
};

function safeHref(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  return '#';
}

export function SiteFooter({
  initialData = DEFAULT_FOOTER,
  isAdmin = false,
  onSave,
}: {
  initialData?: SiteFooterData;
  isAdmin?: boolean;
  onSave?: (next: SiteFooterData) => Promise<void> | void;
}) {
  const [footer, setFooter] = useState<SiteFooterData>(initialData);
  const [draft, setDraft] = useState<SiteFooterData>(initialData);
  const [editOpen, setEditOpen] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      await onSave(draft);
    }
    setFooter(draft);
    setEditOpen(false);
  };

  return (
    <footer className="border-t border-border bg-surface text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="space-y-3 md:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-[0.08em] text-indaba-deep-green dark:text-signal-green">
                <Radio className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span>Kabmeet</span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(footer);
                    setEditOpen(true);
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-border bg-background px-3 text-xs font-semibold text-foreground hover:border-amber-gold"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  <span>Edit footer</span>
                </button>
              )}
            </div>
            <p className="max-w-md text-xs leading-relaxed text-muted">{footer.tagline}</p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-medium">
              <Link href="/" className="whitespace-nowrap text-muted hover:text-foreground">
                Discover
              </Link>
              <Link
                href="/communities"
                className="whitespace-nowrap text-muted hover:text-foreground"
              >
                Communities
              </Link>
              <Link href="/classes" className="whitespace-nowrap text-muted hover:text-foreground">
                Virtual Classes
              </Link>
              <Link
                href="/profile"
                className="inline-flex items-center gap-1 whitespace-nowrap text-muted hover:text-foreground"
              >
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                <span>My Dashboard</span>
              </Link>
            </div>
          </div>

          <div className="space-y-3 md:col-span-3">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Resources
            </h2>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <a
                  href={safeHref(footer.docsUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-foreground hover:text-kab-blue dark:hover:text-signal-green"
                >
                  <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{footer.docsLabel}</span>
                  <ExternalLink className="h-3 w-3 opacity-70" strokeWidth={2} aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={safeHref(footer.githubUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-foreground hover:text-kab-blue dark:hover:text-signal-green"
                >
                  <Code2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{footer.githubLabel}</span>
                  <ExternalLink className="h-3 w-3 opacity-70" strokeWidth={2} aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3 md:col-span-4">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Contact
            </h2>
            <ul className="space-y-2.5 text-xs text-muted">
              <li>
                <a
                  href={`mailto:${footer.contactEmail}`}
                  className="inline-flex items-center gap-2 text-foreground hover:text-kab-blue dark:hover:text-signal-green"
                >
                  <Mail className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{footer.contactEmail}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${footer.contactPhone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 text-foreground hover:text-kab-blue dark:hover:text-signal-green"
                >
                  <Phone className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span className="tabular-nums">{footer.contactPhone}</span>
                </a>
              </li>
              <li className="inline-flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>{footer.campusLocation}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isAdmin && editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit site footer"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-lg rounded-card border border-border bg-surface-elevated p-6 text-foreground shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display text-xl font-bold uppercase">Edit site footer</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-pill text-muted hover:bg-background"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium">KAB AI documentation URL</label>
                <input
                  type="url"
                  required
                  value={draft.docsUrl}
                  onChange={(e) => setDraft((p) => ({ ...p, docsUrl: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium">GitHub repository URL</label>
                <input
                  type="url"
                  required
                  value={draft.githubUrl}
                  onChange={(e) => setDraft((p) => ({ ...p, githubUrl: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-medium">Contact email</label>
                  <input
                    type="email"
                    required
                    value={draft.contactEmail}
                    onChange={(e) => setDraft((p) => ({ ...p, contactEmail: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3"
                  />
                </div>
                <div>
                  <label className="block font-medium">Contact phone</label>
                  <input
                    type="text"
                    required
                    value={draft.contactPhone}
                    onChange={(e) => setDraft((p) => ({ ...p, contactPhone: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="h-9 rounded-pill border border-border px-4 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-pill bg-signal-green px-5 font-semibold text-night-forest"
                >
                  Save footer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </footer>
  );
}
