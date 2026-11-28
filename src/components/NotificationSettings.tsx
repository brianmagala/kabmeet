import { useCallback, useEffect, useState } from 'react';
import { useKabmeet } from '../context/KabmeetContext';
import { useLoadingStage } from '../hooks/useLoadingStage';
import { disablePush, enablePush, pushSupported } from '../lib/push';
import { SlowStageNotice } from './KabmeetMoments';
import type { NotificationConfig, NotificationKindDef, NotificationPrefs } from '../shared/notifications';

type Settings = NotificationConfig & { kinds: NotificationKindDef[] };

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:opacity-50 ${on ? 'border-signal-green bg-signal-green' : 'border-border bg-muted/20'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/** What to be told about, quiet hours, and phone alerts. Lives on the Profile page. */
export function NotificationSettings() {
  const { apiFetch, pushToast } = useKabmeet();
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceOn, setDeviceOn] = useState(false);
  const stage = useLoadingStage(loading);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await apiFetch<Settings>('/api/notifications/settings');
      setData(cfg);
      if (pushSupported()) {
        const reg = await navigator.serviceWorker.ready;
        setDeviceOn(Boolean(await reg.pushManager.getSubscription()) && Notification.permission === 'granted');
      }
    } catch {
      pushToast('Could not load notification settings.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<{ kinds: Partial<NotificationPrefs['kinds']>; quiet: Partial<NotificationPrefs['quiet']> }>) => {
    try {
      setData(await apiFetch<Settings>('/api/notifications/settings', { method: 'PATCH', body: JSON.stringify(patch) }));
    } catch {
      pushToast('Could not save. Check your connection and try again.', 'error');
    }
  };

  const send = (url: string, body: unknown) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) });

  const toggleDevice = async (on: boolean) => {
    if (!data) return;
    if (!on) {
      await disablePush(send);
      setDeviceOn(false);
      return;
    }
    if (!data.publicKey) return;
    const result = await enablePush(data.publicKey, send);
    if (result === 'on') setDeviceOn(true);
    else if (result === 'denied') pushToast('Alerts are blocked for this site in your browser settings. The bell still works.', 'info');
    else pushToast('Could not turn on alerts on this device.', 'error');
  };

  if (loading && !data) {
    return (
      <section aria-busy="true" className="rounded-2xl border border-border bg-surface-elevated p-5">
        <div className="kab-shimmer h-5 w-40 rounded" />
        <div className="mt-4 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="kab-shimmer h-10 rounded-lg" />)}</div>
        <SlowStageNotice stage={stage} onRetry={() => void load()} />
      </section>
    );
  }
  if (!data) return null;

  return (
    <section aria-labelledby="ntf-heading" className="rounded-2xl border border-border bg-surface-elevated p-5">
      <h2 id="ntf-heading" className="font-display text-lg font-semibold">Notifications</h2>
      <p className="mt-1 text-xs text-muted">The bell in the header always shows these. Phone alerts are an extra copy.</p>

      <ul className="mt-4 divide-y divide-border">
        {data.kinds.map((k) => (
          <li key={k.kind} className="flex items-center justify-between gap-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium">{k.label}</span>
              <span className="block text-xs text-muted">{k.hint}</span>
            </span>
            <Switch on={data.prefs.kinds[k.kind]} label={k.label} onChange={(v) => void save({ kinds: { [k.kind]: v } })} />
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Quiet hours</span>
            <span className="block text-xs text-muted">No phone alerts in this window (Kabale time). The bell still fills up.</span>
          </span>
          <Switch on={data.prefs.quiet.enabled} label="Quiet hours" onChange={(v) => void save({ quiet: { enabled: v } })} />
        </div>
        {data.prefs.quiet.enabled && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2">From
              <input type="time" value={data.prefs.quiet.start} onChange={(e) => e.target.value && void save({ quiet: { start: e.target.value } })} className="rounded-lg border border-border bg-background px-2 py-1 font-mono tabular-nums" />
            </label>
            <label className="flex items-center gap-2">to
              <input type="time" value={data.prefs.quiet.end} onChange={(e) => e.target.value && void save({ quiet: { end: e.target.value } })} className="rounded-lg border border-border bg-background px-2 py-1 font-mono tabular-nums" />
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border p-4">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Alerts on this device</span>
          <span className="block text-xs text-muted">
            {!data.pushEnabled
              ? 'Not set up on this server yet. The bell works without it.'
              : !pushSupported()
                ? 'This browser does not support phone alerts.'
                : deviceOn
                  ? 'On for this browser.'
                  : 'Off. Turn on to get an alert even when Kabmeet is closed.'}
          </span>
        </span>
        <Switch on={deviceOn} label="Alerts on this device" disabled={!data.pushEnabled || !pushSupported()} onChange={(v) => void toggleDevice(v)} />
      </div>
    </section>
  );
}
