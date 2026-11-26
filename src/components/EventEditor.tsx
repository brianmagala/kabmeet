import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { PillPulseButton } from './KabmeetMoments';
import { toLocalInput } from '../lib/eventFormat';
import { EVENT_LIMITS, type EventSpeaker, type EventView } from '../shared/events';
import type { KabSession } from '../types/kabmeet';

const field =
  'mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-signal-green';

/** Create or edit an event. The server checks everything again; this form only helps people get it right. */
export function EventEditor({
  event,
  onClose,
  onSaved,
}: {
  event: EventView | null;
  onClose: () => void;
  onSaved: (saved: EventView) => void;
}) {
  const { apiFetch, pushToast } = useKabmeet();
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startsAt, setStartsAt] = useState(event ? toLocalInput(event.startsAt) : '');
  const [endsAt, setEndsAt] = useState(event ? toLocalInput(event.endsAt) : '');
  const [venue, setVenue] = useState(event?.venue ?? '');
  const [coverUrl, setCoverUrl] = useState(event?.coverUrl ?? '');
  const [sessionIds, setSessionIds] = useState<string[]>(event?.sessionIds ?? []);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>(event?.speakers ?? []);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(event?.status ?? 'DRAFT');
  const [hackathon, setHackathon] = useState(event?.hackathon ?? false);
  const [sessions, setSessions] = useState<KabSession[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    apiFetch<{ sessions: KabSession[] }>('/api/sessions')
      .then((res) => setSessions(res.sessions.filter((s) => !s.isPrivateClass)))
      .catch(() => setError('Could not load sessions to pick from.'));
  }, [apiFetch]);

  const toggleSession = (id: string) =>
    setSessionIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const updateSpeaker = (i: number, patch: Partial<EventSpeaker>) =>
    setSpeakers((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!startsAt || !endsAt) {
      setError('Choose when the event starts and ends.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title,
        description,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        venue,
        coverUrl: coverUrl.trim(),
        sessionIds,
        speakers: speakers.filter((s) => s.name.trim()),
        status,
        hackathon,
      };
      const res = await apiFetch<{ event: EventView }>(event ? `/api/events/${event.id}` : '/api/events', {
        method: event ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onSaved(res.event);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the event.';
      setError(message);
      pushToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night-forest/70 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-editor-title"
        onSubmit={save}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="event-editor-title" className="font-display text-xl font-bold uppercase tracking-wide">
            {event ? 'Edit event' : 'New event'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted active:scale-95">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-xs font-medium">
          <label className="block">
            Title
            <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={EVENT_LIMITS.title} className={field} placeholder="IndabaX Kabale 2026" />
          </label>
          <label className="block">
            About this event
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={EVENT_LIMITS.description} rows={4} className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              Starts
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={field} />
            </label>
            <label className="block">
              Ends
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className={field} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              Venue
              <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={EVENT_LIMITS.venue} className={field} placeholder="Main Hall, Kabale University" />
            </label>
            <label className="block">
              Cover image link (https)
              <input type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} maxLength={500} className={field} placeholder="https://" />
            </label>
          </div>

          <fieldset>
            <legend>Sessions in this event</legend>
            <p className="mt-0.5 text-[11px] font-normal text-muted">Only public sessions can be added. Private classes never appear in an event.</p>
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {sessions.length === 0 && <li className="p-2 font-normal text-muted">No public sessions yet.</li>}
              {sessions.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 font-normal [@media(hover:hover)]:hover:bg-surface-elevated">
                    <input type="checkbox" checked={sessionIds.includes(s.id)} onChange={() => toggleSession(s.id)} className="mt-0.5 h-4 w-4 accent-signal-green" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="block text-[11px] text-muted">{new Date(s.scheduledAt).toLocaleString()}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend>Speakers</legend>
            <div className="mt-2 space-y-3">
              {speakers.map((sp, i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label={`Speaker ${i + 1} name`} value={sp.name} onChange={(e) => updateSpeaker(i, { name: e.target.value })} maxLength={EVENT_LIMITS.speakerName} placeholder="Name" className={field.replace('mt-1 ', '')} />
                    <input aria-label={`Speaker ${i + 1} role`} value={sp.role} onChange={(e) => updateSpeaker(i, { role: e.target.value })} maxLength={EVENT_LIMITS.speakerRole} placeholder="Role, for example Lecturer" className={field.replace('mt-1 ', '')} />
                  </div>
                  <textarea aria-label={`Speaker ${i + 1} bio`} value={sp.bio} onChange={(e) => updateSpeaker(i, { bio: e.target.value })} maxLength={EVENT_LIMITS.speakerBio} rows={2} placeholder="One or two lines about them" className={`${field.replace('mt-1 ', '')} mt-2`} />
                  <button type="button" onClick={() => setSpeakers((cur) => cur.filter((_, idx) => idx !== i))} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-live-red">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove speaker
                  </button>
                </div>
              ))}
              {speakers.length < EVENT_LIMITS.speakers && (
                <button type="button" onClick={() => setSpeakers((cur) => [...cur, { name: '', role: '', bio: '' }])} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 font-semibold">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a speaker
                </button>
              )}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-xl border border-border p-3 font-normal">
              <input type="checkbox" checked={hackathon} onChange={(e) => setHackathon(e.target.checked)} className="mt-0.5 h-4 w-4 accent-signal-green" />
              <span>
                <span className="block font-semibold">Hackathon mode</span>
                <span className="text-[11px] text-muted">Teams, submissions, judges and winner certificates.</span>
              </span>
            </label>
            <label className="block">
              Visibility
              <select value={status} onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')} className={field}>
                <option value="DRAFT">Draft (only you and admins)</option>
                <option value="PUBLISHED">Published (everyone)</option>
              </select>
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-live-red/60 bg-live-red/10 p-3 text-foreground">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-border px-5 text-xs font-semibold">
            Cancel
          </button>
          <PillPulseButton type="submit" busy={saving} busyLabel="Saving..." className="h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest">
            {event ? 'Save changes' : 'Create event'}
          </PillPulseButton>
        </div>
      </form>
    </div>
  );
}
