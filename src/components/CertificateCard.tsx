import { useCallback, useEffect, useState } from 'react';
import { Award, Download } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import type { CertificateKind, EventView } from '../shared/events';

interface Status {
  available: boolean;
  kind?: CertificateKind;
  reason?: 'NOT_ENDED' | 'NOT_ELIGIBLE';
  message: string;
  code: string | null;
}

const KIND_LABEL: Record<CertificateKind, string> = {
  ATTENDANCE: 'Certificate of attendance',
  WINNER: 'Certificate of achievement: winner',
  RUNNER_UP: 'Certificate of achievement: runner-up',
};

export function CertificateCard({ event }: { event: EventView }) {
  const { apiFetch, accessToken, user, navigate, pushToast } = useKabmeet();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const ended = new Date(event.endsAt).getTime() <= Date.now();

  useEffect(() => {
    if (!user || !ended) return;
    let cancelled = false;
    apiFetch<Status>(`/api/events/${event.id}/certificate/status`)
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus(null));
    return () => {
      cancelled = true;
    };
  }, [apiFetch, event.id, user, ended]);

  const download = useCallback(async () => {
    setBusy(true);
    try {
      // The PDF is binary, so it is fetched directly with the same bearer token apiFetch uses.
      const res = await fetch(`/api/events/${event.id}/certificate`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) {
        let message = 'Could not make the certificate. Please try again.';
        try {
          message = ((await res.json()) as { message?: string }).message ?? message;
        } catch {
          // keep fallback
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${event.slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      const s = await apiFetch<Status>(`/api/events/${event.id}/certificate/status`);
      setStatus(s);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not download the certificate.', 'error');
    } finally {
      setBusy(false);
    }
  }, [accessToken, apiFetch, event.id, event.slug, pushToast]);

  if (event.status !== 'PUBLISHED') return null;

  return (
    <section aria-labelledby="cert-heading" className="mt-10 rounded-2xl border border-line bg-surface p-5">
      <h2 id="cert-heading" className="flex items-center gap-2 text-lg font-bold">
        <Award className="h-5 w-5 text-indaba-green dark:text-signal-green" aria-hidden="true" />
        Certificate
      </h2>
      {!ended && <p className="mt-2 text-sm text-muted">Certificates open when the event ends.</p>}
      {ended && !user && (
        <p className="mt-2 text-sm text-muted">
          <button type="button" onClick={() => navigate('auth')} className="font-semibold text-kab-blue underline dark:text-signal-green">
            Sign in
          </button>{' '}
          to see whether you have a certificate for this event.
        </p>
      )}
      {ended && user && !status && <p className="mt-2 text-sm text-muted">Checking your certificate.</p>}
      {ended && user && status && (
        <div className="mt-2">
          <p className="text-sm text-muted">{status.message}</p>
          {status.available && status.kind && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={download}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-indaba-green px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {busy ? 'Making your PDF' : `Download ${KIND_LABEL[status.kind].toLowerCase()}`}
              </button>
              {status.code && (
                <span className="text-sm">
                  Code <span className="font-mono font-bold">{status.code}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
