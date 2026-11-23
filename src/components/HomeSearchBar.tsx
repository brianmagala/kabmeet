import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  BellRing,
  CalendarDays,
  Play,
  Radio,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { Community, KabSession } from '../types/kabmeet';

type SearchScope = 'ALL' | 'COMMUNITIES' | 'LIVE_UPCOMING';

interface HomeSearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  communities: Community[];
  sessions: KabSession[];
  onSelectCommunity: (slug: string) => void;
  onSelectSession: (session: KabSession) => void;
  onToggleRemind?: (sessionId: string) => void;
  onFilterStatus?: (status: 'ALL' | 'LIVE' | 'UPCOMING' | 'REPLAY') => void;
}

function formatScheduledTime(iso: string): string {
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

export function HomeSearchBar({
  query,
  onQueryChange,
  communities,
  sessions,
  onSelectCommunity,
  onSelectSession,
  onToggleRemind,
  onFilterStatus,
}: HomeSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<SearchScope>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();

  // Close dropdown when clicking or tapping outside
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Press "/" anywhere outside text inputs to jump straight to the Home search bar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      setIsOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const matchedCommunities = useMemo(() => {
    const list = normalizedQuery
      ? communities.filter(
          (c) =>
            c.name.toLowerCase().includes(normalizedQuery) ||
            c.slug.toLowerCase().includes(normalizedQuery) ||
            c.description.toLowerCase().includes(normalizedQuery),
        )
      : communities;
    return list.slice(0, 4);
  }, [communities, normalizedQuery]);

  const matchedSessions = useMemo(() => {
    const statusWeight: Record<KabSession['status'], number> = {
      LIVE: 0,
      UPCOMING: 1,
      REPLAY: 2,
    };

    const filtered = sessions.filter((s) => {
      if (!normalizedQuery) {
        // When empty, spotlight Live and Upcoming sessions first
        return s.status === 'LIVE' || s.status === 'UPCOMING';
      }
      return (
        s.title.toLowerCase().includes(normalizedQuery) ||
        s.description.toLowerCase().includes(normalizedQuery) ||
        s.communityName.toLowerCase().includes(normalizedQuery) ||
        s.hostName.toLowerCase().includes(normalizedQuery)
      );
    });

    return [...filtered]
      .sort((a, b) => statusWeight[a.status] - statusWeight[b.status])
      .slice(0, 5);
  }, [sessions, normalizedQuery]);

  const showCommunities = scope === 'ALL' || scope === 'COMMUNITIES';
  const showSessions = scope === 'ALL' || scope === 'LIVE_UPCOMING';

  const visibleCommunities = showCommunities ? matchedCommunities : [];
  const visibleSessions = showSessions ? matchedSessions : [];
  const hasAnyResults = visibleCommunities.length > 0 || visibleSessions.length > 0;

  const liveCount = useMemo(
    () => sessions.filter((s) => s.status === 'LIVE').length,
    [sessions],
  );
  const upcomingCount = useMemo(
    () => sessions.filter((s) => s.status === 'UPCOMING').length,
    [sessions],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (visibleSessions.length === 1 && visibleCommunities.length === 0) {
      setIsOpen(false);
      onSelectSession(visibleSessions[0]);
      return;
    }
    if (visibleCommunities.length === 1 && visibleSessions.length === 0) {
      setIsOpen(false);
      onSelectCommunity(visibleCommunities[0].slug);
      return;
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative z-30 mb-5">
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Search Kabmeet communities and live sessions"
        className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-3 sm:px-3.5"
      >
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-indaba-deep-green dark:text-signal-green"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (isOpen) {
                  setIsOpen(false);
                } else if (query) {
                  onQueryChange('');
                }
              }
            }}
            placeholder="Find communities, live talks, or upcoming sessions..."
            aria-label="Find communities, live talks, or upcoming sessions"
            aria-expanded={isOpen}
            aria-controls="home-search-results"
            className="h-11 w-full rounded-lg border border-transparent bg-background pl-10 pr-16 text-sm text-foreground placeholder:text-muted focus:border-indaba-deep-green focus:bg-surface dark:focus:border-signal-green"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                onQueryChange('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 hidden rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline-block"
            >
              /
            </span>
          )}
        </div>

        {/* Quick Scope Actions (Single-line, clean segmented control) */}
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div
            role="group"
            aria-label="Search filter scope"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1"
          >
            {(
              [
                { key: 'ALL', label: 'All' },
                { key: 'COMMUNITIES', label: `Clubs (${communities.length})` },
                { key: 'LIVE_UPCOMING', label: `Live & Soon (${liveCount + upcomingCount})` },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setScope(item.key);
                  setIsOpen(true);
                  inputRef.current?.focus();
                }}
                className={`h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors sm:px-3 ${
                  scope === item.key
                    ? 'bg-indaba-deep-green text-white dark:bg-signal-green dark:text-night-forest'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-signal-green px-4 text-xs font-semibold text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98]"
          >
            <span>Search</span>
          </button>
        </div>
      </form>

      {/* Instant Discovery Dropdown Panel */}
      {isOpen && (
        <div
          id="home-search-results"
          role="region"
          aria-label="Quick search results"
          className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-xl"
        >
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {!hasAnyResults ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No communities or sessions match &ldquo;{query.trim()}&rdquo;
                </p>
                <p className="mt-1 text-xs text-muted">
                  Try another topic like Python, Docker, IndabaX, or AWS Cloud Club.
                </p>
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      onQueryChange('');
                      setScope('ALL');
                      inputRef.current?.focus();
                    }}
                    className="mt-3 inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-xs font-semibold text-foreground hover:border-amber-gold"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                {visibleCommunities.length > 0 && (
                  <div className="p-3 sm:p-4">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                        <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        <span>
                          {normalizedQuery ? 'Matching communities' : 'Campus communities'}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-muted">
                        {visibleCommunities.length}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {visibleCommunities.map((community) => (
                        <button
                          key={community.slug}
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onSelectCommunity(community.slug);
                          }}
                          className="group flex items-start justify-between gap-3 rounded-lg border border-border bg-background/60 p-3 text-left transition-colors hover:border-indaba-deep-green hover:bg-surface dark:hover:border-signal-green"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className={`h-2.5 w-2.5 shrink-0 rounded-sm ${
                                  community.accentColor === 'kab-blue'
                                    ? 'bg-kab-blue'
                                    : 'bg-indaba-deep-green dark:bg-signal-green'
                                }`}
                              />
                              <span className="truncate text-sm font-semibold text-foreground">
                                {community.name}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-1 text-xs text-muted">
                              {community.description}
                            </p>
                            <p className="mt-1.5 font-mono text-[11px] tabular-nums text-muted">
                              {community.memberCount} members
                              {community.isFollowing ? ' · Following' : ''}
                            </p>
                          </div>
                          <ArrowUpRight
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {visibleSessions.length > 0 && (
                  <div className="p-3 sm:p-4">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                        <Radio className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        <span>
                          {normalizedQuery
                            ? 'Matching sessions'
                            : 'Live now & upcoming sessions'}
                        </span>
                      </span>
                      {onFilterStatus && (
                        <div className="flex items-center gap-2 text-[11px] font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              onFilterStatus('LIVE');
                              setIsOpen(false);
                            }}
                            className="text-kab-blue hover:underline dark:text-signal-green"
                          >
                            All live
                          </button>
                          <span aria-hidden="true" className="text-muted">
                            ·
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onFilterStatus('UPCOMING');
                              setIsOpen(false);
                            }}
                            className="text-kab-blue hover:underline dark:text-signal-green"
                          >
                            All upcoming
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {visibleSessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-2.5 transition-colors hover:border-indaba-deep-green hover:bg-surface sm:flex-row sm:items-center sm:justify-between dark:hover:border-signal-green"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onSelectSession(session);
                            }}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <div className="mt-0.5 shrink-0">
                              {session.status === 'LIVE' ? (
                                <span className="inline-flex items-center gap-1 rounded bg-live-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                  <Radio className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                                  <span>Live</span>
                                </span>
                              ) : session.status === 'UPCOMING' ? (
                                <span className="inline-flex items-center gap-1 rounded bg-sun-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-night-forest">
                                  <CalendarDays
                                    className="h-3 w-3"
                                    strokeWidth={2}
                                    aria-hidden="true"
                                  />
                                  <span>Soon</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-night-forest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mist">
                                  <Play className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                                  <span>Replay</span>
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {session.title}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
                                <span>{session.communityName}</span>
                                <span aria-hidden="true">·</span>
                                <span>{session.hostName}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  {session.status === 'LIVE'
                                    ? `${session.viewerCount} watching`
                                    : formatScheduledTime(session.scheduledAt)}
                                </span>
                              </div>
                            </div>
                          </button>

                          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                            {session.status === 'UPCOMING' && onToggleRemind && (
                              <button
                                type="button"
                                onClick={() => onToggleRemind(session.id)}
                                className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                                  session.reminded
                                    ? 'bg-sun-yellow text-night-forest'
                                    : 'border border-border bg-surface text-foreground hover:border-amber-gold'
                                }`}
                              >
                                {session.reminded ? (
                                  <BellRing className="h-3.5 w-3.5" strokeWidth={2} />
                                ) : (
                                  <Bell className="h-3.5 w-3.5" strokeWidth={2} />
                                )}
                                <span>{session.reminded ? 'Saved' : 'Remind me'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setIsOpen(false);
                                onSelectSession(session);
                              }}
                              className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg bg-signal-green px-3 text-xs font-semibold text-night-forest transition-transform hover:brightness-95"
                            >
                              {session.mode === 'ROOM' ? (
                                <Video className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                              ) : (
                                <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                              )}
                              <span>
                                {session.status === 'UPCOMING'
                                  ? 'Preview'
                                  : session.mode === 'ROOM'
                                    ? 'Join'
                                    : 'Watch'}
                              </span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-background/70 px-4 py-2 text-[11px] text-muted">
            <span>
              {normalizedQuery
                ? `Filtering page sessions by "${query.trim()}"`
                : 'Select a community or session, or type to filter the list below'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-semibold text-foreground hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
