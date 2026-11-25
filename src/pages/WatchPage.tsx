import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Captions,
  CircleHelp,
  Flag,
  LayoutPanelLeft,
  MessageSquare,
  Pause,
  Pin,
  Play,
  Radio,
  Send,
  Sticker,
  ThumbsUp,
  Trash2,
  Users,
} from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { useSessionRealtime } from '../hooks/useSessionRealtime';
import { WorkspacePanel } from '../components/WorkspacePanel';
import { KabmeetLoadingCard } from '../components/KabmeetLoader';
import { HopDots, SignalBars } from '../components/KabmeetMoments';
import {
  FloatingReactionsOverlay,
  ReactionBar,
  useDoubleTapLike,
} from '../components/EmojiReactions';
import type { Community, KabSession, UserRole } from '../types/kabmeet';

const STICKERS = [
  { id: 'kab-heart', emoji: '❤️', label: 'Love it' },
  { id: 'kab-fire', emoji: '🔥', label: 'Sharp demo' },
  { id: 'indaba-clap', emoji: '👏', label: 'Great point!' },
  { id: 'kab-rocket', emoji: '🚀', label: 'Next level' },
  { id: 'kab-celebrate', emoji: '🙌', label: 'IndabaX!' },
  { id: 'kab-wow', emoji: '😮', label: 'Mind blown' },
] as const;

function roleBadgeStyle(role: UserRole): string {
  switch (role) {
    case 'HOST':
    case 'LECTURER':
      return 'bg-kab-blue text-white';
    case 'MODERATOR':
    case 'ADMIN':
      return 'bg-amber-gold text-night-forest';
    case 'SPEAKER':
      return 'bg-sun-yellow text-night-forest';
    default:
      return 'bg-white/10 text-mist';
  }
}

