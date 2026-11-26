import { useEffect, useState } from 'react';
import { BadgeCheck, ShieldX } from 'lucide-react';
import { formatDayShort } from '../lib/eventFormat';
import type { CertificateKind, VerifyResult } from '../shared/events';

const KIND_TEXT: Record<CertificateKind, string> = {
  ATTENDANCE: 'Certificate of attendance',
  WINNER: 'Certificate of achievement: winner',
  RUNNER_UP: 'Certificate of achievement: runner-up',
};

/** Public page. It needs no account and shows only name, event, date and kind. */
export function VerifyPage({ code }: { code: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'invalid' | 'error'>('loading');
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/verify/${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setResult((await res.json()) as VerifyResult);
          setState('ok');
        } else if (res.status === 404) setState('invalid');
        else setState('error');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-extrabold">Verify a certificate</h1>
      <p className="mt-1 text-sm text-muted">
        Code <span className="font-mono font-bold">{code}</span>
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5" role="status">
        {state === 'loading' && <p className="text-sm text-muted">Checking.</p>}
        {state === 'error' && <p className="text-sm">We could not check this code right now. Please try again in a minute.</p>}
        {state === 'invalid' && (
          <p className="flex items-start gap-2 text-sm font-semibold">
            <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-live-red" aria-hidden="true" />
            This code does not match any certificate we issued. Check it for typing mistakes.
          </p>
        )}
        {state === 'ok' && result && (
          <div>
            <p className="flex items-center gap-2 font-bold text-indaba-green dark:text-signal-green">
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              Valid certificate
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-muted">Awarded to</dt><dd className="font-bold">{result.name}</dd></div>
              <div><dt className="text-muted">Type</dt><dd>{KIND_TEXT[result.kind]}</dd></div>
              <div><dt className="text-muted">Event</dt><dd>{result.eventTitle}</dd></div>
              <div><dt className="text-muted">Date</dt><dd>{formatDayShort(result.eventDate)}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
