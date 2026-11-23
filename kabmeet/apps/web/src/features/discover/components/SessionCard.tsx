'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BrainCircuit,
  CalendarDays,
  Cloud,
  Code,
  Disc,
  GraduationCap,
  Hand,
  Loader2,
  MessageCircleQuestion,
  Play,
  Radio,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useToast } from '@/components/layout';

export type SessionContentType =
  | 'ML_AI'
  | 'CODING_JAM'
  | 'CLOUD_INFRA'
  | 'COMMUNITY_TALK'
  | 'CLASS_SEMINAR';

export interface DiscoverSessionCardItem {
  id: string;
  title: string;
  description: string;
  communityName: string;
  communitySlug: string;
  hostName: string;
  hostAvatarUrl?: string | null;
  status: 'LIVE' | 'UPCOMING' | 'REPLAY';
  mode: 'WATCH' | 'ROOM' | 'CLASS';
  contentType?: SessionContentType;
  attendeeCount: number;
  scheduledLabel: string;
  href: string;
  hasRecording?: boolean;
  isInteractive?: boolean;
  hasQa?: boolean;
}

const CONTENT_TYPE_META: Record<
  SessionContentType,
  {
    icon: LucideIcon;
    label: string;
    iconBoxClass: string;
  }
> = {
  ML_AI: {
    icon: BrainCircuit,
    label: 'ML & AI',
    iconBoxClass:
      'border-indaba-deep-green/20 bg-indaba-deep-green/10 text-indaba-deep-green dark:border-signal-green/30 dark:bg-signal-green/15 dark:text-signal-green',
  },
  CODING_JAM: {
    icon: Code,
    label: 'Coding jam',
    iconBoxClass:
      'border-kab-blue/25 bg-kab-blue/10 text-kab-blue dark:border-sky-400/30 dark:bg-kab-blue/25 dark:text-sky-300',
  },
  CLOUD_INFRA: {
    icon: Cloud,
    label: 'Cloud & infra',
    iconBoxClass:
      'border-amber-gold/35 bg-amber-gold/15 text-night-forest dark:border-sun-yellow/30 dark:bg-sun-yellow/15 dark:text-sun-yellow',
  },
  CLASS_SEMINAR: {
    icon: GraduationCap,
    label: 'Virtual class',
    iconBoxClass:
      'border-indaba-deep-green/20 bg-indaba-deep-green/10 text-indaba-deep-green dark:border-signal-green/30 dark:bg-signal-green/15 dark:text-signal-green',
  },
  COMMUNITY_TALK: {
    icon: Users,
    label: 'Community talk',
    iconBoxClass:
      'border-border bg-background text-foreground dark:border-white/15 dark:bg-white/10 dark:text-mist',
  },
};

function resolveSessionContentType(session: DiscoverSessionCardItem): SessionContentType {
  if (session.contentType) return session.contentType;
  if (session.mode === 'CLASS') return 'CLASS_SEMINAR';

  const text = `${session.title} ${session.description}`.toLowerCase();
  if (
    /\b(coding\s*jam|study\s*jam|code\s*jam|hackathon|coding\s*room|git|github|workshop|live\s*coding|programming|sprint)\b/.test(
      text,
    )
  ) {
    return 'CODING_JAM';
  }
  if (
    /\b(machine\s*learning|deep\s*learning|neural\s*network|computer\s*vision|pytorch|scikit-learn|tensorflow|nlp|llm|ai|ml|data\s*science|classifier|model)\b/.test(
      text,
    )
  ) {
    return 'ML_AI';
  }
  if (
    /\b(docker|nginx|aws|cloud|kubernetes|linux|devops|server|routing|switching|5g|huawei|self-hosted|deploy)\b/.test(
      text,
    )
  ) {
    return 'CLOUD_INFRA';
  }
  return 'COMMUNITY_TALK';
}

interface SessionFeatureBadge {
  key: 'recording' | 'interactive' | 'qa';
  label: 'Recording' | 'Interactive' | 'Q&A';
  icon: LucideIcon;
  className: string;
}

