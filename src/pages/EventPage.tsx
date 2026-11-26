import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarPlus, Clock, MapPin, Pencil, Play, Radio, Users } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { useLoadingStage } from '../hooks/useLoadingStage';
import { SlowStageNotice } from '../components/KabmeetMoments';
import { EventCountdown } from '../components/EventCountdown';
import { EventEditor } from '../components/EventEditor';
import { HackathonPanel } from '../components/HackathonPanel';
import { downloadIcs } from '../lib/ics';
import { formatRange, formatTime, groupByDay, initials } from '../lib/eventFormat';
import type { EventSessionSummary, EventView } from '../shared/events';

function StatusChip({ status }: { status: string }) {
  if (status === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-live-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
        <Radio className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" /> Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
      <Clock className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" /> {status === 'ENDED' ? 'Ended' : 'Upcoming'}
    </span>
  );
}

function SessionRow({ session, onOpen }: { session: EventSessionSummary; onOpen: () => void }) {
  const isRoom = session.mode === 'ROOM';
  const label = session.status === 'ENDED' ? 'Watch replay' : session.status === 'LIVE' ? (isRoom ? 'Join room' : 'Watch live') : isRoom ? 'Open room' : 'Open session';
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
      <span className="w-16 shrink-0 font-mono text-lg font-bold tabular-nums">{formatTime(session.scheduledAt)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <StatusChip status={session.status} />
          <span className="text-[11px] text-muted">{session.communityName}</span>
        </span>
        <span className="mt-1 block font-semibold leading-snug">{session.title}</span>
        <span className="mt-0.5 block text-xs text-muted">with {session.hostName}</span>
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest transition-transform active:scale-95"
      >
        <Play className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        {label}
      </button>
    </li>
  );
}

export function EventPage() {
  const { apiFetch, navigate, activeEventSlug, pushToast } = useKabmeet();
  const [event, setEvent] = useState<EventView | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const stage = useLoadingStage(loading);

  const load = useCallback(async () => {
    if (!activeEventSlug) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMissing(false);
    try {
      const res = await apiFetch<{ event: EventView }>(`/api/events/${encodeURIComponent(activeEventSlug)}`);
      setEvent(res.event);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/not found/i.test(message)) setMissing(true);
      else pushToast('Could not load this event.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeEventSlug, apiFetch, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !event) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6" role="status" aria-label="Loading event">
        <div className="kab-shimmer h-56 rounded-xl" />
        <div className="kab-shimmer mt-4 h-8 w-2/3 rounded-xl" />
        <div className="kab-shimmer mt-3 h-24 rounded-xl" />
        <SlowStageNotice stage={stage} onRetry={load} />
      </div>
    );
  }

  if (missing || !event) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-border bg-surface p-8">
          <p className="font-display text-2xl font-bold uppercase">Event not found</p>
          <p className="mt-2 text-sm text-muted">It may have been removed, or it is still a draft.</p>
          <button type="button" onClick={() => navigate('events')} className="mt-5 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest">
            All events
          </button>
        </div>
      </div>
    );
  }

  const days = groupByDay(event.sessions);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <button type="button" onClick={() => navigate('events')} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted active:opacity-70 [@media(hover:hover)]:hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All events
      </button>

      <header className="relative overflow-hidden rounded-xl border border-border bg-indaba-deep-green text-white">
        {event.coverUrl && <img src={event.coverUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-night-forest via-night-forest/80 to-night-forest/50" />
        <div className="relative flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-sun-yellow">Kabale AI Club · IndabaX</span>
              {event.status === 'DRAFT' && <span className="rounded-full bg-sun-yellow px-2.5 py-0.5 text-[10px] font-bold uppercase text-night-forest">Draft, not public</span>}
              {event.hackathon && <span className="rounded-full bg-signal-green px-2.5 py-0.5 text-[10px] font-bold uppercase text-night-forest">Hackathon</span>}
            </div>
            <h1 className="mt-2 break-words font-display text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">{event.title}</h1>
            <p className="mt-3 text-sm text-mist/90">{formatRange(event.startsAt, event.endsAt)}</p>
            {event.venue && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-mist/90">
                <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" /> {event.venue}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <EventCountdown event={event} className="text-white" />
          </div>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            downloadIcs({
              id: event.id,
              title: event.title,
              description: event.description,
              venue: event.venue,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              url: `${window.location.origin}/`,
            })
          }
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-5 text-xs font-semibold transition-transform active:scale-95 [@media(hover:hover)]:hover:border-signal-green"
        >
          <CalendarPlus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Add to calendar
        </button>
        {event.canEdit && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-5 text-xs font-semibold transition-transform active:scale-95 [@media(hover:hover)]:hover:border-signal-green">
            <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Edit event
          </button>
        )}
      </div>

      {event.description && <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-relaxed">{event.description}</p>}

      <section aria-labelledby="schedule-heading" className="mt-8">
        <h2 id="schedule-heading" className="font-display text-2xl font-bold uppercase tracking-wide">
          Schedule
        </h2>
        {days.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-surface p-5 text-sm text-muted">The sessions for this event will be added soon.</p>
        ) : (
          days.map((day) => (
            <div key={day.key} className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">{day.label}</h3>
              <ul className="space-y-2.5">
                {day.items.map((s) => (
                  <SessionRow key={s.id} session={s} onOpen={() => navigate(s.mode === 'ROOM' ? 'room' : 'watch', { sessionId: s.id })} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {event.speakers.length > 0 && (
        <section aria-labelledby="speakers-heading" className="mt-10">
          <h2 id="speakers-heading" className="flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide">
            <Users className="h-5 w-5 text-kab-blue dark:text-signal-green" strokeWidth={2} aria-hidden="true" /> Speakers
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {event.speakers.map((sp, i) => (
              <li key={`${sp.name}-${i}`} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indaba-deep-green font-display text-lg font-bold text-signal-green">
                  {initials(sp.name)}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight">{sp.name}</span>
                  {sp.role && <span className="block text-xs text-kab-blue dark:text-signal-green">{sp.role}</span>}
                  {sp.bio && <span className="mt-1 block text-xs leading-relaxed text-muted">{sp.bio}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {event.hackathon && event.status === 'PUBLISHED' && <HackathonPanel event={event} />}

      {editing && (
        <EventEditor
          event={event}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setEvent(saved);
            pushToast('Event saved.', 'success');
          }}
        />
      )}
    </div>
  );
}
