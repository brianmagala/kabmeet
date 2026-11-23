import Link from 'next/link';
import { CalendarDays, Play, Radio, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* IndabaX Hero Shell Banner (frosted dark glass card over deep green surface) */}
      <section className="relative overflow-hidden rounded-card border border-border bg-indaba-deep-green px-6 py-10 text-white shadow-card sm:px-10 sm:py-14">
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
