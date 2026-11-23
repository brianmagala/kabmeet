import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
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
import { useOptionalKabmeet } from '../context/KabmeetContext';
import type { KabSession, SessionContentType } from '../types/kabmeet';

interface SessionCardProps {
  session: KabSession;
  onJoin: (session: KabSession) => void;
  onOpenAlternateView?: (session: KabSession) => void;
  onOpenCommunity: (communitySlug: string) => void;
  onToggleRemind?: (sessionId: string) => void;
  joining?: boolean;
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

function formatSessionTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Scheduled';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export function resolveSessionContentType(session: KabSession): SessionContentType {
  if (session.contentType) return session.contentType;
  if (session.isPrivateClass || session.mode === 'CLASS') return 'CLASS_SEMINAR';

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

export function resolveSessionFeatureBadges(session: KabSession): SessionFeatureBadge[] {
  const text = `${session.title} ${session.description}`.toLowerCase();
  const badges: SessionFeatureBadge[] = [];

  const isRecording = Boolean(
    session.hasRecording ||
      session.status === 'REPLAY' ||
      session.replayDurationSec ||
      /\b(recording|replay)\b/.test(text),
  );
  if (isRecording) {
    badges.push({
      key: 'recording',
      label: 'Recording',
      icon: Disc,
      className:
        'border-amber-gold/40 bg-amber-gold/15 text-night-forest dark:border-amber-gold/40 dark:bg-amber-gold/20 dark:text-sun-yellow',
    });
  }

  const isInteractive = Boolean(
    session.isInteractive ||
      session.mode === 'ROOM' ||
      session.mode === 'CLASS' ||
      /\b(interactive|collaborative|coding\s*room)\b/.test(text),
  );
  if (isInteractive) {
    badges.push({
      key: 'interactive',
      label: 'Interactive',
      icon: Hand,
      className:
        'border-kab-blue/25 bg-kab-blue/10 text-kab-blue dark:border-sky-400/30 dark:bg-kab-blue/25 dark:text-sky-300',
    });
  }

  const hasQa = Boolean(
    session.hasQa || /\b(q\s*&\s*a|questions?\s*(?:&|and)\s*answers?|ask anything)\b/.test(text),
  );
  if (hasQa) {
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

export function SessionCard({
  session,
  onJoin,
  onOpenAlternateView,
  onOpenCommunity,
  onToggleRemind,
  joining,
}: SessionCardProps) {
  const kabmeet = useOptionalKabmeet();
  const [isJoining, setIsJoining] = useState(false);
  const joinTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (joinTimerRef.current !== null) {
        window.clearTimeout(joinTimerRef.current);
      }
    };
  }, []);

  const showJoining = Boolean(joining || isJoining);

  const handleJoinClick = () => {
    if (showJoining) return;
    setIsJoining(true);
    kabmeet?.pushToast('Redirecting to your session...', 'info');
    joinTimerRef.current = window.setTimeout(() => {
      onJoin(session);
      setIsJoining(false);
    }, 180);
  };

  const attendeeTotal =
    typeof session.attendeeCount === 'number'
      ? session.attendeeCount
      : session.status === 'REPLAY'
        ? session.peakViewers
        : session.viewerCount;

  const attendeeLabel =
    session.status === 'LIVE'
      ? `${attendeeTotal} attending`
      : session.status === 'UPCOMING'
        ? `${attendeeTotal} registered`
        : `${attendeeTotal} attended`;

  const hostInitials = getInitials(session.hostName);
  const useBlueAvatar =
    session.communitySlug === 'aws-cloud-club' ||
    session.communitySlug === 'huawei-student-club';

