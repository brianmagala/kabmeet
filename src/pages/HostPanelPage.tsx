import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  Hand,
  Lock,
  MessageSquareOff,
  Pin,
  Radio,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { KabmeetLoadingCard, KabmeetSignalPrism } from '../components/KabmeetLoader';
import type { KabSession } from '../types/kabmeet';

export function HostPanelPage() {
  const { apiFetch, navigate, role, pushToast, isSlowNetwork } = useKabmeet();
  const [sessions, setSessions] = useState<KabSession[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsInput, setPollOptionsInput] = useState('Yes, keep going\nNeed more examples');
  const [blockedWordsInput, setBlockedWordsInput] = useState('');

  const isStaff =
    role === 'HOST' || role === 'MODERATOR' || role === 'LECTURER' || role === 'ADMIN';

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const [pubRes, clsRes] = await Promise.all([
        apiFetch<{ sessions: KabSession[] }>('/api/sessions'),
        apiFetch<{ classes: KabSession[] }>('/api/classes'),
      ]);
      const combined = [...pubRes.sessions, ...clsRes.classes];
      setSessions(combined);
      if (combined.length > 0 && !selectedId) {
        const live = combined.find((s) => s.status === 'LIVE') ?? combined[0];
        setSelectedId(live.id);
      }
    } catch {
      pushToast('Unable to load sessions for the host panel.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, pushToast, selectedId]);

  useEffect(() => {
    if (isStaff) {
      loadSessions();
    } else {
      setLoading(false);
    }
  }, [isStaff, loadSessions]);

  const { connected, state, emit } = useSessionRealtime(selectedId);

  useEffect(() => {
    if (state?.blockedWords) {
      setBlockedWordsInput(state.blockedWords.join(', '));
    }
  }, [state?.blockedWords]);

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-live-red/40 bg-surface p-8">
          <ShieldCheck className="mx-auto h-10 w-10 text-live-red" strokeWidth={2} />
          <h1 className="mt-4 font-display text-2xl font-bold uppercase">
            Host or moderator role required
          </h1>
          <p className="mt-2 text-sm text-muted">
            Only approved Hosts, Moderators, Lecturers, and Admins can open the live session
            control panel.
          </p>
          <button
            type="button"
            onClick={() => navigate('discover')}
            className="mt-5 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold text-night-forest"
          >
            Back to Discover
          </button>
        </div>
      </div>
    );
  }

  const handleLaunchPoll = (e: React.FormEvent) => {
    e.preventDefault();
    const options = pollOptionsInput
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
    if (!pollQuestion.trim() || options.length < 2) {
      pushToast('Enter a poll question and at least two answer choices.', 'error');
      return;
    }
    emit('poll:create', { question: pollQuestion.trim(), options });
    setPollQuestion('');
    pushToast('Poll launched to viewers.', 'success');
  };

  const handleSaveBlockedWords = (e: React.FormEvent) => {
    e.preventDefault();
    const words = blockedWordsInput
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    emit('host:moderation', { blockedWords: words });
    pushToast('Blocked word filter updated.', 'success');
  };

  const handleStatusChange = async (status: 'LIVE' | 'UPCOMING' | 'REPLAY') => {
    if (!selectedId) return;
    try {
      await apiFetch(`/api/sessions/${selectedId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSessions((prev) => prev.map((s) => (s.id === selectedId ? { ...s, status } : s)));
      pushToast(`Session marked as ${status}.`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not change status.', 'error');
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedId);
  const participants = state?.participants ?? [];
  const waitingRoom = state?.waitingRoom ?? [];
  const raisedHands = participants.filter((p) => p.handRaised);
  const pinnedMsg = state?.messages.find((m) => m.id === state.pinnedMessageId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-kab-blue dark:text-signal-green">
            Live Telemetry, Moderation &amp; Audience Controls
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide">
            Host Control Panel
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select session to moderate"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-11 max-w-xs rounded-full border border-border bg-surface px-4 text-xs font-semibold text-foreground"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.status}] {s.title}
              </option>
            ))}
          </select>

          {selectedSession && (
            <button
              type="button"
              onClick={() =>
                navigate(selectedSession.mode === 'WATCH' ? 'watch' : 'room', {
                  sessionId: selectedSession.id,
                })
              }
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-signal-green px-5 text-xs font-semibold text-night-forest"
            >
              <Radio className="h-4 w-4" />
              <span>Open session</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="mt-6">
          <KabmeetLoadingCard
            label="Loading host control panel"
            sublabel="Connecting live viewer telemetry, waiting queues, and moderation tools."
            slowHint={isSlowNetwork ? 'Weak network — keeping moderation socket active.' : null}
          />
        </div>
      ) : !selectedSession ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">No sessions available to manage yet.</p>
        </div>
      ) : (
        <>
          {/* Live Metrics Row */}
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-wider text-muted">Live viewers</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-indaba-deep-green dark:text-signal-green">
                {state?.viewerCount ?? selectedSession.viewerCount}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                {!connected && <KabmeetSignalPrism size="xs" label="Connecting socket" />}
                <span>{connected ? 'Realtime socket active' : 'Connecting...'}</span>
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-wider text-muted">Peak viewers</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
                {state?.peakViewers ?? selectedSession.peakViewers}
              </p>
              <p className="mt-1 text-xs text-muted">Session high watermark</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-wider text-muted">Raised hands</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-amber-gold">
                {raisedHands.length}
              </p>
              <p className="mt-1 text-xs text-muted">Awaiting speaker invite</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs uppercase tracking-wider text-muted">Waiting room</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-kab-blue dark:text-signal-green">
                {waitingRoom.length}
              </p>
              <p className="mt-1 text-xs text-muted">Guests waiting admission</p>
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            {/* Left Column: Session State, Chat Rules & Polls */}
            <div className="space-y-6 lg:col-span-6">
              {/* Session Broadcast State */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                  Broadcast controls
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['LIVE', 'UPCOMING', 'REPLAY'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(st)}
                      className={`h-9 rounded-full px-4 text-xs font-semibold ${
                        selectedSession.status === st
                          ? st === 'LIVE'
                            ? 'bg-live-red text-white'
                            : 'bg-signal-green text-night-forest'
                          : 'border border-border text-muted hover:text-foreground'
                      }`}
                    >
                      Mark {st}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => emit('host:moderation', { chatLocked: !state?.chatLocked })}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                      state?.chatLocked
                        ? 'bg-sun-yellow text-night-forest'
                        : 'border border-border hover:border-amber-gold'
                    }`}
                  >
                    {state?.chatLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    <span>{state?.chatLocked ? 'Unlock chat' : 'Lock chat'}</span>
                  </button>
                </div>

                {/* Slow Mode */}
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Chat slow mode
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[0, 5, 15, 30].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => emit('host:moderation', { slowModeSeconds: sec })}
                        className={`h-9 rounded-full px-4 font-mono text-xs font-semibold ${
                          (state?.slowModeSeconds ?? 0) === sec
                            ? 'bg-indaba-deep-green text-white'
                            : 'border border-border text-muted hover:text-foreground'
                        }`}
                      >
                        {sec === 0 ? 'Off' : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Blocked words */}
                <form onSubmit={handleSaveBlockedWords} className="mt-5 border-t border-border pt-4">
                  <label htmlFor="blocked-words" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    Blocked words (comma separated)
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="blocked-words"
                      type="text"
                      value={blockedWordsInput}
                      onChange={(e) => setBlockedWordsInput(e.target.value)}
                      placeholder="spam, spoiler"
                      className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-xs"
                    />
                    <button
                      type="submit"
                      className="h-10 rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>

              {/* Launch Poll */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-kab-blue dark:text-signal-green" />
                  <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                    Launch live poll
                  </h2>
                </div>
                <form onSubmit={handleLaunchPoll} className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Ask viewers a quick question..."
                    className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-sm"
                  />
                  <textarea
                    rows={3}
                    value={pollOptionsInput}
                    onChange={(e) => setPollOptionsInput(e.target.value)}
                    placeholder="One answer option per line"
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-full bg-kab-blue px-5 text-xs font-semibold text-white"
                  >
                    Publish poll
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Queues & Live Message Moderation */}
            <div className="space-y-6 lg:col-span-6">
              {/* Waiting Room + Raised Hands */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide">
                  <Users className="h-4 w-4 text-sun-yellow" />
                  <span>Speaker &amp; Waiting Queues</span>
                </h2>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted">
                      Waiting room ({waitingRoom.length})
                    </p>
                    {waitingRoom.length === 0 ? (
                      <p className="mt-1 text-xs text-muted">No guests waiting right now.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {waitingRoom.map((g) => (
                          <div
                            key={g.clientId}
                            className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-xs"
                          >
                            <span className="font-medium">{g.fullName}</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => emit('room:admit_guest', { clientId: g.clientId })}
                                className="inline-flex h-7 items-center gap-1 rounded-full bg-signal-green px-3 font-semibold text-night-forest"
                              >
                                <Check className="h-3 w-3" />
                                <span>Admit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => emit('room:deny_guest', { clientId: g.clientId })}
                                className="inline-flex h-7 items-center gap-1 rounded-full border border-border px-2.5 text-muted hover:text-live-red"
                              >
                                <X className="h-3 w-3" />
                                <span>Deny</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-muted">
                      Raised hands ({raisedHands.length})
                    </p>
                    {raisedHands.length === 0 ? (
                      <p className="mt-1 text-xs text-muted">No hands raised right now.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {raisedHands.map((p) => (
                          <div
                            key={p.clientId}
                            className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-xs"
                          >
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <Hand className="h-3.5 w-3.5 text-sun-yellow" />
                              <span>{p.fullName}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => emit('room:approve_speaker', { clientId: p.clientId })}
                              className="inline-flex h-7 items-center gap-1 rounded-full bg-signal-green px-3 font-semibold text-night-forest"
                            >
                              <UserCheck className="h-3 w-3" />
                              <span>Make speaker</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pinned Message & Recent Chat Moderation */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide">
                  <MessageSquareOff className="h-4 w-4 text-kab-blue dark:text-signal-green" />
                  <span>Chat Moderation</span>
                </h2>

                {pinnedMsg && (
                  <div className="mt-3 flex items-start justify-between gap-2 rounded-xl bg-sun-yellow p-3 text-xs text-night-forest">
                    <div>
                      <span className="font-bold uppercase">Pinned · {pinnedMsg.userName}: </span>
                      <span>{pinnedMsg.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => emit('chat:pin', { messageId: pinnedMsg.id })}
                      className="shrink-0 font-semibold underline"
                    >
                      Unpin
                    </button>
                  </div>
                )}

                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                  {(state?.messages ?? []).length === 0 ? (
                    <p className="text-xs text-muted">No chat messages in this session yet.</p>
                  ) : (
                    (state?.messages ?? [])
                      .slice()
                      .reverse()
                      .slice(0, 15)
                      .map((m) => (
                        <div
                          key={m.id}
                          className="flex items-start justify-between gap-2 rounded-xl border border-border bg-background p-2.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold">{m.userName}</span>{' '}
                            <span className="text-[10px] text-muted">({m.userRole})</span>
                            <p className="mt-0.5 break-words text-foreground/90">{m.text}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => emit('chat:pin', { messageId: m.id })}
                              title="Pin message"
                              className="rounded-full border border-border p-1.5 text-muted hover:text-amber-gold"
                            >
                              <Pin className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => emit('chat:delete', { messageId: m.id })}
                              title="Delete message"
                              className="rounded-full border border-border p-1.5 text-muted hover:text-live-red"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
