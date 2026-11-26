import { useEffect, useState } from 'react';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { formatRange } from '../lib/eventFormat';
import { EventCountdown } from './EventCountdown';
import { eventPhase, type EventView } from '../shared/events';

const WEEK = 7 * 24 * 3600 * 1000;

/** Small "Happening soon" card for Discover. Shows nothing unless a published event starts within 7 days (or is on now). */
export function EventSoonCard() {
  const { apiFetch, navigate } = useKabmeet();
  const [event, setEvent] = useState<EventView | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ events: EventView[] }>('/api/events')
      .then((res) => {
        if (cancelled) return;
        const now = Date.now();
        const soon = res.events
          .filter((e) => e.status === 'PUBLISHED')
          .filter((e) => {
            const phase = eventPhase(e, now);
            return phase === 'live' || (phase === 'upcoming' && new Date(e.startsAt).getTime() - now <= WEEK);
          })
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
        setEvent(soon ?? null);
      })
      .catch(() => {
        /* the card is optional: stay hidden if events cannot be loaded */
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  if (!event) return null;
  return (
    <section aria-label="Happening soon" className="mt-5">
      <button
        type="button"
        onClick={() => navigate('event', { eventSlug: event.slug })}
        className="group flex w-full flex-col gap-4 rounded-xl border border-amber-gold/50 bg-surface p-4 text-left transition-colors active:bg-surface-elevated sm:flex-row sm:items-center sm:justify-between sm:p-5 [@media(hover:hover)]:hover:border-signal-green"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indaba-deep-green text-signal-green">
            <CalendarDays className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">Happening soon</span>
            <span className="mt-0.5 block truncate font-display text-xl font-bold uppercase tracking-wide">{event.title}</span>
            <span className="mt-0.5 block text-xs text-muted">{formatRange(event.startsAt, event.endsAt)}</span>
          </span>
        </span>
        <span className="flex items-center justify-between gap-4 sm:justify-end">
          <EventCountdown event={event} className="text-foreground" />
          <ChevronRight className="h-5 w-5 shrink-0 text-muted transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </button>
    </section>
  );
}
