import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { eventPhase, splitCountdown, type EventRecord } from '../shared/events';

const pad = (n: number) => String(n).padStart(2, '0');

/** Days, hours and minutes until the event starts. At zero it says "Live now", after the end "Ended". */
export function EventCountdown({ event, className = '' }: { event: Pick<EventRecord, 'startsAt' | 'endsAt'>; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Minutes are the smallest unit shown, so a tick every 15 s is plenty and saves battery.
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const phase = eventPhase(event, now);
  if (phase === 'live') {
    return (
      <p className={`inline-flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide ${className}`}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live-red px-2.5 py-1 text-xs font-bold text-white">
          <Radio className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Live
        </span>
        <span>Live now</span>
      </p>
    );
  }
  if (phase === 'ended') {
    return <p className={`font-display text-xl font-bold uppercase tracking-wide ${className}`}>Event ended</p>;
  }
  const { days, hours, minutes } = splitCountdown(new Date(event.startsAt).getTime() - now);
  const parts: Array<[number, string]> = [
    [days, 'days'],
    [hours, 'hours'],
    [minutes, 'min'],
  ];
  return (
    <div role="timer" aria-label={`Starts in ${days} days, ${hours} hours and ${minutes} minutes`} className={`flex items-end gap-3 ${className}`}>
      {parts.map(([value, label]) => (
        <div key={label} className="text-center">
          <span className="block min-w-[2.2ch] font-mono text-3xl font-bold leading-none tabular-nums sm:text-4xl">{pad(value)}</span>
          <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.14em] opacity-80">{label}</span>
        </div>
      ))}
    </div>
  );
}
