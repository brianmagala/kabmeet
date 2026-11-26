import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Trophy } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { useLoadingStage } from '../hooks/useLoadingStage';
import { SlowStageNotice } from './KabmeetMoments';
import type { EngagementSummary } from '../shared/engagement';

function formatEarned(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Streak, badges and the leaderboard switch. Lives on the Profile page. */
export function EngagementPanel() {
  const { apiFetch, pushToast, navigate } = useKabmeet();
  const [data, setData] = useState<EngagementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const stage = useLoadingStage(loading);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ engagement: EngagementSummary }>('/api/engagement/me');
      setData(res.engagement);
    } catch {
      pushToast('Could not load your streak and badges.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleOptIn = async () => {
    if (!data || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ engagement: EngagementSummary }>('/api/engagement/me', {
        method: 'PATCH',
        body: JSON.stringify({ leaderboardOptIn: !data.leaderboardOptIn }),
      });
      setData(res.engagement);
      pushToast(
        res.engagement.leaderboardOptIn ? 'You are on the club leaderboard.' : 'You are hidden from the leaderboard.',
        'success',
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not save that choice.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <section className="mt-8" aria-label="Streak and badges">
        <div role="status" aria-label="Loading streak and badges" className="grid gap-4 lg:grid-cols-3">
          <div className="kab-shimmer h-48 rounded-xl" />
          <div className="kab-shimmer h-48 rounded-xl lg:col-span-2" />
        </div>
        <SlowStageNotice stage={stage} onRetry={load} />
      </section>
    );
  }
  if (!data) return null;

  const earnedCount = data.badges.filter((b) => b.earned).length;
  const streak = data.streak;

  return (
    <section className="mt-8" aria-labelledby="engagement-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="engagement-heading" className="flex items-center gap-2 font-display text-xl font-bold uppercase">
          <span aria-hidden="true">🔥</span>
          <span>Streak &amp; Badges</span>
        </h2>
        <button
          type="button"
          onClick={() => navigate('leaderboard')}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-4 text-xs font-semibold text-foreground transition-colors hover:border-signal-green"
        >
          <Trophy className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Club leaderboard</span>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Streak */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Weekly streak</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-5xl font-bold tabular-nums">{streak.current}</span>
            <span className="text-sm text-muted">{streak.current === 1 ? 'week' : 'weeks'} in a row</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {streak.thisWeekDone
              ? 'You have attended this week. Nice.'
              : streak.current > 0
                ? 'Join any live session this week to keep your streak.'
                : 'Stay 1 minute in any live session to start a streak.'}
          </p>

          <ol className="mt-4 flex items-end justify-between gap-1.5" aria-label="Last 8 weeks">
            {data.recentWeeks.map((w, i) => {
              const isNow = i === data.recentWeeks.length - 1;
              return (
                <li key={w.key} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      w.attended
                        ? 'border-signal-green bg-signal-green text-night-forest'
                        : 'border-border text-transparent'
                    } ${isNow && !w.attended ? 'border-dashed' : ''}`}
                  >
                    {w.attended && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    <span className="sr-only">{w.attended ? 'Attended' : 'Missed'}</span>
                  </span>
                  <span className="text-[9px] uppercase tracking-wide text-muted">{isNow ? 'Now' : `-${7 - i}w`}</span>
                </li>
              );
            })}
          </ol>

          <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">Points</dt>
              <dd className="font-mono text-lg font-bold tabular-nums">{data.points}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">This week</dt>
              <dd className="font-mono text-lg font-bold tabular-nums">{data.weekPoints}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">Best</dt>
              <dd className="font-mono text-lg font-bold tabular-nums">{streak.best}w</dd>
            </div>
          </dl>
        </div>

        {/* Badges */}
        <div className="rounded-xl border border-border bg-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Badges</p>
            <p className="font-mono text-xs tabular-nums text-muted">
              {earnedCount} / {data.badges.length}
            </p>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.badges.map((b) => (
              <li
                key={b.id}
                title={b.description}
                className={`group rounded-lg border p-3 text-center transition-transform duration-200 hover:-translate-y-0.5 ${
                  b.earned ? 'border-signal-green/60 bg-signal-green/10' : 'border-border bg-background'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`block text-3xl leading-none transition-transform duration-200 group-hover:scale-110 ${
                    b.earned ? '' : 'opacity-40 grayscale'
                  }`}
                >
                  {b.emoji}
                </span>
                <p className="mt-2 text-xs font-semibold leading-tight">{b.name}</p>
                {b.earned ? (
                  <p className="mt-1 text-[10px] text-muted">
                    <span className="sr-only">Earned </span>
                    {b.earnedAt ? formatEarned(b.earnedAt) : 'Earned'}
                  </p>
                ) : (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-kab-blue dark:bg-signal-green"
                        style={{ width: `${Math.round((b.progress / b.target) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[10px] tabular-nums text-muted">
                      <span className="sr-only">Locked, progress </span>
                      {b.progress}/{b.target}
                    </p>
                  </>
                )}
                <p className="sr-only">{b.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Leaderboard switch */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="min-w-0 max-w-xl">
          <p id="lb-optin-label" className="text-sm font-semibold">
            Show me on the club leaderboard
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Off by default. If you turn it on, other members see your display name, points, streak and badge count.
            Never your email, your classes or what you said in a session.
            {data.leaderboardOptIn && data.rank ? ` You are number ${data.rank} all time.` : ''}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={data.leaderboardOptIn}
          aria-labelledby="lb-optin-label"
          onClick={toggleOptIn}
          disabled={saving}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${
            data.leaderboardOptIn ? 'border-signal-green bg-signal-green' : 'border-border bg-background'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
              data.leaderboardOptIn ? 'translate-x-6 bg-night-forest' : 'translate-x-0.5 bg-muted'
            }`}
          />
          <span className="sr-only">{data.leaderboardOptIn ? 'On' : 'Off'}</span>
        </button>
      </div>
    </section>
  );
}
