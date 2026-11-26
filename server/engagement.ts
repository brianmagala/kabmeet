// Engagement: badges, weekly streaks, an opt-in leaderboard and per-session stats for hosts.
// Rules live in src/shared/engagement.ts. This file keeps the numbers and applies the rules.
//
// Design choices (see PROMPT.md Task 14):
//  - Only signed-in people in PUBLIC sessions earn anything. Private classes are skipped on purpose.
//  - A person counts as having attended after ATTEND_SECONDS in the room, so a quick bounce earns nothing.
//  - Watch time is counted once per person, even with several tabs open.
//  - The leaderboard only lists people who switched it on. It never shows emails or ids.
import { store, type StoredUser } from './store';
import {
  BADGES,
  DEFAULT_ATTEND_SECONDS,
  POINTS,
  badgeProgress,
  badgesFor,
  computeStreak,
  getBadge,
  weekIndexOf,
  weekKeyOf,
  type EngagementMetrics,
  type EngagementSummary,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type SessionStats,
} from '../src/shared/engagement';

export interface UserEngagement {
  leaderboardOptIn: boolean;
  /** Distinct public sessions attended (newest last, capped). */
  attendedSessionIds: string[];
  /** ISO weeks with at least one attended session (capped). */
  weeks: string[];
  chatMessages: number;
  questionsAsked: number;
  pollVotes: number;
  points: number;
  /** Points per week, last 8 weeks only. */
  weeklyPoints: Record<string, number>;
  /** Badge id to ISO time earned. */
  badges: Record<string, string>;
  /** Per-session counters that enforce the point caps (newest sessions only). */
  perSession: Record<string, { chat: number; questions: number; polls: string[] }>;
}

export interface SessionEngagementStats {
  /** Seconds watched per signed-in person, closed connections only. Open ones are added when read. */
  viewerSeconds: Record<string, number>;
  reactions: number;
  timeline: Array<{ t: number; viewers: number }>;
}

const MAX_ATTENDED = 500;
const MAX_WEEKS = 104;
const MAX_PER_SESSION_RECORDS = 100;
const MAX_TIMELINE = 240;
const WEEKLY_POINTS_KEPT = 8;