  const contentType = resolveSessionContentType(session);
  const contentMeta = CONTENT_TYPE_META[contentType];
  const ContentIcon = contentMeta.icon;
  const featureBadges = resolveSessionFeatureBadges(session);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow duration-150 hover:shadow-md">
      {/* Thumbnail + Status Overlay */}
      <div className="relative aspect-video w-full overflow-hidden bg-night-forest">
        <img
          src={session.thumbnailUrl}
          alt={session.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
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

        <span className="absolute bottom-3 left-3 text-[11px] font-medium text-mist/90 tabular-nums">
          {session.status === 'LIVE'
            ? 'Streaming now'
            : formatSessionTime(session.scheduledAt)}
        </span>

        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-night-forest/85 px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-white">
          <Users className="h-3 w-3 text-signal-green" strokeWidth={2} aria-hidden="true" />
          <span>{attendeeLabel}</span>
        </span>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-5">
        {/* Quiet unboxed metadata line */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <button
            type="button"
            onClick={() => onOpenCommunity(session.communitySlug)}
            className="font-semibold text-kab-blue hover:underline dark:text-signal-green"
          >
            {session.communityName}
          </button>
          <span aria-hidden="true">·</span>
          <span>{contentMeta.label}</span>
          <span aria-hidden="true">·</span>
          <span>{session.mode === 'ROOM' ? 'Interactive room' : 'Livestream'}</span>
        </div>

        {/* Content-Type Icon + Session Title */}
        <div className="mt-2.5 flex items-start gap-3">
          <span
            aria-hidden="true"
            title={contentMeta.label}
            className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${contentMeta.iconBoxClass}`}
          >
            <ContentIcon className="h-5 w-5" strokeWidth={2} />
          </span>
          <h2 className="font-display text-xl font-semibold leading-snug text-foreground">
            {session.title}
          </h2>
        </div>

        <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
          {session.description}
        </p>

        {featureBadges.length > 0 && (
          <div
            aria-label="Session attributes"
            className="mt-3 flex flex-wrap items-center gap-1.5"
          >
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

        {/* Host Avatar + Attendee Summary Row */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {session.hostAvatarUrl ? (
              <img
                src={session.hostAvatarUrl}
                alt={session.hostName}
                referrerPolicy="no-referrer"
                className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold tracking-wider text-white ${
                  useBlueAvatar ? 'bg-kab-blue' : 'bg-indaba-deep-green'
                }`}
              >
                {hostInitials}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">
                {session.hostName}
              </p>
              <p className="truncate text-[11px] text-muted">Session host</p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-medium tabular-nums text-muted">
            <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            <span>{attendeeTotal}</span>
          </span>
        </div>

        {/* Primary Action Row */}
        <div className="mt-4 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleJoinClick}
            disabled={showJoining}
            aria-busy={showJoining}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-signal-green px-4 text-xs font-semibold text-night-forest transition-all duration-150 hover:brightness-95 active:scale-[0.98] disabled:cursor-wait disabled:opacity-85"
          >
            {showJoining ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} aria-hidden="true" />
            ) : session.mode === 'ROOM' ? (
              <Video className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            )}
            <span>
              {showJoining
                ? 'Joining...'
                : session.status === 'REPLAY'
                  ? 'Watch replay'
                  : 'Join'}
            </span>
          </button>

          {session.status === 'UPCOMING' && onToggleRemind && (
            <button
              type="button"
              onClick={() => onToggleRemind(session.id)}
              aria-pressed={Boolean(session.reminded)}
              className={`inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-semibold transition-colors ${
                session.reminded
                  ? 'bg-sun-yellow text-night-forest'
                  : 'border border-border bg-background text-foreground hover:border-amber-gold'
              }`}
            >
              {session.reminded ? (
                <BellRing className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Bell className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              )}
              <span>{session.reminded ? 'Saved' : 'Remind me'}</span>
            </button>
          )}

          {session.status === 'LIVE' && onOpenAlternateView && (
            <button
              type="button"
              onClick={() => onOpenAlternateView(session)}
              aria-label={session.mode === 'ROOM' ? 'Open watch view' : 'Open interactive room'}
              title={session.mode === 'ROOM' ? 'Watch view' : 'Open room grid'}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:border-amber-gold hover:text-foreground"
            >
              <Users className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
