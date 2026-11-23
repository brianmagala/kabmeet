'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Play } from 'lucide-react';

export interface UpcomingCountdownSession {
  id: string;
  title: string;
  communitySlug: 'indabax' | 'kab-ai';
  communityName: string;
  hostName: string;
  scheduledAt: string;
  href: string;
}

const DEFAULT_NEXT_SESSION: UpcomingCountdownSession = {
  id: 'sess-indabax-vision',
  title: 'Applied Computer Vision for East African Crops',
  communitySlug: 'indabax',
  communityName: 'IndabaX Kabale',
  hostName: 'Dr. Samuel Byamukama',
  // Fallback deterministic offset relative to first render if no prop passed
  scheduledAt: '',
  href: '/watch',
};

function formatPad(value: number): string {
  return String(Math.max(0, value)).padStart(2, '0');
}

export function LiveCountdown({
  session = DEFAULT_NEXT_SESSION,
}: {
  session?: UpcomingCountdownSession;
}) {
  const [targetMs] = useState<number>(() => {
    if (session.scheduledAt) {
      const parsed = new Date(session.scheduledAt).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    return Date.now() + 3600_000 * 4 + 25 * 60_000;
  });

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const units = [
    { label: 'Days', value: formatPad(days) },
    { label: 'Hrs', value: formatPad(hours) },
    { label: 'Min', value: formatPad(minutes) },
    { label: 'Sec', value: formatPad(seconds) },
  ];

  return (
    <aside
      aria-label={`Live countdown to ${session.title}`}
      className="rounded-card border border-white/15 bg-night-forest/80 p-5 text-white backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.12em] text-sun-yellow">
        <span className="inline-flex items-center gap-1.5 truncate">
          <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span className="truncate">Next up · {session.communityName}</span>
        </span>
        <span className="shrink-0 font-mono text-[11px] font-semibold text-signal-green">
          {totalMs <= 0 ? 'Starting now' : 'Countdown'}
        </span>
      </div>

      <h2 className="mt-2 line-clamp-2 font-display text-lg font-bold leading-snug tracking-wide text-white sm:text-xl">
        {session.title}
      </h2>

      <p className="mt-1 truncate text-xs text-mist/80">{session.hostName}</p>

      <div role="timer" aria-live="off" className="mt-4 grid grid-cols-4 gap-2">
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

      <div className="mt-4">
        <Link
          href={session.href}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-pill bg-signal-green px-4 text-xs font-semibold text-night-forest transition-transform duration-fast hover:brightness-95 active:scale-[0.98]"
        >
          <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          <span>{totalMs <= 0 ? 'Join session' : 'Preview session'}</span>
        </Link>
      </div>
    </aside>
  );
}
