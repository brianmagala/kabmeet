import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarDays,
  Play,
  Plus,
  Radio,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { KabmeetLoadingCard, KabmeetSignalPrism } from '../components/KabmeetLoader';
import type { Community, KabSession } from '../types/kabmeet';

export function DiscoverPage() {
  const { apiFetch, navigate, role, user, pushToast, isSlowNetwork } = useKabmeet();
  const [sessions, setSessions] = useState<KabSession[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'REPLAY'>('ALL');

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCommunity, setNewCommunity] = useState('indabax');
  const [newMode, setNewMode] = useState<'WATCH' | 'ROOM'>('WATCH');
  const [startNow, setStartNow] = useState(true);
  const [creating, setCreating] = useState(false);

  const canHost =
    role === 'HOST' || role === 'LECTURER' || role === 'ADMIN';

  const loadDiscover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (selectedCommunity) params.set('community', selectedCommunity);
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);

      const [sessRes, commRes] = await Promise.all([
        apiFetch<{ sessions: KabSession[] }>(`/api/sessions?${params.toString()}`),
        apiFetch<{ communities: Community[] }>('/api/communities'),
      ]);
      setSessions(sessRes.sessions);
      setCommunities(commRes.communities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions right now.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, query, selectedCommunity, selectedStatus]);

  useEffect(() => {
    loadDiscover();
  }, [loadDiscover]);

  const handleToggleRemind = async (sessionId: string) => {
    if (!user) {
      pushToast('Sign in first so we can save your session reminders.', 'info');
      navigate('auth');
      return;
    }
    try {
      const res = await apiFetch<{ reminded: boolean }>(`/api/sessions/${sessionId}/remind`, {
        method: 'POST',
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, reminded: res.reminded } : s)),
      );
      pushToast(
        res.reminded ? 'Reminder saved for this session.' : 'Reminder removed.',
        'success',
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not update reminder.', 'error');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiFetch<{ session: KabSession }>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          communitySlug: newCommunity,
          mode: newMode,
          startNow,
        }),
      });
      setSessions((prev) => [res.session, ...prev]);
      setScheduleOpen(false);
      setNewTitle('');
      setNewDesc('');
      pushToast(
        startNow ? 'Session is live now on Discover.' : 'Upcoming session scheduled.',
        'success',
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not create session.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const liveFeature = sessions.find((s) => s.status === 'LIVE') ?? sessions[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Hero Banner with Frosted Dark Glass Card over real student photo */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-indaba-deep-green shadow-sm">
        <img
          src="/src/assets/images/hero_indabax_campus_1795385728289.jpg"
          alt="Kabale University students collaborating during an IndabaX AI seminar"
          referrerPolicy="no-referrer"
          className="h-[340px] w-full object-cover sm:h-[380px]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-night-forest/90 via-night-forest/65 to-night-forest/25"
        />
        <div className="absolute inset-0 flex items-center p-5 sm:p-10">
          <div className="max-w-xl rounded-xl border border-white/15 bg-night-forest/75 p-5 text-white backdrop-blur-md sm:p-7">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-sun-yellow">
              Kabale University · ai.kab.ac.ug/indabax
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Live sessions, rooms, and classes in one place.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-mist/90">
              Watch IndabaX talks with live chat, join KAB AI coding rooms, or attend private
              university classes with automatic attendance.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {liveFeature && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(liveFeature.mode === 'ROOM' ? 'room' : 'watch', {
                      sessionId: liveFeature.id,
                    })
                  }
                  className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-signal-green px-5 text-xs font-semibold uppercase tracking-[0.08em] text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
                >
                  <Play className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  <span>{liveFeature.mode === 'ROOM' ? 'Join live room' : 'Watch live now'}</span>
                </button>
              )}
              {canHost && (
                <button
                  type="button"
                  onClick={() => setScheduleOpen(true)}
                  className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors duration-150 hover:border-amber-gold hover:bg-white/15"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  <span>Host session</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions, topics, or speakers..."
            aria-label="Search sessions"
            className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-muted"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Segmented Tabs */}
          <div
            role="tablist"
            aria-label="Filter sessions by status"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1"
          >
            {(
              [
                { key: 'ALL', label: 'All' },
                { key: 'LIVE', label: 'Live now' },
                { key: 'UPCOMING', label: 'Coming soon' },
                { key: 'REPLAY', label: 'Replays' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selectedStatus === tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`h-9 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  selectedStatus === tab.key
                    ? 'bg-signal-green text-night-forest'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by community"
            value={selectedCommunity}
            onChange={(e) => setSelectedCommunity(e.target.value)}
            className="h-11 rounded-full border border-border bg-surface px-4 text-xs font-medium text-foreground"
          >
            <option value="">All communities</option>
            {communities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Sessions Grid */}
      <section className="mt-6">
        {loading ? (
          <KabmeetLoadingCard
            label="Loading live campus sessions"
            sublabel="Checking active IndabaX talks, KAB AI coding rooms, and upcoming schedules."
            slowHint={
              isSlowNetwork
                ? 'Slow network detected — optimizing cards for fast campus loading.'
                : null
            }
          />
        ) : error ? (
          <div className="rounded-xl border border-live-red/40 bg-live-red/10 p-6 text-center">
            <p className="text-sm font-medium text-live-red">{error}</p>
            <button
              type="button"
              onClick={loadDiscover}
              className="mt-4 h-10 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest"
            >
              Try again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center">
            <Radio className="mx-auto h-8 w-8 text-muted" strokeWidth={2} aria-hidden="true" />
            <h2 className="mt-3 font-display text-xl font-semibold uppercase">
              No sessions match your filter
            </h2>
            <p className="mt-1 text-sm text-muted">
              Try clearing your search or checking another Kabale University community.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedCommunity('');
                setSelectedStatus('ALL');
              }}
              className="mt-4 h-10 rounded-full border border-border px-5 text-xs font-semibold hover:border-amber-gold"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow duration-150 hover:shadow-md"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-night-forest">
                  <img
                    src={session.thumbnailUrl}
                    alt={session.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
                  />

                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    {session.status === 'LIVE' && (
                      <span className="animate-live-badge inline-flex items-center gap-1.5 rounded-full bg-live-red px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                        <Radio className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                        <span>Live</span>
                      </span>
                    )}
                    {session.status === 'UPCOMING' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sun-yellow px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-night-forest">
                        <CalendarDays className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                        <span>Upcoming</span>
                      </span>
                    )}
                    {session.status === 'REPLAY' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-night-forest/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-mist">
                        <Play className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                        <span>Replay</span>
                      </span>
                    )}
                  </div>

                  {session.status === 'LIVE' && (
                    <span className="absolute bottom-3 right-3 rounded-md bg-night-forest/85 px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-white">
                      {session.viewerCount} watching
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  {/* Quiet unboxed metadata line */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <button
                      type="button"
                      onClick={() =>
                        navigate('communities', { communitySlug: session.communitySlug })
                      }
                      className="font-semibold text-kab-blue hover:underline dark:text-signal-green"
                    >
                      {session.communityName}
                    </button>
                    <span aria-hidden="true">·</span>
                    <span>{session.hostName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{session.mode === 'ROOM' ? 'Interactive room' : 'Livestream'}</span>
                  </div>

                  <h2 className="mt-2 font-display text-xl font-semibold leading-snug text-foreground">
                    {session.title}
                  </h2>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
                    {session.description}
                  </p>

                  <div className="mt-5 flex items-center gap-2.5">
                    {session.status === 'UPCOMING' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleRemind(session.id)}
                          className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold transition-colors ${
                            session.reminded
                              ? 'bg-sun-yellow text-night-forest'
                              : 'border border-border bg-background text-foreground hover:border-amber-gold'
                          }`}
                        >
                          {session.reminded ? (
                            <BellRing className="h-4 w-4" strokeWidth={2} />
                          ) : (
                            <Bell className="h-4 w-4" strokeWidth={2} />
                          )}
                          <span>{session.reminded ? 'Reminder set' : 'Remind me'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('watch', { sessionId: session.id })}
                          className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full border border-border px-4 text-xs font-medium text-muted hover:text-foreground"
                        >
                          Preview
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(session.mode === 'ROOM' ? 'room' : 'watch', {
                              sessionId: session.id,
                            })
                          }
                          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
                        >
                          {session.mode === 'ROOM' ? (
                            <Video className="h-4 w-4" strokeWidth={2} />
                          ) : (
                            <Play className="h-4 w-4" strokeWidth={2} />
                          )}
                          <span>
                            {session.status === 'REPLAY'
                              ? 'Watch replay'
                              : session.mode === 'ROOM'
                                ? 'Join room'
                                : 'Watch live'}
                          </span>
                        </button>
                        {session.status === 'LIVE' && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(session.mode === 'ROOM' ? 'watch' : 'room', {
                                sessionId: session.id,
                              })
                            }
                            aria-label="Open interactive room"
                            title={session.mode === 'ROOM' ? 'Watch view' : 'Open room grid'}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:border-amber-gold hover:text-foreground"
                          >
                            <Users className="h-4 w-4" strokeWidth={2} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Schedule / Go Live Modal for Host/Lecturer/Admin */}
      {scheduleOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create session"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated p-6 text-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                Host or schedule a session
              </h2>
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                aria-label="Close modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-background"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="mt-4 space-y-4">
              <div>
                <label htmlFor="sess-title" className="block text-xs font-medium">
                  Session title
                </label>
                <input
                  id="sess-title"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Fine-tuning Vision Models on Campus"
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sess-comm" className="block text-xs font-medium">
                    Community
                  </label>
                  <select
                    id="sess-comm"
                    value={newCommunity}
                    onChange={(e) => setNewCommunity(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    {communities.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sess-mode" className="block text-xs font-medium">
                    Format
                  </label>
                  <select
                    id="sess-mode"
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as 'WATCH' | 'ROOM')}
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="WATCH">Watch Livestream (YouTube style)</option>
                    <option value="ROOM">Interactive Room (Meet style)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="sess-desc" className="block text-xs font-medium">
                  Description
                </label>
                <textarea
                  id="sess-desc"
                  required
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Share what students will learn and any repo or notebook links."
                  className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={startNow}
                  onChange={(e) => setStartNow(e.target.checked)}
                  className="h-4 w-4 accent-indaba-deep-green"
                />
                <span>Go live immediately on Discover (uncheck to list as Upcoming)</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleOpen(false)}
                  className="h-10 rounded-full border border-border px-5 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-signal-green px-5 text-xs font-semibold uppercase tracking-wider text-night-forest disabled:opacity-75"
                >
                  {creating && <KabmeetSignalPrism size="xs" label="Creating session" />}
                  <span>{creating ? 'Saving...' : startNow ? 'Launch live' : 'Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