function attendSeconds(): number {
  const raw = Number(process.env.KABMEET_ATTEND_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ATTEND_SECONDS;
}

// ---------------------------------------------------------------------------------------------
// Storage helpers

function engagementMap(): Record<string, UserEngagement> {
  store.state.engagement ??= {};
  return store.state.engagement;
}

function sessionStatsMap(): Record<string, SessionEngagementStats> {
  store.state.sessionStats ??= {};
  return store.state.sessionStats;
}

export function getEngagement(userId: string): UserEngagement {
  const map = engagementMap();
  let e = map[userId];
  if (!e) {
    e = {
      leaderboardOptIn: false,
      attendedSessionIds: [],
      weeks: [],
      chatMessages: 0,
      questionsAsked: 0,
      pollVotes: 0,
      points: 0,
      weeklyPoints: {},
      badges: {},
      perSession: {},
    };
    map[userId] = e;
  }
  return e;
}

function getSessionStats(sessionId: string): SessionEngagementStats {
  const map = sessionStatsMap();
  return (map[sessionId] ??= { viewerSeconds: {}, reactions: 0, timeline: [] });
}

/** Public sessions only. Unknown ids and private classes earn nothing. */
function countsForEngagement(sessionId: string): boolean {
  const session = store.state.sessions.find((s) => s.id === sessionId);
  return Boolean(session && !session.isPrivateClass);
}

// ---------------------------------------------------------------------------------------------
// Delivering awards to the person's open connections (registered by the websocket server).

export interface AwardNotice {
  badges: Array<{ id: string; emoji: string; name: string }>;
  /** Set when this award extended or started a streak of 2 or more weeks. */
  streakWeeks?: number;
}

type AwardNotifier = (userId: string, notice: AwardNotice) => void;
let notifier: AwardNotifier | null = null;

export function setAwardNotifier(fn: AwardNotifier | null): void {
  notifier = fn;
}

// ---------------------------------------------------------------------------------------------
// Metrics, badges, points

function sessionsHostedBy(userId: string): number {
  return store.state.sessions.filter((s) => s.hostId === userId && !s.isPrivateClass && s.status !== 'UPCOMING').length;
}

export function metricsFor(userId: string, now: Date = new Date()): EngagementMetrics {
  const e = getEngagement(userId);
  return {
    sessionsAttended: e.attendedSessionIds.length,
    bestStreak: computeStreak(e.weeks, weekKeyOf(now)).best,
    chatMessages: e.chatMessages,
    questionsAsked: e.questionsAsked,
    pollVotes: e.pollVotes,
    sessionsHosted: sessionsHostedBy(userId),
  };
}

/** Add points to the total and to this week's bucket. */
function addPoints(e: UserEngagement, amount: number, now: Date): void {
  if (amount <= 0) return;
  e.points += amount;
  const key = weekKeyOf(now);
  e.weeklyPoints[key] = (e.weeklyPoints[key] ?? 0) + amount;
  const keys = Object.keys(e.weeklyPoints).sort((a, b) => weekIndexOf(a) - weekIndexOf(b));
  for (const old of keys.slice(0, Math.max(0, keys.length - WEEKLY_POINTS_KEPT))) delete e.weeklyPoints[old];
}

/** Hand out any badges that are now earned. Returns the new ones. */
function awardBadges(userId: string, now: Date): Array<{ id: string; emoji: string; name: string }> {
  const e = getEngagement(userId);
  const earned = badgesFor(metricsFor(userId, now));
  const fresh: Array<{ id: string; emoji: string; name: string }> = [];
  for (const id of earned) {
    if (e.badges[id]) continue;
    e.badges[id] = now.toISOString();
    const def = getBadge(id);
    if (def) fresh.push({ id, emoji: def.emoji, name: def.name });
  }
  return fresh;
}

function finish(userId: string, now: Date, extra: Partial<AwardNotice> = {}): void {
  const badges = awardBadges(userId, now);
  if (badges.length > 0 || extra.streakWeeks) notifier?.(userId, { badges, ...extra });
}

function trimPerSession(e: UserEngagement): void {
  const ids = Object.keys(e.perSession);
  for (const id of ids.slice(0, Math.max(0, ids.length - MAX_PER_SESSION_RECORDS))) delete e.perSession[id];
}

function perSession(e: UserEngagement, sessionId: string) {
  const rec = (e.perSession[sessionId] ??= { chat: 0, questions: 0, polls: [] });
  trimPerSession(e);
  return rec;
}

// ---------------------------------------------------------------------------------------------
// Things people do. Callers save the store afterwards (they already do for chat, Q&A and polls).

export function recordAttendance(userId: string, sessionId: string, now: Date = new Date()): void {
  if (!countsForEngagement(sessionId)) return;
  const e = getEngagement(userId);
  if (e.attendedSessionIds.includes(sessionId)) return;
  e.attendedSessionIds.push(sessionId);
  if (e.attendedSessionIds.length > MAX_ATTENDED) e.attendedSessionIds.shift();

  let bonus = 0;
  const key = weekKeyOf(now);
  let streakWeeks: number | undefined;
  if (!e.weeks.includes(key)) {
    e.weeks.push(key);
    if (e.weeks.length > MAX_WEEKS) e.weeks.shift();
    const streak = computeStreak(e.weeks, key);
    if (streak.current >= 2) {
      bonus = POINTS.streakBonus;
      streakWeeks = streak.current;
    }
  }
  addPoints(e, POINTS.attend + bonus, now);
  finish(userId, now, { streakWeeks });
}

export function recordChat(userId: string, sessionId: string, now: Date = new Date()): void {
  if (!countsForEngagement(sessionId)) return;
  const e = getEngagement(userId);
  e.chatMessages += 1;
  const rec = perSession(e, sessionId);
  if (rec.chat < POINTS.chatCapPerSession) {
    rec.chat += 1;
    addPoints(e, POINTS.chat, now);
  }
  finish(userId, now);
}

export function recordQuestion(userId: string, sessionId: string, now: Date = new Date()): void {
  if (!countsForEngagement(sessionId)) return;
  const e = getEngagement(userId);
  e.questionsAsked += 1;
  const rec = perSession(e, sessionId);
  if (rec.questions < POINTS.questionCapPerSession) {
    rec.questions += 1;
    addPoints(e, POINTS.question, now);
  }
  finish(userId, now);
}

/** Changing a vote on the same poll does not earn twice. */
export function recordPollVote(userId: string, sessionId: string, pollId: string, now: Date = new Date()): void {
  if (!countsForEngagement(sessionId)) return;
  const e = getEngagement(userId);
  const rec = perSession(e, sessionId);
  if (rec.polls.includes(pollId)) return;
  rec.polls.push(pollId);
  e.pollVotes += 1;
  if (rec.polls.length <= POINTS.pollCapPerSession) addPoints(e, POINTS.pollVote, now);
  finish(userId, now);
}

export function recordReaction(sessionId: string): void {
  if (!countsForEngagement(sessionId)) return;
  getSessionStats(sessionId).reactions += 1;
}

// ---------------------------------------------------------------------------------------------
// Presence: who is in a session right now, for watch time and the viewers-over-time line.

interface OpenPresence {
  /** Open connections of this person in this session (two tabs = 2). */
  count: number;
  since: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const openPresence = new Map<string, OpenPresence>();
const presenceKey = (sessionId: string, userId: string) => `${sessionId}\u0000${userId}`;

function sampleTimeline(sessionId: string, viewers: number, now: number): void {
  const stats = getSessionStats(sessionId);
  const last = stats.timeline[stats.timeline.length - 1];
  if (last && last.viewers === viewers && now - last.t < 5_000) return;
  stats.timeline.push({ t: now, viewers });
  if (stats.timeline.length > MAX_TIMELINE) {
    // Keep the first and last points; thin out the rest by half.
    stats.timeline = stats.timeline.filter((_, i, arr) => i === 0 || i === arr.length - 1 || i % 2 === 0);
  }
}

/** A connection opened. `userId` is null for visitors who are not signed in. */
export function presenceEnter(sessionId: string, userId: string | null, viewersNow: number, now: number = Date.now()): void {
  sampleTimeline(sessionId, viewersNow, now);
  if (!userId || !countsForEngagement(sessionId)) return;
  const key = presenceKey(sessionId, userId);
  const open = openPresence.get(key);
  if (open) {
    open.count += 1;
    return;
  }
  const timer = setTimeout(() => {
    const cur = openPresence.get(key);
    if (cur) cur.timer = null;
    recordAttendance(userId, sessionId);
    store.save();
  }, attendSeconds() * 1000);
  timer.unref?.();
  openPresence.set(key, { count: 1, since: now, timer });
}

/** A connection closed. */
export function presenceLeave(sessionId: string, userId: string | null, viewersNow: number, now: number = Date.now()): void {
  sampleTimeline(sessionId, viewersNow, now);
  if (!userId) return;
  const key = presenceKey(sessionId, userId);
  const open = openPresence.get(key);
  if (!open) return;
  open.count -= 1;
  if (open.count > 0) return;
  if (open.timer) clearTimeout(open.timer);
  openPresence.delete(key);
  const seconds = Math.max(0, Math.round((now - open.since) / 1000));
  const stats = getSessionStats(sessionId);
  stats.viewerSeconds[userId] = (stats.viewerSeconds[userId] ?? 0) + seconds;
}

/** Test and shutdown helper: forget every open timer. */
export function clearPresenceTimers(): void {
  for (const open of openPresence.values()) if (open.timer) clearTimeout(open.timer);
  openPresence.clear();
}

// ---------------------------------------------------------------------------------------------
// Reading

function displayName(u: StoredUser): string {
  return u.nickname?.trim() || u.fullName;
}

function allTimeRanking(): Array<{ user: StoredUser; e: UserEngagement }> {
  const rows: Array<{ user: StoredUser; e: UserEngagement }> = [];
  for (const [userId, e] of Object.entries(engagementMap())) {
    if (!e.leaderboardOptIn) continue;
    const user = store.state.users.find((u) => u.id === userId && u.isActive);
    if (user) rows.push({ user, e });
  }
  return rows;
}

export function getSummary(user: StoredUser, now: Date = new Date()): EngagementSummary {
  awardBadges(user.id, now); // quiet catch-up, e.g. the Host badge
  const e = getEngagement(user.id);
  const nowKey = weekKeyOf(now);
  const metrics = metricsFor(user.id, now);
  const streak = computeStreak(e.weeks, nowKey);
  const nowIndex = weekIndexOf(nowKey);
  const recentWeeks = Array.from({ length: 8 }, (_, i) => {
    const idx = nowIndex - (7 - i);
    const key = e.weeks.find((w) => weekIndexOf(w) === idx);
    return { key: key ?? `w${idx}`, attended: Boolean(key) };
  });
  const progress = badgeProgress(metrics, Object.keys(e.badges));
  const board = e.leaderboardOptIn ? allTimeRanking().sort((a, b) => b.e.points - a.e.points) : [];
  const rank = e.leaderboardOptIn ? board.findIndex((r) => r.user.id === user.id) + 1 : 0;
  return {
    points: e.points,
    weekPoints: e.weeklyPoints[nowKey] ?? 0,
    streak,
    recentWeeks,
    metrics,
    badges: progress.map((b) => ({ ...b, earnedAt: e.badges[b.id] ?? null })),
    leaderboardOptIn: e.leaderboardOptIn,
    rank: rank > 0 ? rank : null,
  };
}

export function setLeaderboardOptIn(userId: string, optIn: boolean): void {
  getEngagement(userId).leaderboardOptIn = optIn;
}

const BOARD_SIZE = 20;

export function getLeaderboard(period: 'week' | 'all', requesterId: string, now: Date = new Date()): LeaderboardResponse {
  const nowKey = weekKeyOf(now);
  const rows = allTimeRanking()
    .map(({ user, e }) => ({
      id: user.id,
      name: displayName(user),
      points: period === 'week' ? (e.weeklyPoints[nowKey] ?? 0) : e.points,
      streak: computeStreak(e.weeks, nowKey).current,
      badgeCount: Object.keys(e.badges).length,
    }))
    // This week's board hides people with nothing yet, so it is not a list of zeros.
    .filter((r) => period === 'all' || r.points > 0)
    .sort((a, b) => b.points - a.points || b.badgeCount - a.badgeCount || a.name.localeCompare(b.name));

  // People tied on points share a rank.
  const ranked: Array<LeaderboardEntry & { id: string }> = [];
  rows.forEach((r, i) => {
    const rank = i > 0 && rows[i - 1].points === r.points ? ranked[i - 1].rank : i + 1;
    ranked.push({ id: r.id, rank, name: r.name, points: r.points, streak: r.streak, badgeCount: r.badgeCount, isYou: r.id === requesterId });
  });
  const strip = ({ id: _id, ...entry }: LeaderboardEntry & { id: string }): LeaderboardEntry => entry;
  const top = ranked.slice(0, BOARD_SIZE);
  const mine = ranked.find((r) => r.id === requesterId);
  return {
    period,
    weekKey: nowKey,
    entries: top.map(strip),
    you: mine && !top.includes(mine) ? strip(mine) : null,
    totalOptedIn: allTimeRanking().length,
  };
}

/** Numbers for the host of one session. `currentViewers` comes from the live connections. */
export function getSessionStatsFor(sessionId: string, currentViewers: number, now: number = Date.now()): SessionStats {
  const stats = getSessionStats(sessionId);
  const seconds: Record<string, number> = { ...stats.viewerSeconds };
  for (const [key, open] of openPresence) {
    const [sid, uid] = key.split('\u0000');
    if (sid !== sessionId) continue;
    seconds[uid] = (seconds[uid] ?? 0) + Math.max(0, Math.round((now - open.since) / 1000));
  }
  const people = Object.keys(seconds);
  const total = people.reduce((sum, id) => sum + seconds[id], 0);
  const questions = store.state.questions[sessionId] ?? [];
  const polls = store.state.polls[sessionId] ?? [];
  return {
    sessionId,
    peakViewers: store.getModeration(sessionId).peakViewers,
    currentViewers,
    uniqueSignedIn: people.length,
    totalWatchSeconds: total,
    avgWatchSeconds: people.length > 0 ? Math.round(total / people.length) : 0,
    chatMessages: (store.state.messages[sessionId] ?? []).length,
    questionsAsked: questions.length,
    questionsAnswered: questions.filter((q) => q.answered).length,
    pollVotes: polls.reduce((sum, p) => sum + p.options.reduce((s, o) => s + o.voterIds.length, 0), 0),
    reactions: stats.reactions,
    timeline: stats.timeline,
  };
}

export { BADGES };
export type { EngagementMetrics };
