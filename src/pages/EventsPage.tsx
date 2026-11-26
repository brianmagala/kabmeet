import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MapPin, Plus } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { useLoadingStage } from '../hooks/useLoadingStage';
import { SlowStageNotice } from '../components/KabmeetMoments';
import { EventCountdown } from '../components/EventCountdown';
import { EventEditor } from '../components/EventEditor';
import { formatRange } from '../lib/eventFormat';
import { eventPhase, type EventView } from '../shared/events';

function EventCard({ event, onOpen }: { event: EventView; onOpen: () => void }) {
  const phase = eventPhase(event);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition-colors active:bg-surface-elevated [@media(hover:hover)]:hover:border-signal-green"
      >
        <span className="relative block h-36 w-full bg-indaba-deep-green">
          {event.coverUrl ? (
            <img src={event.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indaba-deep-green to-night-forest">
              <CalendarDays className="h-12 w-12 text-signal-green/70" strokeWidth={1.5} />
            </span>
          )}
          {event.status === 'DRAFT' && (
            <span className="absolute left-3 top-3 rounded-full bg-sun-yellow px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-night-forest">
              Draft, only you can see this
            </span>
          )}
          {event.hackathon && (
            <span className="absolute right-3 top-3 rounded-full bg-night-forest/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-signal-green">
              Hackathon
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-2 p-4">
          <span className="font-display text-xl font-bold uppercase leading-tight tracking-wide">{event.title}</span>
          <span className="text-xs text-muted">{formatRange(event.startsAt, event.endsAt)}</span>
          {event.venue && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              {event.venue}
            </span>
          )}
          <span className="mt-auto pt-2 text-xs font-semibold text-kab-blue dark:text-signal-green">
            {phase === 'live' ? 'Live now' : phase === 'ended' ? 'Ended' : <EventCountdown event={event} className="!gap-2 text-foreground [&_span.font-mono]:!text-lg" />}
          </span>
        </span>
      </button>
    </li>
  );
}

export function EventsPage() {
  const { apiFetch, navigate, role, pushToast } = useKabmeet();
  const [events, setEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const stage = useLoadingStage(loading);
  const canCreate = role === 'HOST' || role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await apiFetch<{ events: EventView[] }>('/api/events');
      setEvents(res.events);
    } catch {
      setFailed(true);
      pushToast('Could not load events.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = events.filter((e) => eventPhase(e) !== 'ended');
  const past = events.filter((e) => eventPhase(e) === 'ended').reverse();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">Kabale AI Club · IndabaX</p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide">Events</h1>
          <p className="mt-2 max-w-xl text-xs text-muted">
            Full event days and hackathons: the schedule, the speakers, and your certificate afterwards. Times are shown in Kabale time (EAT).
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            New event
          </button>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <div role="status" aria-label="Loading events">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="kab-shimmer h-64 rounded-xl" />
              ))}
            </ul>
            <SlowStageNotice stage={stage} onRetry={load} />
          </div>
        ) : failed && events.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-display text-lg font-semibold uppercase">Events could not load</p>
            <button type="button" onClick={load} className="mt-4 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest">
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center">
            <span aria-hidden="true" className="text-4xl">
              📅
            </span>
            <p className="mt-3 font-display text-lg font-semibold uppercase">No events yet</p>
            <p className="mt-1 text-xs text-muted">When the club plans an IndabaX day or a hackathon, it will show up here.</p>
            <button
              type="button"
              onClick={() => navigate('discover')}
              className="mt-4 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest"
            >
              See live sessions
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section aria-label="Upcoming and live events">
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} onOpen={() => navigate('event', { eventSlug: e.slug })} />
                  ))}
                </ul>
              </section>
            )}
            {past.length > 0 && (
              <section aria-label="Past events" className="mt-10">
                <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-muted">Past events</h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((e) => (
                    <EventCard key={e.id} event={e} onOpen={() => navigate('event', { eventSlug: e.slug })} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {editing && (
        <EventEditor
          event={null}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            pushToast(saved.status === 'DRAFT' ? 'Saved as a draft. Publish it when you are ready.' : 'Event published.', 'success');
            navigate('event', { eventSlug: saved.slug });
          }}
        />
      )}
    </div>
  );
}
