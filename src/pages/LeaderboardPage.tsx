import { useCallback, useEffect, useState } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { useLoadingStage } from '../hooks/useLoadingStage';
import { SlowStageNotice } from '../components/KabmeetMoments';
import type { EngagementSummary, LeaderboardEntry, LeaderboardResponse } from '../shared/engagement';

type Period = 'week' | 'all';
const MEDALS = ['🥇', '🥈', '🥉'];

function Row({ entry }: { entry: LeaderboardEntry }) {
  const medal = entry.rank <= 3 ? MEDALS[entry.rank - 1] : null;
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
        entry.isYou ? 'border-signal-green bg-signal-green/10' : 'border-border bg-surface hover:border-signal-green/50'
      }`}
    >
      <span className="w-9 shrink-0 text-center font-mono text-sm font-bold tabular-nums">
        {medal ? (
          <>
            <span aria-hidden="true" className="text-xl">
              {medal}
            </span>
            <span className="sr-only">Rank {entry.rank}</span>
          </>
        ) : (
          entry.rank
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {entry.name}
          {entry.isYou && (
            <span className="ml-2 rounded-full bg-signal-green px-2 py-0.5 text-[10px] font-bold uppercase text-night-forest">
              You
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3" strokeWidth={2} />
            {entry.streak}w streak
          </span>
          <span>{entry.badgeCount} {entry.badgeCount === 1 ? 'badge' : 'badges'}</span>
        </span>
      </span>
      <span className="text-right">
        <span className="block font-mono text-lg font-bold tabular-nums">{entry.points}</span>
        <span className="block text-[10px] uppercase tracking-wider text-muted">points</span>
      </span>
    </li>
  );
}

export function LeaderboardPage() {
  const { apiFetch, pushToast, navigate, role } = useKabmeet();
  const [period, setPeriod] = useState<Period>('week');
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const stage = useLoadingStage(loading);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, me] = await Promise.all([
        apiFetch<LeaderboardResponse>(`/api/leaderboard?period=${period}`),
        apiFetch<{ engagement: EngagementSummary }>('/api/engagement/me'),
      ]);
      setBoard(b);
      setOptedIn(me.engagement.leaderboardOptIn);
    } catch {
      pushToast('Could not load the leaderboard.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, period, pushToast]);

  useEffect(() => {
    if (role !== 'VISITOR') void load();
    else setLoading(false);
  }, [load, role]);

  const join = async () => {
    setJoining(true);
    try {
      await apiFetch('/api/engagement/me', { method: 'PATCH', body: JSON.stringify({ leaderboardOptIn: true }) });
      pushToast('You are on the club leaderboard.', 'success');
      await load();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not join the leaderboard.', 'error');
    } finally {
      setJoining(false);
    }
  };

  if (role === 'VISITOR') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-border bg-surface p-8">
          <span aria-hidden="true" className="text-4xl">
            🏆
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold uppercase">Sign in to see the board</h1>
          <p className="mt-2 text-sm text-muted">Streaks, badges and the club leaderboard are for signed-in members.</p>
          <button
            type="button"
            onClick={() => navigate('auth')}
            className="mt-5 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const empty = !loading && board && board.entries.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="border-b border-border pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">
          Kabale AI Club
        </p>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-bold uppercase tracking-wide">
          <Trophy className="h-7 w-7 text-amber-gold" strokeWidth={2} />
          <span>Club Leaderboard</span>
        </h1>
        <p className="mt-2 text-xs text-muted">
          Points come from showing up: joining sessions, asking questions, voting in polls and chatting. Private classes never count.
          The weekly board starts fresh every Monday.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Leaderboard period" className="inline-flex rounded-full border border-border bg-surface p-1">
          {(['week', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`h-9 rounded-full px-4 text-xs font-semibold transition-colors ${
                period === p ? 'bg-signal-green text-night-forest' : 'text-muted hover:text-foreground'
              }`}
            >
              {p === 'week' ? 'This week' : 'All time'}
            </button>
          ))}
        </div>
        {board && (
          <p className="text-[11px] text-muted">
            {board.totalOptedIn} {board.totalOptedIn === 1 ? 'member has' : 'members have'} joined the board
          </p>
        )}
      </div>

      {optedIn === false && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sun-yellow/60 bg-sun-yellow/15 p-4">
          <p className="max-w-md text-xs text-foreground">
            You are not on the board. Join to be listed with your display name, points, streak and badge count.
          </p>
          <button
            type="button"
            onClick={join}
            disabled={joining}
            className="h-9 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest disabled:opacity-60"
          >
            {joining ? 'Joining...' : 'Join the leaderboard'}
          </button>
        </div>
      )}

      <div className="mt-5">
        {loading ? (
          <div role="status" aria-label="Loading leaderboard" className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="kab-shimmer h-16 rounded-xl" />
            ))}
            <SlowStageNotice stage={stage} onRetry={load} />
          </div>
        ) : empty ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center">
            <span aria-hidden="true" className="text-4xl">
              🏆
            </span>
            <p className="mt-3 font-display text-lg font-semibold uppercase">
              {period === 'week' ? 'Nobody has points this week yet' : 'The board is empty'}
            </p>
            <p className="mt-1 text-xs text-muted">Join a live session and stay a minute to get on the board.</p>
            <button
              type="button"
              onClick={() => navigate('discover')}
              className="mt-4 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest"
            >
              Find a live session
            </button>
          </div>
        ) : (
          board && (
            <>
              <ol className="space-y-2.5" aria-label={period === 'week' ? 'This week' : 'All time'}>
                {board.entries.map((e) => (
                  <Row key={`${e.rank}-${e.name}`} entry={e} />
                ))}
              </ol>
              {board.you && (
                <div className="mt-3">
                  <p className="mb-2 text-center text-xs text-muted" aria-hidden="true">
                    ...
                  </p>
                  <ol>
                    <Row entry={board.you} />
                  </ol>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
