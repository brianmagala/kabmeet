import Link from 'next/link';
import { CalendarDays, Play, Radio, Users } from 'lucide-react';
import {
  HomeSearchBar,
  LiveCountdown,
  SessionCard,
  type DiscoverSessionCardItem,
} from '@/features/discover/components';

const DISCOVER_SESSIONS: DiscoverSessionCardItem[] = [
  {
    id: 'sess-ml-python',
    title: 'Intro to machine learning with Python',
    description:
      'Hands-on walkthrough of scikit-learn pipelines, train/test splits, and evaluating crop-disease classifiers.',
    communityName: 'IndabaX Kabale',
    communitySlug: 'indabax',
    hostName: 'Aisha Namukasa',
    status: 'LIVE',
    mode: 'WATCH',
    contentType: 'ML_AI',
    attendeeCount: 42,
    scheduledLabel: 'Streaming now',
    href: '/watch',
    hasQa: true,
  },
  {
    id: 'sess-kabai-pytorch',
    title: 'PyTorch Study Jam: Building Your First Classifier',
    description:
      'Collaborative KAB AI Club coding room covering tensors, autograd, and training loops from scratch.',
    communityName: 'KAB AI Club',
    communitySlug: 'kab-ai',
    hostName: 'Sarah Katushabe',
    status: 'UPCOMING',
    mode: 'ROOM',
    contentType: 'CODING_JAM',
    attendeeCount: 19,
    scheduledLabel: 'Tomorrow · 14:00',
    href: '/room',
    isInteractive: true,
  },
  {
    id: 'sess-indaba-community-panel',
    title: 'IndabaX Kabale Community Meetup & Lightning Talks',
    description:
      'Open community townhall for Kabale University student researchers to pitch project ideas and form study circles.',
    communityName: 'IndabaX Kabale',
    communitySlug: 'indabax',
    hostName: 'Dr. Samuel Byamukama',
    status: 'UPCOMING',
    mode: 'WATCH',
    contentType: 'COMMUNITY_TALK',
    attendeeCount: 28,
    scheduledLabel: 'Upcoming today',
    href: '/watch',
    hasQa: true,
    hasRecording: true,
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <HomeSearchBar />

      {/* IndabaX Hero Shell Banner (frosted dark glass card + live countdown) */}
      <section className="relative overflow-hidden rounded-card border border-border bg-indaba-deep-green px-6 py-10 text-white shadow-card sm:px-10 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,380px)] lg:items-center">
          <div className="max-w-2xl rounded-card border border-white/15 bg-night-forest/75 p-6 backdrop-blur-md sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-sun-yellow">
              Kabale University · ai.kab.ac.ug/indabax
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide text-white sm:text-5xl">
              Live sessions and classes, built in.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist/90 sm:text-base">
              Join IndabaX talks, KAB AI workshops, and private university classes with live chat,
              raise-hand rooms, and automatic attendance in one place.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/watch"
                className="inline-flex h-11 items-center gap-2 rounded-pill bg-signal-green px-5 text-xs font-semibold uppercase tracking-[0.08em] text-night-forest whitespace-nowrap transition-transform duration-fast hover:brightness-95 active:scale-[0.98]"
              >
                <Play className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span>Watch live</span>
              </Link>
              <Link
                href="/communities"
                className="inline-flex h-11 items-center gap-2 rounded-pill border border-white/30 bg-white/10 px-5 text-xs font-semibold uppercase tracking-[0.08em] text-white whitespace-nowrap transition-colors duration-fast hover:border-amber-gold hover:bg-white/15"
              >
                <Users className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span>Browse clubs</span>
              </Link>
            </div>
          </div>

          <LiveCountdown />
        </div>
      </section>

      {/* Discover Upcoming & Live Sessions */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
            Discover upcoming &amp; live sessions
          </h2>
          <Link
            href="/communities"
            className="text-xs font-semibold text-kab-blue hover:underline dark:text-signal-green"
          >
            All clubs
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {DISCOVER_SESSIONS.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </section>

      {/* Shell Section Placeholders (populated in Phases 2–5) */}
      <section className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-card border border-border bg-surface p-6">
          <div className="flex items-center gap-2.5 text-indaba-deep-green dark:text-signal-green">
            <Radio className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
              Discover
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Live sessions, upcoming community talks, and past replays appear here in Phase 2.
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-6">
          <div className="flex items-center gap-2.5 text-kab-blue dark:text-sun-yellow">
            <Users className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
              Communities
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            IndabaX, KAB AI, Huawei Student Club, and AWS Cloud Club spaces live here.
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-6">
          <div className="flex items-center gap-2.5 text-indaba-deep-green dark:text-signal-green">
            <CalendarDays className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
              Virtual Classes
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Restricted lecturer sessions with automatic attendance and CSV export arrive in Phase 5.
          </p>
        </div>
      </section>
    </div>
  );
}
