// Types and small rules shared by the server (server/events.ts) and the browser (events pages).
// Nothing in here may import server code.

export type EventStatus = 'DRAFT' | 'PUBLISHED';

export interface EventSpeaker {
  name: string;
  role: string;
  bio: string;
}

/** What is stored for one event. */
export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** ISO 8601, UTC. */
  startsAt: string;
  endsAt: string;
  venue: string;
  coverUrl?: string;
  sessionIds: string[];
  speakers: EventSpeaker[];
  createdBy: string;
  status: EventStatus;
  /** Switches on teams, submissions, judging and winner certificates. */
  hackathon: boolean;
  /** Set by the host when results are revealed (hackathon only). */
  resultsRevealedAt?: string | null;
}

/** A session as shown on the event page. Private classes are never listed. */
export interface EventSessionSummary {
  id: string;
  title: string;
  scheduledAt: string;
  status: 'UPCOMING' | 'LIVE' | 'ENDED' | string;
  mode: string;
  communityName: string;
  hostName: string;
}

export interface EventView extends Omit<EventRecord, 'resultsRevealedAt'> {
  sessions: EventSessionSummary[];
  /** The signed-in person may edit this event (an admin, or the host who made it). */
  canEdit: boolean;
  resultsRevealed: boolean;
}

export const EVENT_LIMITS = {
  title: 120,
  description: 4000,
  venue: 120,
  sessions: 30,
  speakers: 20,
  speakerName: 80,
  speakerRole: 80,
  speakerBio: 400,
} as const;

/** The number of ms until the event starts, or null when it already started. */
export function msUntil(startsAtIso: string, now: number = Date.now()): number | null {
  const diff = new Date(startsAtIso).getTime() - now;
  return diff > 0 ? diff : null;
}

export type EventPhase = 'upcoming' | 'live' | 'ended';

export function eventPhase(ev: Pick<EventRecord, 'startsAt' | 'endsAt'>, now: number = Date.now()): EventPhase {
  if (now < new Date(ev.startsAt).getTime()) return 'upcoming';
  if (now < new Date(ev.endsAt).getTime()) return 'live';
  return 'ended';
}

/** Hours and minutes for the countdown. Days are folded into hours so "tabular-nums" digits stay steady. */
export function splitCountdown(ms: number): { days: number; hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
  };
}

// ---------------------------------------------------------------------------------------------
// Hackathon (step 2)

export const TEAM_MAX_MEMBERS = 5;
export const JUDGE_CRITERIA = ['idea', 'build', 'demo', 'impact'] as const;
export type JudgeCriterion = (typeof JUDGE_CRITERIA)[number];
export const CRITERION_LABELS: Record<JudgeCriterion, string> = {
  idea: 'Idea',
  build: 'Build',
  demo: 'Demo',
  impact: 'Impact',
};

export interface TeamMemberView {
  userId: string;
  name: string;
  isCreator: boolean;
}

export interface TeamView {
  id: string;
  eventId: string;
  name: string;
  idea: string;
  members: TeamMemberView[];
  repoUrl: string | null;
  summary: string | null;
  /** ISO time of the demo slot the host assigned. */
  demoAt: string | null;
  /** Only filled for members of the team and for the host. */
  joinCode: string | null;
  isMine: boolean;
  isCreator: boolean;
}

export interface ScoreInput {
  idea: number;
  build: number;
  demo: number;
  impact: number;
  comment: string;
}

export interface RankedTeam {
  rank: number;
  teamId: string;
  teamName: string;
  average: Record<JudgeCriterion, number>;
  /** Mean of the four criterion averages. */
  total: number;
  judges: number;
}

export interface ResultsView {
  revealedAt: string;
  ranking: RankedTeam[];
}

// ---------------------------------------------------------------------------------------------
// Certificates (step 3)

export type CertificateKind = 'ATTENDANCE' | 'WINNER' | 'RUNNER_UP';

export interface VerifyResult {
  valid: true;
  code: string;
  name: string;
  eventTitle: string;
  /** Date of the event (its end date), ISO. */
  eventDate: string;
  kind: CertificateKind;
  teamName: string | null;
}

export const ATTENDANCE_THRESHOLD = 0.5;
