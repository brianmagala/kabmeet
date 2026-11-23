import React, { useEffect, useState } from 'react';
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
import { useKabmeet } from '../context/KabmeetContext';
import type { SiteFooterConfig } from '../types/kabmeet';

function safeHref(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  return '#';
}

interface SiteFooterEditorFormProps {
  initialValue: SiteFooterConfig;
  onSave: (next: Omit<SiteFooterConfig, 'updatedAt'>) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function SiteFooterEditorForm({
  initialValue,
  onSave,
  onCancel,
  submitLabel = 'Save footer changes',
}: SiteFooterEditorFormProps) {
  const [form, setForm] = useState<Omit<SiteFooterConfig, 'updatedAt'>>({
    tagline: initialValue.tagline,
    docsLabel: initialValue.docsLabel,
    docsUrl: initialValue.docsUrl,
    githubLabel: initialValue.githubLabel,
    githubUrl: initialValue.githubUrl,
    contactEmail: initialValue.contactEmail,
    contactPhone: initialValue.contactPhone,
    campusLocation: initialValue.campusLocation,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      tagline: initialValue.tagline,
      docsLabel: initialValue.docsLabel,
      docsUrl: initialValue.docsUrl,
      githubLabel: initialValue.githubLabel,
      githubUrl: initialValue.githubUrl,
      contactEmail: initialValue.contactEmail,
      contactPhone: initialValue.contactPhone,
      campusLocation: initialValue.campusLocation,
    });
  }, [initialValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update footer settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sf-tagline" className="block text-xs font-medium text-foreground">
          Footer tagline
        </label>
        <textarea
          id="sf-tagline"
          required
          rows={2}
          maxLength={220}
          value={form.tagline}
          onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sf-docs-label" className="block text-xs font-medium text-foreground">
            Documentation link label
          </label>
          <input
            id="sf-docs-label"
            type="text"
            required
            maxLength={60}
            value={form.docsLabel}
            onChange={(e) => setForm((p) => ({ ...p, docsLabel: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
        </div>

        <div>
          <label htmlFor="sf-docs-url" className="block text-xs font-medium text-foreground">
            KAB AI documentation URL
          </label>
          <input
            id="sf-docs-url"
            type="url"
            required
            maxLength={300}
            value={form.docsUrl}
            onChange={(e) => setForm((p) => ({ ...p, docsUrl: e.target.value }))}
            placeholder="https://ai.kab.ac.ug/indabax"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sf-gh-label" className="block text-xs font-medium text-foreground">
            GitHub link label
          </label>
          <input
            id="sf-gh-label"
            type="text"
            required
            maxLength={60}
            value={form.githubLabel}
            onChange={(e) => setForm((p) => ({ ...p, githubLabel: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
        </div>

        <div>
          <label htmlFor="sf-gh-url" className="block text-xs font-medium text-foreground">
            GitHub repository URL
          </label>
          <input
            id="sf-gh-url"
            type="url"
            required
            maxLength={300}
            value={form.githubUrl}
            onChange={(e) => setForm((p) => ({ ...p, githubUrl: e.target.value }))}
            placeholder="https://github.com/kabale-ai/kabmeet"
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sf-email" className="block text-xs font-medium text-foreground">
            Contact email
          </label>
          <input
            id="sf-email"
            type="email"
            required
            maxLength={120}
            value={form.contactEmail}
            onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
        </div>

        <div>
          <label htmlFor="sf-phone" className="block text-xs font-medium text-foreground">
            Contact phone
          </label>
          <input
            id="sf-phone"
            type="text"
            required
            maxLength={40}
            value={form.contactPhone}
            onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
        </div>
      </div>

      <div>
        <label htmlFor="sf-location" className="block text-xs font-medium text-foreground">
          Campus address / office
        </label>
        <input
          id="sf-location"
          type="text"
          required
          maxLength={120}
          value={form.campusLocation}
          onChange={(e) => setForm((p) => ({ ...p, campusLocation: e.target.value }))}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-live-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-full border border-border px-5 text-xs font-semibold text-foreground hover:border-amber-gold"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-full bg-signal-green px-6 text-xs font-semibold uppercase tracking-wider text-night-forest transition-transform hover:brightness-95 disabled:opacity-70"
        >
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function SiteFooter() {
  const { navigate, role, siteFooter, updateSiteFooter, pushToast } = useKabmeet();
  const [editOpen, setEditOpen] = useState(false);

  const isAdmin = role === 'ADMIN';

  return (
    <footer className="border-t border-border bg-surface text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-12">
          {/* Brand & Campus Overview */}
          <div className="space-y-3 md:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-[0.08em] text-indaba-deep-green dark:text-signal-green">
                <Radio className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span>Kabmeet</span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-amber-gold"
                >
                  <Pencil className="h-3.5 w-3.5 text-kab-blue dark:text-signal-green" strokeWidth={2} />
                  <span>Edit footer</span>
                </button>
              )}
            </div>

            <p className="max-w-md text-xs leading-relaxed text-muted">
              {siteFooter.tagline}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => navigate('discover')}
                className="whitespace-nowrap text-muted transition-colors hover:text-foreground"
              >
                Discover
              </button>
              <button
                type="button"
                onClick={() => navigate('communities')}
                className="whitespace-nowrap text-muted transition-colors hover:text-foreground"
              >
                Communities
              </button>
              {role !== 'VISITOR' && (
                <button
                  type="button"
                  onClick={() => navigate('profile')}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-muted transition-colors hover:text-foreground"
                >
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  <span>My Dashboard</span>
                </button>
              )}
            </div>
          </div>

          {/* KAB AI Docs & GitHub Repository Links */}
          <div className="space-y-3 md:col-span-3">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Resources
            </h2>
            <ul className="space-y-2.5 text-xs font-medium">
              <li>
                <a
                  href={safeHref(siteFooter.docsUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-foreground transition-colors hover:text-kab-blue dark:hover:text-signal-green"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-indaba-deep-green dark:text-signal-green" strokeWidth={2} aria-hidden="true" />
                  <span>{siteFooter.docsLabel}</span>
                  <ExternalLink className="h-3 w-3 opacity-70" strokeWidth={2} aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={safeHref(siteFooter.githubUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-foreground transition-colors hover:text-kab-blue dark:hover:text-signal-green"
                >
                  <Code2 className="h-4 w-4 shrink-0 text-kab-blue dark:text-sun-yellow" strokeWidth={2} aria-hidden="true" />
                  <span>{siteFooter.githubLabel}</span>
                  <ExternalLink className="h-3 w-3 opacity-70" strokeWidth={2} aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="space-y-3 md:col-span-4">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Contact
            </h2>
            <ul className="space-y-2.5 text-xs text-muted">
              <li>
                <a
                  href={`mailto:${siteFooter.contactEmail}`}
                  className="inline-flex items-center gap-2 text-foreground transition-colors hover:text-kab-blue dark:hover:text-signal-green"
                >
                  <Mail className="h-4 w-4 shrink-0 text-kab-blue dark:text-signal-green" strokeWidth={2} aria-hidden="true" />
                  <span>{siteFooter.contactEmail}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${siteFooter.contactPhone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 text-foreground transition-colors hover:text-kab-blue dark:hover:text-signal-green"
                >
                  <Phone className="h-4 w-4 shrink-0 text-indaba-deep-green dark:text-signal-green" strokeWidth={2} aria-hidden="true" />
                  <span className="tabular-nums">{siteFooter.contactPhone}</span>
                </a>
              </li>
              <li className="inline-flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
                <span>{siteFooter.campusLocation}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-[11px] text-muted">
          <span>
            Kabale University · IndabaX &amp; KAB AI Live Platform
          </span>
          <a
            href={safeHref(siteFooter.docsUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-kab-blue px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <span>KAB AI Home</span>
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Inline Admin Footer Editor Modal */}
      {isAdmin && editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit site footer"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 text-foreground shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                  Edit site footer
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Updates documentation, GitHub, and contact details across Kabmeet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close footer editor"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-background"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <SiteFooterEditorForm
              initialValue={siteFooter}
              onCancel={() => setEditOpen(false)}
              onSave={async (next) => {
                await updateSiteFooter(next);
                setEditOpen(false);
                pushToast('Site footer saved.', 'success');
              }}
            />
          </div>
        </div>
      )}
    </footer>
  );
}