export function WatchPage() {
  const {
    activeSessionId,
    apiFetch,
    navigate,
    user,
    role,
    dataSaver,
    pushToast,
    isSlowNetwork,
  } = useKabmeet();
  const [session, setSession] = useState<KabSession | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { connected, accessDenied, state, hearts, emit, triggerReaction } =
    useSessionRealtime(activeSessionId);

  const [rightTab, setRightTab] = useState<'chat' | 'qa' | 'polls' | 'workspace'>('chat');
  const [chatMode, setChatMode] = useState<'live' | 'top'>('live');
  const [chatInput, setChatInput] = useState('');
  const [stickerTrayOpen, setStickerTrayOpen] = useState(false);

  const [qaInput, setQaInput] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsInput, setPollOptionsInput] = useState('Yes, let us do it\nNeeds more time');
  const [showCaptions, setShowCaptions] = useState(true);

  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(18);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const isStaff =
    role === 'HOST' || role === 'MODERATOR' || role === 'LECTURER' || role === 'ADMIN';
  const canParticipate = role !== 'VISITOR';

  const sendReaction = useCallback(
    (emoji: string, leftPercent?: number) => {
      const displayName = user?.nickname?.trim() || user?.fullName;
      triggerReaction(emoji, {
        leftPercent,
        userName: displayName,
        broadcast: canParticipate,
      });
    },
    [canParticipate, triggerReaction, user?.fullName, user?.nickname],
  );

  const { tapBursts, doubleTapHandlers } = useDoubleTapLike((xPercent) => {
    sendReaction('❤️', xPercent);
  });

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ session: KabSession }>(`/api/sessions/${activeSessionId}`);
      setSession(res.session);
      const commRes = await apiFetch<{ community: Community }>(
        `/api/communities/${res.session.communitySlug}`,
      );
      setCommunity(commRes.community);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this session.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, activeSessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Replay playback timer for REPLAY sessions
  useEffect(() => {
    if (!replayPlaying || session?.status !== 'REPLAY') return;
    const id = window.setInterval(() => {
      setReplayProgress((p) => (p >= 100 ? 0 : p + 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [replayPlaying, session?.status]);

  // Automatic attendance heartbeat when watching a private class
  useEffect(() => {
    if (!session?.isPrivateClass || !user) return;
    const ping = () => {
      apiFetch(`/api/classes/${session.id}/attendance/ping`, { method: 'POST' }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 15_000);
    return () => window.clearInterval(id);
  }, [session?.id, session?.isPrivateClass, user, apiFetch]);

  const displayedMessages = useMemo(() => {
    const list = state?.messages ?? [];
    if (chatMode === 'top') {
      return [...list].sort(
        (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.upvotes - a.upvotes,
      );
    }
    return list;
  }, [state?.messages, chatMode]);

  const pinnedMessage = useMemo(() => {
    if (!state?.pinnedMessageId) return null;
    return state.messages.find((m) => m.id === state.pinnedMessageId) ?? null;
  }, [state?.messages, state?.pinnedMessageId]);

  const handleFollowCommunity = async () => {
    if (!community) return;
    if (!user) {
      pushToast('Sign in to follow communities.', 'info');
      navigate('auth');
      return;
    }
    try {
      const res = await apiFetch<{ isFollowing: boolean; memberCount: number }>(
        `/api/communities/${community.slug}/follow`,
        { method: 'POST' },
      );
      setCommunity({
        ...community,
        isFollowing: res.isFollowing,
        memberCount: res.memberCount,
      });
      pushToast(res.isFollowing ? `Following ${community.name}.` : 'Unfollowed.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not update follow.', 'error');
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canParticipate) {
      pushToast('Sign in to send chat messages.', 'info');
      navigate('auth');
      return;
    }
    if (!chatInput.trim()) return;
    emit('chat:send', { text: chatInput.trim() });
    setChatInput('');
  };

  const handleSendSticker = (stickerId: string, label: string) => {
    if (!canParticipate) {
      pushToast('Sign in to send stickers.', 'info');
      navigate('auth');
      return;
    }
    emit('chat:send', { text: label, stickerId });
    setStickerTrayOpen(false);
  };

  const handleSendQa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canParticipate) {
      navigate('auth');
      return;
    }
    if (!qaInput.trim()) return;
    emit('qa:ask', { text: qaInput.trim() });
    setQaInput('');
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    const options = pollOptionsInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!pollQuestion.trim() || options.length < 2) {
      pushToast('Enter a question and at least 2 poll options.', 'error');
      return;
    }
    emit('poll:create', { question: pollQuestion.trim(), options });
    setPollQuestion('');
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !reportReason.trim()) return;
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.id, reason: reportReason.trim() }),
      });
      setReportOpen(false);
      setReportReason('');
      pushToast('Report sent to moderators and admins.', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Could not submit report.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <KabmeetLoadingCard
          variant="thread"
          fromLabel="YOU"
          toLabel="STREAM"
          label="Tuning into livestream"
          sublabel="Synchronizing video stage, live chat, Q&A, and shared workspace."
          slowHint={
            isSlowNetwork
              ? 'Poor network detected. Turn on Data saver in the top bar for smoother low-bandwidth playback.'
              : null
          }
          onRetry={loadSession}
        />
      </div>
    );
  }

  if (error || accessDenied || !session) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-xl border border-live-red/40 bg-surface p-8">
          <h1 className="font-display text-2xl font-bold uppercase text-live-red">
            Session unavailable
          </h1>
          <p className="mt-2 text-sm text-muted">
            {accessDenied || error || 'This session could not be found.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('discover')}
            className="mt-5 h-10 rounded-full bg-signal-green px-6 text-xs font-semibold uppercase tracking-wider text-night-forest"
          >
            Back to Discover
          </button>
        </div>
      </div>
    );
  }

  const viewerCount = state?.viewerCount ?? session.viewerCount;
  const latestCaption = state?.captions[state.captions.length - 1];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Video Stage + Details */}
        <div className="space-y-5 lg:col-span-8">
          {/* Video Stage — double-tap anywhere for ❤️ like */}
          <div
            {...doubleTapHandlers}
            className="relative aspect-video w-full select-none overflow-hidden rounded-xl border border-border bg-night-forest shadow-md"
          >
            <img
              src={session.thumbnailUrl}
              alt={session.title}
              referrerPolicy="no-referrer"
              className={`h-full w-full object-cover ${
                dataSaver ? 'opacity-35 blur-[1px]' : 'opacity-85'
              }`}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-night-forest via-night-forest/25 to-night-forest/55"
            />

            {/* Top Overlay Status */}
            <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {session.status === 'LIVE' && !state?.endedForAll ? (
                  <span className="animate-live-badge inline-flex items-center gap-1.5 rounded-full bg-live-red px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    <Radio className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span>Live</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-night-forest/85 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-mist">
                    <Play className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>Replay</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-night-forest/80 px-3 py-1 font-mono text-xs tabular-nums text-white">
                  <SignalBars
                    level={!connected ? 'reconnecting' : isSlowNetwork ? 'weak' : 'strong'}
                    label={!connected ? 'Reconnecting' : isSlowNetwork ? 'Weak signal' : 'Synced'}
                  />
                  <span>{viewerCount} watching</span>
                </span>
                {dataSaver && (
                  <span className="rounded-full bg-sun-yellow px-2.5 py-1 text-[11px] font-semibold text-night-forest">
                    Data saver: 360p / audio
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCaptions((p) => !p)}
                  aria-pressed={showCaptions}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
                    showCaptions
                      ? 'bg-sun-yellow text-night-forest'
                      : 'bg-night-forest/75 text-white hover:bg-night-forest'
                  }`}
                >
                  <Captions className="h-4 w-4" strokeWidth={2} />
                  <span>Captions</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('room', { sessionId: session.id })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-signal-green px-3.5 text-xs font-semibold text-night-forest"
                >
                  <Users className="h-4 w-4" strokeWidth={2} />
                  <span>Enter room</span>
                </button>
              </div>
            </div>

            {/* Floating Multi-Emoji & Double-Tap ❤️ Overlay */}
            <FloatingReactionsOverlay hearts={hearts} tapBursts={tapBursts} />

            {/* Live Captions Strip */}
            {showCaptions && latestCaption && (
              <div
                className={`pointer-events-none absolute left-4 right-4 flex justify-center ${
                  session.status === 'REPLAY' ? 'bottom-28' : 'bottom-16'
                }`}
              >
                <div className="max-w-xl rounded-lg bg-black/80 px-4 py-2 text-center text-xs text-white">
                  <span className="font-semibold text-sun-yellow">{latestCaption.speakerName}: </span>
                  <span>{latestCaption.text}</span>
                </div>
              </div>
            )}

            {/* Bottom Controls + Floating Reaction Bar inside Video Player */}
            <div
              data-no-doubletap="true"
              className="absolute bottom-3 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-2"
            >
              {session.status === 'REPLAY' ? (
                <div className="flex min-w-[200px] flex-1 items-center gap-3 rounded-full bg-night-forest/85 px-3 py-1.5 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setReplayPlaying((p) => !p)}
                    aria-label={replayPlaying ? 'Pause replay' : 'Play replay'}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-signal-green text-night-forest"
                  >
                    {replayPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={replayProgress}
                    onChange={(e) => setReplayProgress(Number(e.target.value))}
                    aria-label="Replay timeline"
                    className="h-1.5 flex-1 accent-signal-green"
                  />
                  <span className="font-mono text-xs tabular-nums text-mist">
                    {Math.floor((replayProgress * 45) / 60)}:
                    {String((replayProgress * 45) % 60).padStart(2, '0')} / 45:40
                  </span>
                </div>
              ) : (
                <div className="hidden items-center gap-2 rounded-full bg-night-forest/70 px-3 py-1.5 text-xs text-mist backdrop-blur-sm sm:flex">
                  <span>{session.hostName} presenting</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[11px] text-mist/75">
                    Double-tap stage for ❤️
                  </span>
                </div>
              )}

              <div className="ml-auto max-w-full">
                <ReactionBar compact collapsible onReact={(emoji) => sendReaction(emoji)} />
              </div>
            </div>
          </div>

          {/* Below Video Info */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-wide sm:text-3xl">
                  {session.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
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
                  <span>Hosted by {session.hostName}</span>
                  {community && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{community.memberCount} members</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {community && (
                  <button
                    type="button"
                    onClick={handleFollowCommunity}
                    className={`h-10 whitespace-nowrap rounded-full px-5 text-xs font-semibold uppercase tracking-wider ${
                      community.isFollowing
                        ? 'bg-sun-yellow text-night-forest'
                        : 'bg-signal-green text-night-forest'
                    }`}
                  >
                    {community.isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      navigate('auth');
                      return;
                    }
                    setReportOpen(true);
                  }}
                  aria-label="Report session"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted hover:border-live-red hover:text-live-red"
                >
                  <Flag className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted">{session.description}</p>
          </div>
        </div>

        {/* Right: Chat, Q&A, Polls & Workspace */}
        <aside className="flex h-[620px] flex-col overflow-hidden rounded-xl border border-border bg-surface lg:col-span-4">
          {/* Panel Tabs */}
          <div className="grid grid-cols-4 border-b border-border bg-background/60 p-1">
            {(
              [
                { key: 'chat', label: 'Chat', icon: MessageSquare },
                { key: 'qa', label: 'Q&A', icon: CircleHelp },
                { key: 'polls', label: 'Polls', icon: BarChart3 },
                { key: 'workspace', label: 'Work', icon: LayoutPanelLeft },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = rightTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setRightTab(t.key)}
                  className={`inline-flex h-10 items-center justify-center gap-1 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-signal-green text-night-forest'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden p-3.5">
            {/* CHAT TAB */}
            {rightTab === 'chat' && (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-full border border-border p-0.5">
                    <button
                      type="button"
                      onClick={() => setChatMode('live')}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        chatMode === 'live'
                          ? 'bg-indaba-deep-green text-white'
                          : 'text-muted'
                      }`}
                    >
                      Live chat
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatMode('top')}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        chatMode === 'top'
                          ? 'bg-indaba-deep-green text-white'
                          : 'text-muted'
                      }`}
                    >
                      Top chat
                    </button>
                  </div>
                  {state && state.slowModeSeconds > 0 && (
                    <span className="text-[11px] font-medium text-amber-gold">
                      Slow mode: {state.slowModeSeconds}s
                    </span>
                  )}
                </div>

                {/* Pinned Message Banner in Sun Yellow */}
                {pinnedMessage && (
                  <div className="mb-2.5 rounded-xl bg-sun-yellow px-3 py-2 text-xs text-night-forest">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Pin className="h-3.5 w-3.5" strokeWidth={2} />
                      <span>Pinned · {pinnedMessage.userName}</span>
                    </div>
                    <p className="mt-0.5 leading-snug">{pinnedMessage.text}</p>
                  </div>
                )}

                {/* Messages Feed */}
                <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                  {displayedMessages.length === 0 ? (
                    <p className="py-10 text-center text-xs text-muted">
                      No chat messages yet. Say hello to the community!
                    </p>
                  ) : (
                    displayedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="group rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{msg.userName}</span>
                            {msg.userRole !== 'MEMBER' && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${roleBadgeStyle(
                                  msg.userRole,
                                )}`}
                              >
                                {msg.userRole}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => emit('chat:upvote', { messageId: msg.id })}
                              aria-label="Upvote message"
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:text-foreground"
                            >
                              <ThumbsUp className="h-3 w-3" />
                              <span className="font-mono tabular-nums">{msg.upvotes}</span>
                            </button>
                            {isStaff && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => emit('chat:pin', { messageId: msg.id })}
                                  aria-label="Pin message"
                                  className="rounded p-1 text-muted hover:text-sun-yellow"
                                >
                                  <Pin className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => emit('chat:delete', { messageId: msg.id })}
                                  aria-label="Delete message"
                                  className="rounded p-1 text-muted hover:text-live-red"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {msg.stickerId ? (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-sun-yellow px-2.5 py-1 text-xs font-semibold text-night-forest">
                            <span>
                              {STICKERS.find((s) => s.id === msg.stickerId)?.emoji ?? '✨'}
                            </span>
                            <span>{msg.text}</span>
                          </div>
                        ) : (
                          <p className="mt-1 leading-relaxed text-foreground/90">{msg.text}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Sticker Tray */}
                {stickerTrayOpen && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-background p-2">
                    {STICKERS.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleSendSticker(st.id, st.label)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sun-yellow px-2.5 py-1.5 text-xs font-semibold text-night-forest hover:brightness-95"
                      >
                        <span aria-hidden="true">{st.emoji}</span>
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Chat Composer */}
                {!connected && (
                  <div className="mt-2.5">
                    <HopDots label="Connecting to chat. Messages will send when it is ready." />
                  </div>
                )}
                <form onSubmit={handleSendChat} className="mt-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStickerTrayOpen((p) => !p)}
                    aria-label="Open sticker tray"
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                      stickerTrayOpen
                        ? 'border-sun-yellow bg-sun-yellow text-night-forest'
                        : 'border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <Sticker className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <input
                    type="text"
                    disabled={Boolean(state?.chatLocked && !isStaff)}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      state?.chatLocked && !isStaff
                        ? 'Chat locked by host'
                        : canParticipate
                          ? 'Say something...'
                          : 'Sign in to chat'
                    }
                    className="h-10 flex-1 rounded-full border border-border bg-background px-3.5 text-xs text-foreground"
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal-green text-night-forest"
                  >
                    <Send className="h-4 w-4" strokeWidth={2} />
                  </button>
                </form>
              </>
            )}

            {/* Q&A TAB */}
            {rightTab === 'qa' && (
              <div className="flex flex-1 flex-col gap-3 overflow-hidden">
                <form onSubmit={handleSendQa} className="flex gap-2">
                  <input
                    type="text"
                    value={qaInput}
                    onChange={(e) => setQaInput(e.target.value)}
                    placeholder="Ask the speaker a question..."
                    className="h-10 flex-1 rounded-full border border-border bg-background px-3.5 text-xs text-foreground"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest"
                  >
                    Ask
                  </button>
                </form>

                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {(state?.questions ?? []).length === 0 ? (
                    <p className="py-10 text-center text-xs text-muted">
                      No questions yet. Ask the first question for the speaker.
                    </p>
                  ) : (
                    [...(state?.questions ?? [])]
                      .sort((a, b) => b.upvoterIds.length - a.upvoterIds.length)
                      .map((q) => (
                        <div
                          key={q.id}
                          className="rounded-xl border border-border bg-background p-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-muted">{q.authorName}</span>
                            {q.answered && (
                              <span className="rounded-full bg-signal-green px-2 py-0.5 text-[10px] font-bold text-night-forest">
                                Answered
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-foreground">{q.text}</p>
                          <div className="mt-2.5 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => emit('qa:upvote', { questionId: q.id })}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:border-amber-gold"
                            >
                              <ThumbsUp className="h-3 w-3" />
                              <span className="font-mono tabular-nums">{q.upvoterIds.length}</span>
                            </button>
                            {isStaff && (
                              <button
                                type="button"
                                onClick={() => emit('qa:answer', { questionId: q.id })}
                                className="text-[11px] font-semibold text-kab-blue hover:underline dark:text-signal-green"
                              >
                                {q.answered ? 'Reopen' : 'Mark answered'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* POLLS TAB */}
            {rightTab === 'polls' && (
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
                {isStaff && (
                  <form
                    onSubmit={handleCreatePoll}
                    className="space-y-2 rounded-xl border border-border bg-background p-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Launch live poll
                    </p>
                    <input
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Poll question"
                      className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs"
                    />
                    <textarea
                      rows={2}
                      value={pollOptionsInput}
                      onChange={(e) => setPollOptionsInput(e.target.value)}
                      placeholder="One option per line"
                      className="w-full rounded-lg border border-border bg-surface p-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="h-8 rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest"
                    >
                      Start poll
                    </button>
                  </form>
                )}

                {(state?.polls ?? []).length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted">
                    No active polls in this session yet.
                  </p>
                ) : (
                  (state?.polls ?? []).map((poll) => {
                    const totalVotes = poll.options.reduce(
                      (sum, o) => sum + o.voterIds.length,
                      0,
                    );
                    return (
                      <div
                        key={poll.id}
                        className="space-y-2 rounded-xl border border-border bg-background p-3.5"
                      >
                        <h3 className="text-xs font-semibold text-foreground">{poll.question}</h3>
                        <div className="space-y-1.5">
                          {poll.options.map((opt) => {
                            const pct =
                              totalVotes > 0
                                ? Math.round((opt.voterIds.length / totalVotes) * 100)
                                : 0;
                            const voted = Boolean(user && opt.voterIds.includes(user.id));
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  if (!canParticipate) {
                                    navigate('auth');
                                    return;
                                  }
                                  emit('poll:vote', { pollId: poll.id, optionId: opt.id });
                                }}
                                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                  voted
                                    ? 'border-signal-green bg-signal-green/15'
                                    : 'border-border bg-surface hover:border-amber-gold'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{opt.label}</span>
                                  <span className="font-mono tabular-nums text-muted">
                                    {pct}%
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="font-mono text-[11px] tabular-nums text-muted">
                          {totalVotes} total votes
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* WORKSPACE TAB */}
            {rightTab === 'workspace' && state && (
              <WorkspacePanel
                workspace={state.workspace}
                canEdit={canParticipate}
                onUpdateNotes={(notes) => emit('workspace:update_notes', { notes })}
                onUpdateCode={(code, codeLanguage) =>
                  emit('workspace:update_code', { code, codeLanguage })
                }
                onAddTask={(title) => emit('workspace:add_task', { title })}
                onToggleTask={(taskId) => emit('workspace:toggle_task', { taskId })}
                onDeleteTask={(taskId) => emit('workspace:delete_task', { taskId })}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Report Modal */}
      {reportOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report session"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6 text-foreground">
            <h2 className="font-display text-xl font-bold uppercase">Report an issue</h2>
            <p className="mt-1 text-xs text-muted">
              Reports go directly to Kabale University moderators and admins.
            </p>
            <form onSubmit={handleSubmitReport} className="mt-4 space-y-4">
              <textarea
                required
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full rounded-xl border border-border bg-background p-3 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="h-9 rounded-full border border-border px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-full bg-live-red px-4 text-xs font-semibold text-white"
                >
                  Submit report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
