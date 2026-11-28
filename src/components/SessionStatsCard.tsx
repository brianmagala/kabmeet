import { useCallback, useEffect, useState } from 'react';
import { useKabmeet } from '../context/KabmeetContext';
import type { SessionStats } from '../shared/engagement';

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Viewers over time as a step line. Plain SVG, no chart library. */
function ViewersLine({ points }: { points: SessionStats['timeline'] }) {
  if (points.length < 2) {
    return <p className="text-xs text-muted">No viewer history yet. The line fills in as people join and leave.</p>;
  }
  const W = 320;
  const H = 72;
  const t0 = points[0].t;
  const span = Math.max(1, points[points.length - 1].t - t0);
  const max = Math.max(1, ...points.map((p) => p.viewers));
  const x = (t: number) => ((t - t0) / span) * W;
  const y = (v: number) => H - 4 - (v / max) * (H - 12);
  let d = `M ${x(points[0].t).toFixed(1)} ${y(points[0].viewers).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H ${x(points[i].t).toFixed(1)} V ${y(points[i].viewers).toFixed(1)}`;
  }
  const area = `${d} V ${H} H ${x(points[0].t).toFixed(1)} Z`;
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Viewers over time, from ${clock(t0)} to ${clock(points[points.length - 1].t)}, highest ${max}`}
      >
        <path d={area} fill="var(--signal-green)" opacity="0.18" />
        <path d={d} fill="none" stroke="var(--signal-green)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-muted">
        <span>{clock(t0)}</span>
        <span>highest {max}</span>
        <span>{clock(points[points.length - 1].t)}</span>
      </figcaption>
    </figure>
  );
}

/** Peak viewers, watch time and activity for one session. Hosts, lecturers and admins only. */
export function SessionStatsCard({ sessionId, live }: { sessionId: string; live: boolean }) {
  const { apiFetch } = useKabmeet();
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ stats: SessionStats }>(`/api/sessions/${sessionId}/stats`);
      setStats(res.stats);
      setDenied(false);
    } catch (err) {
      // 403 for moderators: they run the room but the numbers are for the host.
      if (err instanceof Error && /host|lecturer|admin/i.test(err.message)) setDenied(true);
    }
  }, [apiFetch, sessionId]);

  useEffect(() => {
    setStats(null);
    setDenied(false);
    void load();
    if (!live) return;
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [load, live]);

  if (denied) {
    return (
      <section className="mt-4 rounded-xl border border-border bg-surface p-5 text-xs text-muted">
        Session numbers are shown to the session host, lecturers and admins.
      </section>
    );
  }
  if (!stats) return null;

  const tiles: Array<[string, string]> = [
    ['Peak viewers', String(stats.peakViewers)],
    ['Watching now', String(stats.currentViewers)],
    ['Signed-in joined', String(stats.uniqueSignedIn)],
    ['Average watch time', formatDuration(stats.avgWatchSeconds)],
    ['Total watch time', formatDuration(stats.totalWatchSeconds)],
    ['Chat messages', String(stats.chatMessages)],
    ['Questions', `${stats.questionsAnswered}/${stats.questionsAsked} answered`],
    ['Poll votes', String(stats.pollVotes)],
    ['Reactions', String(stats.reactions)],
  ];

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-5" aria-labelledby="session-stats-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="session-stats-heading" className="font-display text-lg font-bold uppercase">
          Session numbers
        </h2>
        {live && <span className="text-[11px] text-muted">Updates every 15 seconds</span>}
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <dl className="grid grid-cols-3 gap-2 lg:col-span-2">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-background p-3">
              <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
              <dd className="mt-0.5 font-mono text-base font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">Viewers over time</p>
          <ViewersLine points={stats.timeline} />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Watch time counts signed-in people once, even with two tabs open. Visitors who are not signed in count toward peak viewers only.
      </p>
    </section>
  );
}
