import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Bell, CheckCheck, Hand, Radio, Timer, type LucideIcon } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { parsePath } from '../lib/routes';
import type { AppNotification, NotificationKind, NotificationsResponse } from '../shared/notifications';

const ICONS: Record<NotificationKind, LucideIcon> = {
  badge: Award,
  'session-live': Radio,
  'class-soon': Timer,
  'hand-approved': Hand,
};

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const POLL_MS = 30_000;

/** The bell in the header. Always works, with or without push. */
export function NotificationBell({ buttonClass }: { buttonClass: string }) {
  const { user, apiFetch, navigate } = useKabmeet();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const signedIn = Boolean(user);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      setData(await apiFetch<NotificationsResponse>('/api/notifications'));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [apiFetch, signedIn]);

  // Poll while the tab is visible, refresh on return, and refresh at once when a live connection says so.
  useEffect(() => {
    if (!signedIn) {
      setData(null);
      return;
    }
    void load();
    const tick = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('kabmeet:notification', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('kabmeet:notification', tick);
    };
  }, [signedIn, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markRead = async (id: string | 'all') => {
    setData((d) =>
      d ? { items: d.items.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n)), unread: id === 'all' ? 0 : Math.max(0, d.unread - 1) } : d,
    );
    try {
      await apiFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({ id }) });
    } catch {
      void load();
    }
  };

  const openItem = (n: AppNotification) => {
    if (!n.read) void markRead(n.id);
    setOpen(false);
    const target = n.href ? parsePath(n.href.split(/[?#]/)[0]) : null;
    if (target) navigate(target.route, { sessionId: target.sessionId, communitySlug: target.communitySlug ?? null, eventSlug: target.eventSlug ?? null });
  };

  const unread = data?.unread ?? 0;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className={`relative ${buttonClass}`}
      >
        <Bell className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-live-red px-1 font-mono text-[10px] font-semibold leading-none text-white tabular-nums"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-[4.25rem] z-50 rounded-xl border border-border bg-surface-elevated p-3 text-foreground shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-display text-sm font-semibold uppercase tracking-wider">Notifications</span>
            {signedIn && unread > 0 && (
              <button type="button" onClick={() => void markRead('all')} className="inline-flex items-center gap-1 text-xs font-medium text-kab-blue hover:underline dark:text-signal-green">
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>

          {!signedIn ? (
            <div className="py-3">
              <p className="text-xs leading-relaxed text-muted">Sign in to get a note here when a club goes live, a class is about to start, or you earn a badge.</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('auth');
                }}
                className="mt-3 rounded-full bg-signal-green px-4 py-1.5 text-xs font-semibold text-night-forest"
              >
                Sign in
              </button>
            </div>
          ) : !data ? (
            <div className="space-y-2 py-3" aria-busy="true" aria-label={failed ? 'Could not load' : 'Loading notifications'}>
              {failed ? (
                <p className="text-xs text-muted">Could not load notifications. <button type="button" className="font-medium underline" onClick={() => void load()}>Try again</button></p>
              ) : (
                [0, 1, 2].map((i) => <div key={i} className="kab-shimmer h-10 rounded-lg" />)
              )}
            </div>
          ) : data.items.length === 0 ? (
            <p className="py-4 text-xs leading-relaxed text-muted">Nothing yet. Follow a club and you will hear here when it goes live.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {data.items.map((n) => {
                const Icon = ICONS[n.kind];
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => openItem(n)} className="flex w-full items-start gap-2.5 py-2.5 text-left hover:bg-muted/10">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.read ? 'text-muted' : 'text-kab-blue dark:text-signal-green'}`} strokeWidth={2} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-xs ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</span>
                        <span className="line-clamp-2 text-[11px] leading-snug text-muted">{n.body}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-[10px] tabular-nums text-muted">{ago(n.createdAt)}</span>
                        {!n.read && <span aria-label="Unread" className="h-2 w-2 rounded-full bg-live-red" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {signedIn && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('profile');
              }}
              className="mt-1 w-full border-t border-border pt-2 text-left text-xs font-medium text-kab-blue hover:underline dark:text-signal-green"
            >
              Notification settings
            </button>
          )}
        </div>
      )}
    </div>
  );
}
