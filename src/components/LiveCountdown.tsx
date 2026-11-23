import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CalendarDays, Clock, Play, Video } from 'lucide-react';
import type { KabSession } from '../types/kabmeet';

interface LiveCountdownProps {
  sessions: KabSession[];
  loading?: boolean;
  onSelectSession: (session: KabSession) => void;
  onToggleRemind?: (sessionId: string) => void;
  onBrowseUpcoming?: () => void;
}

interface TimeParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeParts(targetIso: string, nowMs: number): TimeParts {
  const targetMs = new Date(targetIso).getTime();
  const totalMs = Number.isNaN(targetMs) ? 0 : Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalMs, days, hours, minutes, seconds };
}

function formatPad(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

function formatScheduleLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Scheduled soon';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LiveCountdown({
  sessions,
  loading = false,
  onSelectSession,
  onToggleRemind,
  onBrowseUpcoming,
}: LiveCountdownProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const nextSession = useMemo(() => {
    const priorityUpcoming = sessions
      .filter(
        (s) =>
          !s.isPrivateClass &&
          s.status === 'UPCOMING' &&
          (s.communitySlug === 'indabax' || s.communitySlug === 'kab-ai'),
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );

    // Prefer the soonest upcoming IndabaX or KAB AI session whose start time hasn't passed by >5 mins
    const activeFuture = priorityUpcoming.find(
      (s) => new Date(s.scheduledAt).getTime() > nowMs - 300_000,
    );
    return activeFuture ?? priorityUpcoming[0] ?? null;
  }, [sessions, nowMs]);

  if (loading && sessions.length === 0) {
    return (
      <div
        aria-label="Loading next IndabaX or KAB AI session countdown"
        className="rounded-xl border border-white/15 bg-night-forest/80 p-5 text-white backdrop-blur-md"
      >
        <div className="h-3 w-40 animate-pulse rounded bg-white/15" />
        <div className="mt-3 h-6 w-3/4 animate-pulse rounded bg-white/15" />
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-16 animate-pulse rounded-lg border border-white/10 bg-white/5"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!nextSession) {
    return (
      <div className="rounded-xl border border-white/15 bg-night-forest/80 p-5 text-white backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-sun-yellow">
          <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          <span>IndabaX &amp; KAB AI Schedule</span>
        </div>
        <h2 className="mt-2 font-display text-xl font-bold uppercase tracking-wide text-white">
          New campus sessions coming soon
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-mist/85">
          Check the schedule below for active streams, replays, or club announcements.
        </p>
        {onBrowseUpcoming && (
          <button
            type="button"
            onClick={onBrowseUpcoming}
            className="mt-4 inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:border-amber-gold hover:bg-white/15"
          >
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            <span>View schedule</span>
          </button>
        )}
      </div>
    );
  }

  const time = getTimeParts(nextSession.scheduledAt, nowMs);
  const isStartingNow = time.totalMs <= 0;
  const units = [
    { label: 'Days', value: formatPad(time.days) },
    { label: 'Hrs', value: formatPad(time.hours) },
    { label: 'Min', value: formatPad(time.minutes) },
    { label: 'Sec', value: formatPad(time.seconds) },
  ];

  return (
    <aside
      aria-label={`Live countdown to ${nextSession.title}`}
      className="rounded-xl border border-white/15 bg-night-forest/80 p-5 text-white backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.12em] text-sun-yellow">
        <span className="inline-flex items-center gap-1.5 truncate">
          <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span className="truncate">Next up · {nextSession.communityName}</span>
        </span>
        <span className="shrink-0 font-mono text-[11px] font-semibold text-signal-green">
          {isStartingNow ? 'Starting now' : 'Countdown'}
        </span>
      </div>

      <h2 className="mt-2 line-clamp-2 font-display text-lg font-bold leading-snug tracking-wide text-white sm:text-xl">
        {nextSession.title}
      </h2>

      <p className="mt-1 truncate text-xs text-mist/80">
        {nextSession.hostName} · {formatScheduleLabel(nextSession.scheduledAt)}
      </p>

      {/* Live 1s Tabular Countdown Readout */}
      <div
        role="timer"
        aria-live="off"
        aria-label={`${time.days} days, ${time.hours} hours, ${time.minutes} minutes, ${time.seconds} seconds remaining`}
        className="mt-4 grid grid-cols-4 gap-2"
      >
        {units.map((unit) => (
          <div
            key={unit.label}
            className="flex flex-col items-center justify-center rounded-lg border border-white/15 bg-black/25 px-2 py-2.5"
          >
            <span className="font-mono text-xl font-bold leading-none tabular-nums text-signal-green sm:text-2xl">
              {unit.value}
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-mist/75">
              {unit.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {onToggleRemind && (
          <button
            type="button"
            onClick={() => onToggleRemind(nextSession.id)}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-semibold transition-colors ${
              nextSession.reminded
                ? 'bg-sun-yellow text-night-forest'
                : 'border border-white/25 bg-white/10 text-white hover:border-amber-gold hover:bg-white/15'
            }`}
          >
            {nextSession.reminded ? (
              <BellRing className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Bell className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            )}
            <span>{nextSession.reminded ? 'Reminder saved' : 'Remind me'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelectSession(nextSession)}
          className="inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
        >
          {nextSession.mode === 'ROOM' ? (
            <Video className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          )}
          <span>{isStartingNow ? 'Join now' : 'Preview'}</span>
        </button>
      </div>
    </aside>
  );
}
