'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  CalendarDays,
  Play,
  Radio,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react';

export interface SearchCommunityItem {
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  accentColor: 'deep-green' | 'kab-blue';
}

export interface SearchSessionItem {
  id: string;
  title: string;
  communityName: string;
  hostName: string;
  status: 'LIVE' | 'UPCOMING' | 'REPLAY';
  mode: 'WATCH' | 'ROOM';
  scheduledLabel: string;
}

const DEFAULT_COMMUNITIES: SearchCommunityItem[] = [
  {
    slug: 'indabax',
    name: 'IndabaX Kabale',
    description: 'Deep learning workshops, lightning demos, and campus research talks.',
    memberCount: 214,
    accentColor: 'deep-green',
  },
  {
    slug: 'kab-ai',
    name: 'KAB AI Club',
    description: 'Student machine learning study groups and applied Python coding rooms.',
    memberCount: 168,
    accentColor: 'deep-green',
  },
  {
    slug: 'huawei-student-club',
    name: 'Huawei Student Club',
    description: 'Networking, cloud infrastructure, and telecom certification prep sessions.',
    memberCount: 132,
    accentColor: 'kab-blue',
  },
  {
    slug: 'aws-cloud-club',
    name: 'AWS Cloud Club',
    description: 'Self-hosted deployments, containers, and DevOps labs at Kabale University.',
    memberCount: 119,
    accentColor: 'kab-blue',
  },
];

const DEFAULT_SESSIONS: SearchSessionItem[] = [
  {
    id: 'sess-ml-python',
    title: 'Intro to machine learning with Python',
    communityName: 'IndabaX Kabale',
    hostName: 'Dr. Bosco Turyagenda',
    status: 'LIVE',
    mode: 'WATCH',
    scheduledLabel: 'Live now',
  },
  {
    id: 'sess-git-workshop',
    title: 'Git workshop for beginners',
    communityName: 'KAB AI Club',
    hostName: 'Sarah Katushabe',
    status: 'LIVE',
    mode: 'ROOM',
    scheduledLabel: 'Live room',
  },
  {
    id: 'sess-docker-nginx',
    title: 'Deploying self-hosted apps with Docker & Nginx',
    communityName: 'AWS Cloud Club',
    hostName: 'Daniel Twinomujuni',
    status: 'UPCOMING',
    mode: 'WATCH',
    scheduledLabel: 'Upcoming session',
  },
];

type SearchScope = 'ALL' | 'COMMUNITIES' | 'LIVE_UPCOMING';

export function HomeSearchBar({
  communities = DEFAULT_COMMUNITIES,
  sessions = DEFAULT_SESSIONS,
}: {
  communities?: SearchCommunityItem[];
  sessions?: SearchSessionItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<SearchScope>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const matchedCommunities = useMemo(() => {
    if (!normalizedQuery) return communities;
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(normalizedQuery) ||
        c.slug.toLowerCase().includes(normalizedQuery) ||
        c.description.toLowerCase().includes(normalizedQuery),
    );
  }, [communities, normalizedQuery]);

  const matchedSessions = useMemo(() => {
    if (!normalizedQuery) {
      return sessions.filter((s) => s.status === 'LIVE' || s.status === 'UPCOMING');
    }
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(normalizedQuery) ||
        s.communityName.toLowerCase().includes(normalizedQuery) ||
        s.hostName.toLowerCase().includes(normalizedQuery),
    );
  }, [sessions, normalizedQuery]);

  const visibleCommunities =
    scope === 'ALL' || scope === 'COMMUNITIES' ? matchedCommunities : [];
  const visibleSessions =
    scope === 'ALL' || scope === 'LIVE_UPCOMING' ? matchedSessions : [];
  const hasAnyResults = visibleCommunities.length > 0 || visibleSessions.length > 0;

  return (
    <div ref={containerRef} className="relative z-30 mb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (visibleSessions.length > 0) {
            const first = visibleSessions[0];
            setIsOpen(false);
            router.push(first.mode === 'ROOM' ? '/room' : '/watch');
            return;
          }
          if (visibleCommunities.length > 0) {
            setIsOpen(false);
            router.push('/communities');
          }
        }}
        role="search"
        aria-label="Search Kabmeet communities and live sessions"
        className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-2.5 shadow-card sm:flex-row sm:items-center sm:gap-3 sm:px-3.5"
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
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsOpen(false);
            }}
            placeholder="Find communities, live talks, or upcoming sessions..."
            aria-label="Find communities, live talks, or upcoming sessions"
            aria-expanded={isOpen}
            className="h-11 w-full rounded-lg border border-transparent bg-background pl-10 pr-10 text-sm text-foreground placeholder:text-muted focus:border-indaba-deep-green focus:bg-surface dark:focus:border-signal-green"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-foreground"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div
            role="group"
            aria-label="Search scope"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1"
          >
            {(
              [
                { key: 'ALL', label: 'All' },
                { key: 'COMMUNITIES', label: 'Clubs' },
                { key: 'LIVE_UPCOMING', label: 'Live & Soon' },
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
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-signal-green px-4 text-xs font-semibold text-night-forest whitespace-nowrap hover:brightness-95"
          >
            Search
          </button>
        </div>
      </form>

      {isOpen && (
        <div
          role="region"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-card border border-border bg-surface-elevated shadow-xl"
        >
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {!hasAnyResults ? (
              <div className="px-5 py-7 text-center">
                <p className="text-sm font-medium text-foreground">
                  No communities or sessions match &ldquo;{query.trim()}&rdquo;
                </p>
              </div>
            ) : (
              <>
                {visibleCommunities.length > 0 && (
                  <div className="p-3 sm:p-4">
                    <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      <span>Communities</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {visibleCommunities.map((community) => (
                        <button
                          key={community.slug}
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            router.push('/communities');
                          }}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/60 p-3 text-left hover:border-indaba-deep-green dark:hover:border-signal-green"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {community.name}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                              {community.description}
                            </p>
                            <p className="mt-1 text-[11px] tabular-nums text-muted">
                              {community.memberCount} members
                            </p>
                          </div>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {visibleSessions.length > 0 && (
                  <div className="p-3 sm:p-4">
                    <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      <Radio className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      <span>Live &amp; upcoming sessions</span>
                    </div>
                    <div className="space-y-1.5">
                      {visibleSessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            router.push(session.mode === 'ROOM' ? '/room' : '/watch');
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-2.5 text-left hover:border-indaba-deep-green dark:hover:border-signal-green"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {session.status === 'LIVE' ? (
                                <span className="inline-flex items-center gap-1 rounded bg-live-red px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                  <Radio className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                                  <span>Live</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-sun-yellow px-1.5 py-0.5 text-[10px] font-bold uppercase text-night-forest">
                                  <CalendarDays
                                    className="h-3 w-3"
                                    strokeWidth={2}
                                    aria-hidden="true"
                                  />
                                  <span>Upcoming</span>
                                </span>
                              )}
                              <span className="truncate text-sm font-semibold text-foreground">
                                {session.title}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {session.communityName} · {session.hostName} · {session.scheduledLabel}
                            </p>
                          </div>
                          <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-signal-green px-2.5 text-xs font-semibold text-night-forest">
                            {session.mode === 'ROOM' ? (
                              <Video className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                            ) : (
                              <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                            )}
                            <span>{session.mode === 'ROOM' ? 'Join' : 'Watch'}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
