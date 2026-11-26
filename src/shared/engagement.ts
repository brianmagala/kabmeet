/*
 * Engagement rules shared by the server and the browser: badges, weekly streaks and points.
 * Pure functions only (no storage, no clock besides what is passed in), so they are easy to test.
 *
 * What counts: a signed-in person who stays in a PUBLIC session for at least ATTEND_SECONDS.
 * Private classes never count here. Their attendance has its own rules (Task 6) and their
 * activity must not leak onto a leaderboard.
 */

/** Seconds a person must stay in a session before it counts as attended. */
export const DEFAULT_ATTEND_SECONDS = 60;

/** Points per action. Caps per session stop spamming from inflating the board. */
export const POINTS = {
  attend: 10,
  chat: 1,
  chatCapPerSession: 10,
  question: 5,
  questionCapPerSession: 3,
  pollVote: 2,
  pollCapPerSession: 5,
  streakBonus: 5,
} as const;

export interface EngagementMetrics {
  sessionsAttended: number;
  bestStreak: number;
  chatMessages: number;
  questionsAsked: number;
  pollVotes: number;
  sessionsHosted: number;
}

export interface BadgeDef {
  id: string;
  /** Emoji is the badge's face (content, not an icon, see PROMPT.md section 3). */
  emoji: string;
  name: string;
  /** What the person did, written for the person. */
  description: string;
  metric: keyof EngagementMetrics;
  target: number;
}

export const BADGES: readonly BadgeDef[] = [
  { id: 'first-session', emoji: '🎓', name: 'First Session', description: 'Join your first live session.', metric: 'sessionsAttended', target: 1 },
  { id: 'explorer', emoji: '🧭', name: 'Explorer', description: 'Attend 5 different sessions.', metric: 'sessionsAttended', target: 5 },
  { id: 'regular', emoji: '🔥', name: 'Regular', description: 'Attend sessions 3 weeks in a row.', metric: 'bestStreak', target: 3 },
  { id: 'kikungiri', emoji: '🏔️', name: 'Kikungiri Climber', description: 'Keep a 8 week streak. Hill climbers never quit.', metric: 'bestStreak', target: 8 },
  { id: 'question-asker', emoji: '❓', name: 'Question Asker', description: 'Ask 3 questions in session Q&A.', metric: 'questionsAsked', target: 3 },
  { id: 'poll-master', emoji: '🗳️', name: 'Poll Master', description: 'Vote in 5 different polls.', metric: 'pollVotes', target: 5 },
  { id: 'chatterbox', emoji: '💬', name: 'Chatterbox', description: 'Send 25 chat messages.', metric: 'chatMessages', target: 25 },
  { id: 'host', emoji: '🎤', name: 'On the Mic', description: 'Host a session.', metric: 'sessionsHosted', target: 1 },
] as const;

export function getBadge(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

/** Badges whose target is met by these numbers. */
export function badgesFor(metrics: EngagementMetrics): string[] {
  return BADGES.filter((b) => metrics[b.metric] >= b.target).map((b) => b.id);
}

// ---------------------------------------------------------------------------------------------
// Weeks. A week runs Monday to Sunday in Kabale time (UTC+3, no daylight saving), so a streak
// does not break because a server happens to run in another time zone.

const MS_DAY = 86_400_000;
const MS_WEEK = 7 * MS_DAY;
const KABALE_OFFSET_MS = 3 * 3_600_000;

/** The Thursday (UTC midnight) of the ISO week that contains this moment in Kabale time. */
function thursdayOf(date: Date): Date {
  const t = new Date(date.getTime() + KABALE_OFFSET_MS);
  const dayFromMonday = (t.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 3 - dayFromMonday));
}

/** "2026-W48": the ISO week that contains this moment, in Kabale time. */
export function weekKeyOf(date: Date): string {
  const thu = thursdayOf(date);
  const yearStart = Date.UTC(thu.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thu.getTime() - yearStart) / MS_DAY + 1) / 7);
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** A whole number that goes up by exactly 1 each week, so "next week" is just index + 1. */
export function weekIndexOf(key: string): number {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return Number.NaN;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = Date.UTC(year, 0, 4);
  const jan4DayFromMonday = (new Date(jan4).getUTCDay() + 6) % 7;
  const mondayOfWeek1 = jan4 - jan4DayFromMonday * MS_DAY;
  const thursday = mondayOfWeek1 + (week - 1) * MS_WEEK + 3 * MS_DAY;
  return Math.round(thursday / MS_WEEK);
}

export interface StreakInfo {
  /** Weeks in a row, ending this week or last week. Last week still counts, so people have all of this week to continue. */
  current: number;
  best: number;
  /** Already attended something this week. */
  thisWeekDone: boolean;
}

export function computeStreak(weeks: readonly string[], nowKey: string): StreakInfo {
  const indexes = Array.from(new Set(weeks.map(weekIndexOf).filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);
  const nowIndex = weekIndexOf(nowKey);
  let best = 0;
  let run = 0;
  let prev = Number.NaN;
  for (const idx of indexes) {
    run = idx === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = idx;
  }
  // The run that ends at the newest week counts as "current" only if that week is this or last week.
  let current = 0;
  const last = indexes[indexes.length - 1];
  if (last !== undefined && (last === nowIndex || last === nowIndex - 1)) {
    current = 1;
    for (let i = indexes.length - 2; i >= 0 && indexes[i] === indexes[i + 1] - 1; i--) current++;
  }
  return { current, best, thisWeekDone: indexes.includes(nowIndex) };
}

/** Which badges are not yet earned, with how far along the person is. */
export function badgeProgress(metrics: EngagementMetrics, earnedIds: readonly string[]) {
  return BADGES.map((b) => ({
    id: b.id,
    emoji: b.emoji,
    name: b.name,
    description: b.description,
    earned: earnedIds.includes(b.id),
    progress: Math.min(metrics[b.metric], b.target),
    target: b.target,
  }));
}

// ---------------------------------------------------------------------------------------------
// Shapes sent over the API.

export interface EngagementSummary {
  points: number;
  weekPoints: number;
  streak: StreakInfo;
  /** Last 8 weeks, oldest first, for the streak dots. */
  recentWeeks: Array<{ key: string; attended: boolean }>;
  metrics: EngagementMetrics;
  badges: Array<ReturnType<typeof badgeProgress>[number] & { earnedAt: string | null }>;
  leaderboardOptIn: boolean;
  /** 1-based rank on the all-time board, or null when not opted in. */
  rank: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  streak: number;
  badgeCount: number;
  isYou: boolean;
}

export interface LeaderboardResponse {
  period: 'week' | 'all';
  weekKey: string;
  entries: LeaderboardEntry[];
  /** The caller's own place, when opted in and not already in the top list. */
  you: LeaderboardEntry | null;
  totalOptedIn: number;
}

export interface SessionStats {
  sessionId: string;
  peakViewers: number;
  currentViewers: number;
  /** Distinct signed-in people who joined. Visitors who are not signed in count only toward the peak. */
  uniqueSignedIn: number;
  totalWatchSeconds: number;
  avgWatchSeconds: number;
  chatMessages: number;
  questionsAsked: number;
  questionsAnswered: number;
  pollVotes: number;
  reactions: number;
  /** Viewers over time, oldest first. `t` is epoch milliseconds. */
  timeline: Array<{ t: number; viewers: number }>;
}