function resolveSessionFeatureBadges(session: DiscoverSessionCardItem): SessionFeatureBadge[] {
  const text = `${session.title} ${session.description}`.toLowerCase();
  const badges: SessionFeatureBadge[] = [];

  if (
    session.hasRecording ||
    session.status === 'REPLAY' ||
    /\b(recording|replay)\b/.test(text)
  ) {
    badges.push({
      key: 'recording',
      label: 'Recording',
      icon: Disc,
      className:
        'border-amber-gold/40 bg-amber-gold/15 text-night-forest dark:border-amber-gold/40 dark:bg-amber-gold/20 dark:text-sun-yellow',
    });
  }

  if (
    session.isInteractive ||
    session.mode === 'ROOM' ||
    session.mode === 'CLASS' ||
    /\b(interactive|collaborative|coding\s*room)\b/.test(text)
  ) {
    badges.push({
      key: 'interactive',
      label: 'Interactive',
      icon: Hand,
      className:
        'border-kab-blue/25 bg-kab-blue/10 text-kab-blue dark:border-sky-400/30 dark:bg-kab-blue/25 dark:text-sky-300',
    });
  }

  if (session.hasQa || /\b(q\s*&\s*a|questions?\s*(?:&|and)\s*answers?)\b/.test(text)) {
    badges.push({
      key: 'qa',
      label: 'Q&A',
      icon: MessageCircleQuestion,
      className:
        'border-indaba-deep-green/25 bg-indaba-deep-green/10 text-indaba-deep-green dark:border-signal-green/30 dark:bg-signal-green/15 dark:text-signal-green',
    });
  }

  return badges;
}

function getInitials(name: string): string {
  const parts = name
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'KM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function SessionCard({ session }: { session: DiscoverSessionCardItem }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isJoining, setIsJoining] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleJoin = () => {
    if (isJoining) return;
    setIsJoining(true);
    pushToast('Redirecting to your session...', 'info');
    timerRef.current = window.setTimeout(() => {
      router.push(session.href);
    }, 180);
  };

  const hostInitials = getInitials(session.hostName);
  const useBlueAvatar =
    session.communitySlug === 'aws-cloud-club' ||
    session.communitySlug === 'huawei-student-club';

  const contentType = resolveSessionContentType(session);
  const contentMeta = CONTENT_TYPE_META[contentType];
  const ContentIcon = contentMeta.icon;
  const featureBadges = resolveSessionFeatureBadges(session);

  return (
    <article className="flex flex-col rounded-card border border-border bg-surface p-5 shadow-card transition-shadow duration-fast hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        {session.status === 'LIVE' ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-live-red px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
            <Radio className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            <span>Live</span>
          </span>
        ) : session.status === 'UPCOMING' ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-sun-yellow px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-night-forest">
            <CalendarDays className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            <span>Upcoming</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-pill bg-night-forest px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-mist">
            <Play className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            <span>Replay</span>
          </span>
        )}

        <span className="inline-flex items-center gap-1 font-mono text-xs font-medium tabular-nums text-muted">
          <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          <span>{session.attendeeCount} attending</span>
        </span>
      </div>

      <p className="mt-3 text-xs font-medium text-kab-blue dark:text-signal-green">
        {session.communityName} · {contentMeta.label} · {session.scheduledLabel}
      </p>

      <div className="mt-2 flex items-start gap-3">
        <span
          aria-hidden="true"
          title={contentMeta.label}
          className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${contentMeta.iconBoxClass}`}
        >
          <ContentIcon className="h-5 w-5" strokeWidth={2} />
        </span>
        <h3 className="font-display text-xl font-semibold leading-snug text-foreground">
          {session.title}
        </h3>
      </div>

      <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
        {session.description}
      </p>

      {featureBadges.length > 0 && (
        <div aria-label="Session attributes" className="mt-3 flex flex-wrap items-center gap-1.5">
          {featureBadges.map((badge) => {
            const BadgeIcon = badge.icon;
            return (
              <span
                key={badge.key}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
              >
                <BadgeIcon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>{badge.label}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {session.hostAvatarUrl ? (
            <img
              src={session.hostAvatarUrl}
              alt={session.hostName}
              className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                useBlueAvatar ? 'bg-kab-blue' : 'bg-indaba-deep-green'
              }`}
            >
              {hostInitials}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{session.hostName}</p>
            <p className="truncate text-[11px] text-muted">Session host</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleJoin}
          disabled={isJoining}
          aria-busy={isJoining}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill bg-signal-green px-4 text-xs font-semibold text-night-forest transition-all duration-fast hover:brightness-95 active:scale-[0.98] disabled:cursor-wait disabled:opacity-85"
        >
          {isJoining ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} aria-hidden="true" />
          ) : session.mode === 'ROOM' ? (
            <Video className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          )}
          <span>{isJoining ? 'Joining...' : 'Join'}</span>
        </button>
      </div>
    </article>
  );
}
