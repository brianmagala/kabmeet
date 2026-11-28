import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { enablePush, pushSupported } from '../lib/push';
import type { NotificationConfig } from '../shared/notifications';

const ASKED_KEY = 'kab_push_asked';

const wasAsked = (): boolean => {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
};
const markAsked = () => {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    /* private window: we may ask again next time, which is fine */
  }
};

/**
 * Shown once, right after a person follows a club for the first time. It is our own card first;
 * the browser's permission box only appears if they tap "Turn on". Never shown on first load.
 */
export function PushOptIn() {
  const { apiFetch, pushToast, user } = useKabmeet();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const onFollowed = async () => {
      if (wasAsked() || !pushSupported() || Notification.permission !== 'default') return;
      try {
        const cfg = await apiFetch<NotificationConfig>('/api/notifications/settings');
        if (!cfg.pushEnabled || !cfg.publicKey) return; // server has no push keys: nothing to offer
        setConfig(cfg);
        setVisible(true);
      } catch {
        /* the bell still works */
      }
    };
    window.addEventListener('kabmeet:followed', onFollowed);
    return () => window.removeEventListener('kabmeet:followed', onFollowed);
  }, [user, apiFetch]);

  if (!visible || !config?.publicKey) return null;

  const dismiss = () => {
    markAsked();
    setVisible(false);
  };

  const turnOn = async () => {
    setBusy(true);
    const result = await enablePush(config.publicKey!, (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) }));
    markAsked();
    setBusy(false);
    setVisible(false);
    if (result === 'on') pushToast('Done. We will nudge you when a club you follow goes live.', 'success');
    else if (result === 'denied') pushToast('No problem. The bell in the header will still show everything.', 'info');
    else pushToast('Could not turn on phone alerts here. The bell still works.', 'info');
  };

  return (
    <div role="dialog" aria-label="Get a nudge when clubs go live" className="fixed inset-x-3 bottom-20 z-50 rounded-2xl border border-amber-gold/50 bg-night-forest p-4 text-white shadow-xl md:inset-x-auto md:bottom-6 md:right-6 md:w-96">
      <button type="button" onClick={dismiss} aria-label="Not now" className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-sun-yellow" strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Want a nudge when this club goes live?</p>
          <p className="mt-1 text-xs leading-relaxed text-mist/80">We will send a short alert to this device. You choose what you get, and you can set quiet hours in your profile.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void turnOn()} disabled={busy} className="rounded-full bg-signal-green px-4 py-1.5 text-xs font-semibold text-night-forest disabled:opacity-60">
              {busy ? 'Turning on…' : 'Turn on'}
            </button>
            <button type="button" onClick={dismiss} className="rounded-full border border-white/25 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/10">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
