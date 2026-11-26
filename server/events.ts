// Task 16: events (IndabaX day, hackathon). All rules are enforced here, not in the browser.
// Routes are registered from server.ts with registerEventRoutes(); data lives in store.state.eventsData
// (optional, so old data files still load).
import { randomInt, randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import {
  EVENT_LIMITS,
  JUDGE_CRITERIA,
  TEAM_MAX_MEMBERS,
  type EventRecord,
  type EventSessionSummary,
  type EventView,
  ATTENDANCE_THRESHOLD,
  type CertificateKind,
  type JudgeCriterion,
  type RankedTeam,
  type ResultsView,
  type TeamView,
  type VerifyResult,
} from '../src/shared/events';
import { buildCertificatePdf } from './certificate-pdf';
import { store, type StoredUser } from './store';

// ---------------------------------------------------------------------------------------------
// Stored data

export interface StoredTeam {
  id: string;
  eventId: string;
  name: string;
  idea: string;
  joinCode: string;
  /** Creator first. */
  memberIds: string[];
  createdBy: string;
  repoUrl: string | null;
  summary: string | null;
  demoAt: string | null;
  createdAt: string;
}

export interface StoredScore {
  eventId: string;
  teamId: string;
  judgeId: string;
  idea: number;
  build: number;
  demo: number;
  impact: number;
  comment: string;
  updatedAt: string;
}

export interface StoredCertificate {
  code: string;
  eventId: string;
  userId: string;
  kind: 'ATTENDANCE' | 'WINNER' | 'RUNNER_UP';
  /** Name as printed, kept so the certificate never changes if the profile does. */
  name: string;
  teamName: string | null;
  issuedAt: string;
}

export interface EventsData {
  events: EventRecord[];
  teams: StoredTeam[];
  /** eventId -> judge user ids */
  judges: Record<string, string[]>;
  scores: StoredScore[];
  certificates: StoredCertificate[];
}

export function eventsData(): EventsData {
  const s = store.state;
  s.eventsData ??= { events: [], teams: [], judges: {}, scores: [], certificates: [] };
  // Fields added later stay safe on data written by an earlier build.
  s.eventsData.events ??= [];
  s.eventsData.teams ??= [];
  s.eventsData.judges ??= {};
  s.eventsData.scores ??= [];
  s.eventsData.certificates ??= [];
  return s.eventsData;
}

// ---------------------------------------------------------------------------------------------
// Helpers

export interface EventDeps {
  app: Express;
  requireAuth: RequestHandler;
  /** Allows ADMIN always, plus the roles given. */
  requireRoles: (...roles: StoredUser['role'][]) => RequestHandler;
  /** The signed-in person, or null for a visitor. Never rejects. */
  optionalUser: (req: Request) => StoredUser | null;
  rateLimit: (name: string, max: number, windowMs: number) => RequestHandler;
}

export type AuthedEventRequest = Request & { authUser?: StoredUser };

export function isEventStaff(user: StoredUser | null | undefined): boolean {
  return Boolean(user && (user.role === 'ADMIN' || user.role === 'HOST'));
}

/** An admin may manage every event; a host only the ones they created. */
export function canManageEvent(user: StoredUser | null | undefined, ev: EventRecord): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || (user.role === 'HOST' && ev.createdBy === user.id);
}

function canSeeEvent(user: StoredUser | null, ev: EventRecord): boolean {
  return ev.status === 'PUBLISHED' || canManageEvent(user, ev);
}

export function findEvent(idOrSlug: string): EventRecord | undefined {
  return eventsData().events.find((e) => e.id === idOrSlug || e.slug === idOrSlug);
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'event';
}

function uniqueSlug(title: string): string {
  const base = slugify(title);
  const taken = new Set(eventsData().events.map((e) => e.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${randomUUID().slice(0, 6)}`;
}

/** Public sessions of an event, in the order the host set. Private classes and missing sessions are skipped. */
export function publicSessionsOf(ev: EventRecord) {
  const out = [];
  for (const id of ev.sessionIds) {
    const session = store.state.sessions.find((s) => s.id === id);
    if (session && !session.isPrivateClass) out.push(session);
  }
  return out;
}

function toView(ev: EventRecord, user: StoredUser | null): EventView {
  const sessions: EventSessionSummary[] = publicSessionsOf(ev).map((s) => ({
    id: s.id,
    title: s.title,
    scheduledAt: s.scheduledAt,
    status: s.status,
    mode: s.mode,
    communityName: s.communityName,
    hostName: s.hostName,
  }));
  const { resultsRevealedAt, ...rest } = ev;
  return { ...rest, sessions, canEdit: canManageEvent(user, ev), resultsRevealed: Boolean(resultsRevealedAt) };
}

// ---------------------------------------------------------------------------------------------
// Validation

const isoDate = z
  .string()
  .max(40)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Use a valid date and time.')
  .transform((v) => new Date(v).toISOString());

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      return new URL(v).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Use a link that starts with https://');

const speakerSchema = z.object({
  name: z.string().trim().min(1).max(EVENT_LIMITS.speakerName),
  role: z.string().trim().max(EVENT_LIMITS.speakerRole).default(''),
  bio: z.string().trim().max(EVENT_LIMITS.speakerBio).default(''),
});

const eventFields = {
  title: z.string().trim().min(3).max(EVENT_LIMITS.title),
  description: z.string().trim().max(EVENT_LIMITS.description),
  startsAt: isoDate,
  endsAt: isoDate,
  venue: z.string().trim().max(EVENT_LIMITS.venue),
  coverUrl: z.union([httpsUrl, z.literal('')]).optional(),
  sessionIds: z.array(z.string().min(1).max(100)).max(EVENT_LIMITS.sessions),
  speakers: z.array(speakerSchema).max(EVENT_LIMITS.speakers),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  hackathon: z.boolean(),
};

const createEventSchema = z.object({
  ...eventFields,
  description: eventFields.description.default(''),
  venue: eventFields.venue.default(''),
  sessionIds: eventFields.sessionIds.default([]),
  speakers: eventFields.speakers.default([]),
  status: eventFields.status.default('DRAFT'),
  hackathon: eventFields.hackathon.default(false),
});

const patchEventSchema = z.object(eventFields).partial();

const MAX_EVENT_DAYS = 14;

/** Checks that need the whole event: order of dates, length, and that every session is public. */
function checkEvent(ev: Pick<EventRecord, 'startsAt' | 'endsAt' | 'sessionIds'>): string | null {
  const start = new Date(ev.startsAt).getTime();
  const end = new Date(ev.endsAt).getTime();
  if (end <= start) return 'The event must end after it starts.';
  if (end - start > MAX_EVENT_DAYS * 24 * 3600 * 1000) return `An event can last at most ${MAX_EVENT_DAYS} days.`;
  if (new Set(ev.sessionIds).size !== ev.sessionIds.length) return 'A session is listed twice.';
  for (const id of ev.sessionIds) {
    const session = store.state.sessions.find((s) => s.id === id);
    if (!session) return `Session "${id}" does not exist.`;
    if (session.isPrivateClass) return 'Private classes cannot be part of an event.';
  }
  return null;
}

function zodMessage(error: z.ZodError): string {
  const first = error.issues[0];
  const where = first.path.length ? `${first.path.join('.')}: ` : '';
  return `${where}${first.message}`;
}

function asyncRoute(fn: (req: AuthedEventRequest, res: Response) => void | Promise<void>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthedEventRequest, res)).catch(next);
  };
}

// ---------------------------------------------------------------------------------------------
// Routes

export function registerEventRoutes(deps: EventDeps): void {
  const { app, requireAuth, requireRoles, optionalUser, rateLimit } = deps;
  void rateLimit;

  // Everyone can read published events. A host sees their own drafts, an admin sees all drafts.
  app.get('/api/events', (req, res) => {
    const user = optionalUser(req);
    const list = eventsData()
      .events.filter((e) => canSeeEvent(user, e))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .map((e) => toView(e, user));
    res.json({ events: list });
  });

  app.get('/api/events/:slug', (req, res) => {
    const user = optionalUser(req);
    const ev = findEvent(String(req.params.slug));
    // A draft looks exactly like a missing event to people who may not see it.
    if (!ev || !canSeeEvent(user, ev)) {
      res.status(404).json({ message: 'Event not found.' });
      return;
    }
    res.json({ event: toView(ev, user) });
  });

  app.post('/api/events', requireAuth, requireRoles('HOST'), (req: AuthedEventRequest, res) => {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: zodMessage(parsed.error) });
      return;
    }
    const input = parsed.data;
    const problem = checkEvent(input);
    if (problem) {
      res.status(400).json({ message: problem });
      return;
    }
    const ev: EventRecord = {
      id: `evt-${randomUUID()}`,
      slug: uniqueSlug(input.title),
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      venue: input.venue,
      ...(input.coverUrl ? { coverUrl: input.coverUrl } : {}),
      sessionIds: input.sessionIds,
      speakers: input.speakers,
      createdBy: req.authUser!.id,
      status: input.status,
      hackathon: input.hackathon,
      resultsRevealedAt: null,
    };
    eventsData().events.push(ev);
    store.save();
    res.status(201).json({ event: toView(ev, req.authUser!) });
  });

  app.patch('/api/events/:id', requireAuth, requireRoles('HOST'), (req: AuthedEventRequest, res) => {
    const ev = findEvent(String(req.params.id));
    if (!ev || !canManageEvent(req.authUser, ev)) {
      // A host who does not own the event gets the same answer as for a missing one.
      res.status(ev ? 403 : 404).json({ message: ev ? 'Only the host who made this event, or an admin, can change it.' : 'Event not found.' });
      return;
    }
    const parsed = patchEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: zodMessage(parsed.error) });
      return;
    }
    const patch = parsed.data;
    const merged = { ...ev, ...patch };
    const problem = checkEvent(merged);
    if (problem) {
      res.status(400).json({ message: problem });
      return;
    }
    if (patch.hackathon === false && ev.hackathon && eventsData().teams.some((t) => t.eventId === ev.id)) {
      res.status(409).json({ message: 'Teams already exist, so hackathon mode cannot be switched off.' });
      return;
    }
    if (patch.title !== undefined) ev.title = patch.title;
    if (patch.description !== undefined) ev.description = patch.description;
    if (patch.startsAt !== undefined) ev.startsAt = patch.startsAt;
    if (patch.endsAt !== undefined) ev.endsAt = patch.endsAt;
    if (patch.venue !== undefined) ev.venue = patch.venue;
    if (patch.coverUrl !== undefined) {
      if (patch.coverUrl) ev.coverUrl = patch.coverUrl;
      else delete ev.coverUrl;
    }
    if (patch.sessionIds !== undefined) ev.sessionIds = patch.sessionIds;
    if (patch.speakers !== undefined) ev.speakers = patch.speakers;
    if (patch.status !== undefined) ev.status = patch.status;
    if (patch.hackathon !== undefined) ev.hackathon = patch.hackathon;
    store.save();
    res.json({ event: toView(ev, req.authUser!) });
  });

  registerHackathonRoutes(deps);
  registerCertificateRoutes(deps);
}

// ---------------------------------------------------------------------------------------------
// Step 2: hackathon tools (teams, submissions, judges, scores, reveal)

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O, 0, I or 1: easy to read out loud

function newJoinCode(eventId: string): string {
  const taken = new Set(eventsData().teams.filter((t) => t.eventId === eventId).map((t) => t.joinCode));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
  throw new Error('Could not make a free join code.');
}

function displayName(userId: string): string {
  const u = store.state.users.find((x) => x.id === userId);
  return u ? u.nickname?.trim() || u.fullName : 'Former member';
}

function teamOf(eventId: string, userId: string): StoredTeam | undefined {
  return eventsData().teams.find((t) => t.eventId === eventId && t.memberIds.includes(userId));
}

function isJudgeOf(eventId: string, userId: string): boolean {
  return (eventsData().judges[eventId] ?? []).includes(userId);
}

function teamView(team: StoredTeam, viewer: StoredUser | null, ev: EventRecord): TeamView {
  const isMember = Boolean(viewer && team.memberIds.includes(viewer.id));
  return {
    id: team.id,
    eventId: team.eventId,
    name: team.name,
    idea: team.idea,
    members: team.memberIds.map((id) => ({ userId: id, name: displayName(id), isCreator: id === team.createdBy })),
    repoUrl: team.repoUrl,
    summary: team.summary,
    demoAt: team.demoAt,
    // The code is a secret between team mates and the host.
    joinCode: isMember || canManageEvent(viewer, ev) ? team.joinCode : null,
    isMine: isMember,
    isCreator: Boolean(viewer && team.createdBy === viewer.id),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Teams ranked by the mean of their four criterion averages. Teams nobody scored are left out. Ties share a rank. */
export function computeRanking(
  teams: Array<{ id: string; name: string }>,
  scores: Array<{ teamId: string } & Record<JudgeCriterion, number>>,
): RankedTeam[] {
  const rows: Array<Omit<RankedTeam, 'rank'>> = [];
  for (const team of teams) {
    const mine = scores.filter((x) => x.teamId === team.id);
    if (mine.length === 0) continue;
    const average = {} as Record<JudgeCriterion, number>;
    for (const c of JUDGE_CRITERIA) average[c] = round2(mine.reduce((sum, x) => sum + x[c], 0) / mine.length);
    const total = round2(JUDGE_CRITERIA.reduce((sum, c) => sum + average[c], 0) / JUDGE_CRITERIA.length);
    rows.push({ teamId: team.id, teamName: team.name, average, total, judges: mine.length });
  }
  rows.sort((a, b) => b.total - a.total || a.teamName.localeCompare(b.teamName));
  const ranked: RankedTeam[] = [];
  rows.forEach((row, i) => {
    const rank = i > 0 && rows[i - 1].total === row.total ? ranked[i - 1].rank : i + 1;
    ranked.push({ rank, ...row });
  });
  return ranked;
}

function resultsFor(ev: EventRecord): ResultsView | null {
  if (!ev.resultsRevealedAt) return null;
  const data = eventsData();
  const teams = data.teams.filter((t) => t.eventId === ev.id);
  const scores = data.scores.filter((x) => x.eventId === ev.id);
  return { revealedAt: ev.resultsRevealedAt, ranking: computeRanking(teams, scores) };
}

const teamNameSchema = z.string().trim().min(2).max(40);
const ideaSchema = z.string().trim().min(1).max(300);

const createTeamSchema = z.object({ name: teamNameSchema, idea: ideaSchema });
const joinTeamSchema = z.object({ code: z.string().trim().min(4).max(12) });
const patchTeamSchema = z
  .object({
    name: teamNameSchema,
    idea: ideaSchema,
    repoUrl: z.union([httpsUrl, z.null()]),
    summary: z.union([z.string().trim().min(1).max(400), z.null()]),
  })
  .partial();
const demoSchema = z.object({ demoAt: z.union([isoDate, z.null()]) });
const addJudgeSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });
const scoreSchema = z.object({
  idea: z.number().int().min(1).max(5),
  build: z.number().int().min(1).max(5),
  demo: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).default(''),
});

const MAX_JUDGES = 20;

function registerHackathonRoutes(deps: EventDeps): void {
  const { app, requireAuth, requireRoles, optionalUser, rateLimit } = deps;

  app.use('/api/events/:id/teams/join', rateLimit('team-join', 30, 10 * 60 * 1000));

  /** Finds a published hackathon the person may act on, or answers the request and returns null. */
  function hackathonOr404(req: Request, res: Response, viewer: StoredUser | null): EventRecord | null {
    const ev = findEvent(String(req.params.id));
    if (!ev || !canSeeEvent(viewer, ev) || !ev.hackathon) {
      res.status(404).json({ message: 'Hackathon not found.' });
      return null;
    }
    return ev;
  }

  /** Teams are open from publication until the event ends or results are revealed. */
  function signupOpen(ev: EventRecord, res: Response): boolean {
    if (ev.resultsRevealedAt || Date.now() >= new Date(ev.endsAt).getTime()) {
      res.status(409).json({ message: 'Teams are closed for this hackathon.' });
      return false;
    }
    return true;
  }

  // One call for the whole hackathon panel. What a person sees depends on who they are (see the notes below).
  app.get('/api/events/:id/hackathon', (req, res) => {
    const viewer = optionalUser(req);
    const ev = hackathonOr404(req, res, viewer);
    if (!ev) return;
    const data = eventsData();
    const teams = data.teams.filter((t) => t.eventId === ev.id);
    const myTeam = viewer ? teamOf(ev.id, viewer.id) : undefined;
    const manager = canManageEvent(viewer, ev);
    const judge = Boolean(viewer && isJudgeOf(ev.id, viewer.id));
    const allScores = data.scores.filter((x) => x.eventId === ev.id);

    res.json({
      teams: teams.map((t) => teamView(t, viewer, ev)),
      myTeamId: myTeam?.id ?? null,
      judges: (data.judges[ev.id] ?? []).map((id) => ({ userId: manager ? id : undefined, name: displayName(id) })),
      isJudge: judge,
      canManage: manager,
      signupOpen: !ev.resultsRevealedAt && Date.now() < new Date(ev.endsAt).getTime(),
      resultsRevealed: Boolean(ev.resultsRevealedAt),
      // Public only after the host presses Reveal: ranking and criterion averages. No comments, no judge names.
      results: resultsFor(ev),
      // A judge sees their own scores and comments, nobody else's.
      myScores: judge
        ? allScores.filter((x) => x.judgeId === viewer!.id).map(({ teamId, idea, build, demo, impact, comment }) => ({ teamId, idea, build, demo, impact, comment }))
        : [],
      // The host (and an admin) see everything before the reveal, so they can chase missing scores.
      judging: manager
        ? {
            scores: allScores.map((x) => ({ teamId: x.teamId, judge: displayName(x.judgeId), idea: x.idea, build: x.build, demo: x.demo, impact: x.impact, comment: x.comment })),
            progress: (data.judges[ev.id] ?? []).map((id) => ({ judge: displayName(id), scored: allScores.filter((x) => x.judgeId === id).length, of: teams.filter((t) => !t.memberIds.includes(id)).length })),
          }
        : null,
    });
  });

  app.post('/api/events/:id/teams', requireAuth, (req: AuthedEventRequest, res) => {
    const user = req.authUser!;
    const ev = hackathonOr404(req, res, user);
    if (!ev || !signupOpen(ev, res)) return;
    if (ev.status !== 'PUBLISHED') {
      res.status(409).json({ message: 'Teams open when the event is published.' });
      return;
    }
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: zodMessage(parsed.error) });
      return;
    }
    if (teamOf(ev.id, user.id)) {
      res.status(409).json({ message: 'You are already in a team for this hackathon.' });
      return;
    }
    const data = eventsData();
    if (data.teams.some((t) => t.eventId === ev.id && t.name.toLowerCase() === parsed.data.name.toLowerCase())) {
      res.status(409).json({ message: 'Another team already uses that name.' });
      return;
    }
    const team: StoredTeam = {
      id: `team-${randomUUID()}`,
      eventId: ev.id,
      name: parsed.data.name,
      idea: parsed.data.idea,
      joinCode: newJoinCode(ev.id),
      memberIds: [user.id],
      createdBy: user.id,
      repoUrl: null,
      summary: null,
      demoAt: null,
      createdAt: new Date().toISOString(),
    };
    data.teams.push(team);
    store.save();
    res.status(201).json({ team: teamView(team, user, ev) });
  });

  app.post('/api/events/:id/teams/join', requireAuth, (req: AuthedEventRequest, res) => {
    const user = req.authUser!;
    const ev = hackathonOr404(req, res, user);
    if (!ev || !signupOpen(ev, res)) return;
    const parsed = joinTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Enter the 6-character team code.' });
      return;
    }
    if (teamOf(ev.id, user.id)) {
      res.status(409).json({ message: 'You are already in a team for this hackathon.' });
      return;
    }
    const code = parsed.data.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const team = eventsData().teams.find((t) => t.eventId === ev.id && t.joinCode === code);
    if (!team) {
      res.status(404).json({ message: 'That code does not match a team in this hackathon.' });
      return;
    }
    if (team.memberIds.length >= TEAM_MAX_MEMBERS) {
      res.status(409).json({ message: `That team is full (${TEAM_MAX_MEMBERS} members).` });
      return;
    }
    team.memberIds.push(user.id);
    store.save();
    res.json({ team: teamView(team, user, ev) });
  });

  app.patch('/api/events/:id/teams/:teamId', requireAuth, (req: AuthedEventRequest, res) => {
    const user = req.authUser!;
    const ev = hackathonOr404(req, res, user);
    if (!ev) return;
    const team = eventsData().teams.find((t) => t.id === String(req.params.teamId) && t.eventId === ev.id);
    if (!team || !team.memberIds.includes(user.id)) {
      res.status(team ? 403 : 404).json({ message: team ? 'Only members of this team can change it.' : 'Team not found.' });
      return;
    }
    if (ev.resultsRevealedAt) {
      res.status(409).json({ message: 'Results are out, so teams are locked.' });
      return;
    }
    const parsed = patchTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: zodMessage(parsed.error) });
      return;
    }
    const patch = parsed.data;
    // Renaming and the project idea belong to the creator; anyone in the team can send the submission.
    if ((patch.name !== undefined || patch.idea !== undefined) && team.createdBy !== user.id) {
      res.status(403).json({ message: 'Only the person who created the team can rename it or change the idea.' });
      return;
    }
    if (patch.name !== undefined) {
      const clash = eventsData().teams.some((t) => t.id !== team.id && t.eventId === ev.id && t.name.toLowerCase() === patch.name!.toLowerCase());
      if (clash) {
        res.status(409).json({ message: 'Another team already uses that name.' });
        return;
      }
      team.name = patch.name;
    }
    if (patch.idea !== undefined) team.idea = patch.idea;
    if (patch.repoUrl !== undefined) team.repoUrl = patch.repoUrl;
    if (patch.summary !== undefined) team.summary = patch.summary;
    store.save();
    res.json({ team: teamView(team, user, ev) });
  });

  // The host picks when each team demos.
  app.put('/api/events/:id/teams/:teamId/demo', requireAuth, requireRoles('HOST'), (req: AuthedEventRequest, res) => {
    const ev = hackathonOr404(req, res, req.authUser!);
    if (!ev) return;
    if (!canManageEvent(req.authUser, ev)) {
      res.status(403).json({ message: 'Only the host of this event, or an admin, can set demo times.' });
      return;
    }
    const team = eventsData().teams.find((t) => t.id === String(req.params.teamId) && t.eventId === ev.id);
    const parsed = demoSchema.safeParse(req.body);
    if (!team) {
      res.status(404).json({ message: 'Team not found.' });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ message: zodMessage(parsed.error) });
      return;
    }
    team.demoAt = parsed.data.demoAt;
    store.save();
    res.json({ team: teamView(team, req.authUser!, ev) });
  });

  // Remove a member (creator), or leave (anyone, for themselves).
  app.delete('/api/events/:id/teams/:teamId/members/:userId', requireAuth, (req: AuthedEventRequest, res) => {
    const user = req.authUser!;
    const ev = hackathonOr404(req, res, user);
    if (!ev) return;
    const data = eventsData();
    const team = data.teams.find((t) => t.id === String(req.params.teamId) && t.eventId === ev.id);
    const targetId = String(req.params.userId);
    if (!team || !team.memberIds.includes(targetId)) {
      res.status(404).json({ message: 'That member is not in this team.' });
      return;
    }
    if (ev.resultsRevealedAt) {
      res.status(409).json({ message: 'Results are out, so teams are locked.' });
      return;
    }
    const leaving = targetId === user.id;
    if (!leaving && team.createdBy !== user.id) {
      res.status(403).json({ message: 'Only the team creator can remove another member.' });
      return;
    }
    team.memberIds = team.memberIds.filter((id) => id !== targetId);
    if (team.memberIds.length === 0) {
      data.teams = data.teams.filter((t) => t.id !== team.id);
      data.scores = data.scores.filter((x) => x.teamId !== team.id);
    } else if (team.createdBy === targetId) {
      team.createdBy = team.memberIds[0]; // the next person in the team takes over
    }
    store.save();
    res.json({ ok: true });
  });

  // Judges. The host adds them by the email of an existing account; only names are shown to others.
  app.post('/api/events/:id/judges', requireAuth, requireRoles('HOST'), (req: AuthedEventRequest, res) => {
    const ev = hackathonOr404(req, res, req.authUser!);
    if (!ev) return;
    if (!canManageEvent(req.authUser, ev)) {
      res.status(403).json({ message: 'Only the host of this event, or an admin, can add judges.' });
      return;
    }
    const parsed = addJudgeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Enter the email of a Kabmeet account.' });
      return;
    }
    const target = store.state.users.find((u) => u.email.toLowerCase() === parsed.data.email && u.isActive);
    if (!target) {
      res.status(404).json({ message: 'No Kabmeet account uses that email. Ask them to register first.' });
      return;
    }
    const list = (eventsData().judges[ev.id] ??= []);
    if (list.includes(target.id)) {
      res.status(409).json({ message: `${displayName(target.id)} is already a judge.` });
      return;
    }
    if (list.length >= MAX_JUDGES) {
      res.status(409).json({ message: `At most ${MAX_JUDGES} judges.` });
      return;
    }
    list.push(target.id);
    store.save();
    res.status(201).json({ judge: { userId: target.id, name: displayName(target.id) } });
  });

  app.delete('/api/events/:id/judges/:userId', requireAuth, requireRoles('HOST'), (req: AuthedEventRequest, res) => {
    const ev = hackathonOr404(req, res, req.authUser!);
    if (!ev) return;
    if (!canManageEvent(req.authUser, ev)) {
      res.status(403).json({ message: 'Only the host of this event, or an admin, can remove judges.' });
      return;
    }
    if (ev.resultsRevealedAt) {
      res.status(409).json({ message: 'Results are out, so judges are locked.' });
      return;
    }
    const data = eventsData();
    const id = String(req.params.userId);
    data.judges[ev.id] = (data.judges[ev.id] ?? []).filter((x) => x !== id);
    data.scores = data.scores.filter((x) => !(x.eventId === ev.id && x.judgeId === id));
    store.save();
    res.json({ ok: true });
  });

  // A judge scores one team. Saving again replaces their earlier score for that team.
  app.put('/api/events/:id/scores/:teamId', requireAuth, (req: AuthedEventRequest, res) => {
    const user = req.authUser!;
    const ev = hackathonOr404(req, res, user);
    if (!ev) return;
    if (!isJudgeOf(ev.id, user.id)) {
      res.status(403).json({ message: 'Only judges of this hackathon can score teams.' });
      return;
    }
    if (ev.resultsRevealedAt) {
      res.status(409).json({ message: 'Results are out, so scores are locked.' });
      return;
    }
    const team = eventsData().teams.find((t) => t.id === String(req.params.teamId) && t.eventId === ev.id);
    if (!team) {
      res.status(404).json({ message: 'Team not found.' });
      return;
    }
    if (team.memberIds.includes(user.id)) {
      res.status(403).json({ code: 'OWN_TEAM', message: 'You cannot score your own team.' });
      return;
    }
    const parsed = scoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Give each of Idea, Build, Demo and Impact a whole number from 1 to 5.' });
      return;
    }
    const data = eventsData();
    const now = new Date().toISOString();
    const existing = data.scores.find((x) => x.eventId === ev.id && x.teamId === team.id && x.judgeId === user.id);
    if (existing) Object.assign(existing, parsed.data, { updatedAt: now });
    else data.scores.push({ eventId: ev.id, teamId: team.id, judgeId: user.id, ...parsed.data, updatedAt: now });
    store.save();
    res.json({ ok: true, score: { teamId: team.id, ...parsed.data } });
  });

  // The host reveals the results. There is no way back, so nobody can doubt the order afterwards.
  app.post('/api/events/:id/reveal', requireAuth, requireRoles('HOST'), (req: AuthedEventRequest, res) => {
    const ev = hackathonOr404(req, res, req.authUser!);
    if (!ev) return;
    if (!canManageEvent(req.authUser, ev)) {
      res.status(403).json({ message: 'Only the host of this event, or an admin, can reveal results.' });
      return;
    }
    if (ev.resultsRevealedAt) {
      res.status(409).json({ message: 'Results were already revealed.' });
      return;
    }
    if (!eventsData().scores.some((x) => x.eventId === ev.id)) {
      res.status(409).json({ message: 'No team has been scored yet.' });
      return;
    }
    ev.resultsRevealedAt = new Date().toISOString();
    store.save();
    res.json({ results: resultsFor(ev) });
  });
}

// ---------------------------------------------------------------------------------------------
// Step 3: certificates

const KIND_ORDER: CertificateKind[] = ['WINNER', 'RUNNER_UP', 'ATTENDANCE'];

interface CertificateCheck {
  available: boolean;
  /** Why not, when not available. */
  reason?: 'NOT_ENDED' | 'NOT_ELIGIBLE';
  message: string;
  kind?: CertificateKind;
  teamName?: string | null;
  attended: number;
  total: number;
  needed: number;
}

/** Who gets a certificate: winners and runners-up of a revealed hackathon, and anyone who attended at least half of the event's public sessions. */
export function checkCertificate(ev: EventRecord, userId: string, now: number = Date.now()): CertificateCheck {
  const sessions = publicSessionsOf(ev);
  const total = sessions.length;
  const needed = Math.ceil(total * ATTENDANCE_THRESHOLD);
  const attendedIds = new Set(store.state.engagement?.[userId]?.attendedSessionIds ?? []);
  const attended = sessions.filter((s) => attendedIds.has(s.id)).length;
  const base = { attended, total, needed };

  if (now < new Date(ev.endsAt).getTime()) {
    return { ...base, available: false, reason: 'NOT_ENDED', message: 'Certificates open when the event ends.' };
  }

  if (ev.hackathon && ev.resultsRevealedAt) {
    const team = teamOf(ev.id, userId);
    const results = resultsFor(ev);
    const placed = team && results?.ranking.find((r) => r.teamId === team.id);
    if (team && placed && placed.rank === 1) return { ...base, available: true, kind: 'WINNER', teamName: team.name, message: 'Your team won.' };
    if (team && placed && placed.rank === 2) return { ...base, available: true, kind: 'RUNNER_UP', teamName: team.name, message: 'Your team was runner-up.' };
  }

  if (total > 0 && attended >= needed) {
    return { ...base, available: true, kind: 'ATTENDANCE', teamName: null, message: `You attended ${attended} of ${total} sessions.` };
  }
  return {
    ...base,
    available: false,
    reason: 'NOT_ELIGIBLE',
    message:
      total === 0
        ? 'This event has no public sessions to attend, so there is no attendance certificate.'
        : `You attended ${attended} of ${total} sessions. A certificate needs at least ${needed}.`,
  };
}

function issueCertificate(ev: EventRecord, user: StoredUser, kind: CertificateKind, teamName: string | null): StoredCertificate {
  const data = eventsData();
  const existing = data.certificates.find((c) => c.eventId === ev.id && c.userId === user.id && c.kind === kind);
  if (existing) return existing;
  const year = new Date(ev.endsAt).getUTCFullYear();
  const taken = new Set(data.certificates.map((c) => c.code));
  let code = '';
  for (let attempt = 0; attempt < 100 && (!code || taken.has(code)); attempt += 1) {
    let tail = '';
    for (let i = 0; i < 4; i += 1) tail += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
    code = `KAB-${year}-${tail}`;
  }
  if (taken.has(code)) throw new Error('Could not make a free certificate code.');
  const cert: StoredCertificate = {
    code,
    eventId: ev.id,
    userId: user.id,
    kind,
    name: user.fullName,
    teamName,
    issuedAt: new Date().toISOString(),
  };
  data.certificates.push(cert);
  store.save();
  return cert;
}

const longDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kampala', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

function registerCertificateRoutes(deps: EventDeps): void {
  const { app, requireAuth, rateLimit } = deps;

  // Somebody could guess codes one by one, so slow that down. A code only reveals a name, an event and a date.
  app.use('/api/verify', rateLimit('verify-certificate', 40, 60 * 1000));

  function publishedEnded(req: AuthedEventRequest, res: Response): EventRecord | null {
    const ev = findEvent(String(req.params.id));
    if (!ev || ev.status !== 'PUBLISHED') {
      res.status(404).json({ message: 'Event not found.' });
      return null;
    }
    return ev;
  }

  // What the page shows next to the Download button.
  app.get('/api/events/:id/certificate/status', requireAuth, (req: AuthedEventRequest, res) => {
    const ev = publishedEnded(req, res);
    if (!ev) return;
    const check = checkCertificate(ev, req.authUser!.id);
    const issued = check.kind ? eventsData().certificates.find((c) => c.eventId === ev.id && c.userId === req.authUser!.id && c.kind === check.kind) : undefined;
    res.json({ ...check, code: issued?.code ?? null });
  });

  // The PDF. The first successful request issues the certificate and its code; later requests give the same one.
  app.get('/api/events/:id/certificate', requireAuth, async (req: AuthedEventRequest, res) => {
    const ev = publishedEnded(req, res);
    if (!ev) return;
    const user = req.authUser!;
    const check = checkCertificate(ev, user.id);
    if (!check.available || !check.kind) {
      res.status(check.reason === 'NOT_ENDED' ? 409 : 403).json({ code: check.reason, message: check.message });
      return;
    }
    const cert = issueCertificate(ev, user, check.kind, check.teamName ?? null);
    const origin = (process.env.APP_URL?.trim() || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    try {
      const pdf = await buildCertificatePdf({
        name: cert.name,
        eventTitle: ev.title,
        eventDate: longDate(ev.endsAt),
        venue: ev.venue,
        kind: cert.kind,
        teamName: cert.teamName,
        code: cert.code,
        verifyUrl: `${origin}/verify/${cert.code}`,
        issuedOn: longDate(cert.issuedAt),
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="certificate-${cert.code}.pdf"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(Buffer.from(pdf));
    } catch (err) {
      console.error('[kabmeet] Certificate PDF failed:', err);
      res.status(500).json({ message: 'Could not make the certificate. Please try again.' });
    }
  });

  // Public: anyone with a code can check it. Only name, event, date and kind come back.
  app.get('/api/verify/:code', (req, res) => {
    const code = String(req.params.code).trim().toUpperCase();
    const cert = /^KAB-\d{4}-[A-Z0-9]{4}$/.test(code) ? eventsData().certificates.find((c) => c.code === code) : undefined;
    const ev = cert ? eventsData().events.find((e) => e.id === cert.eventId) : undefined;
    if (!cert || !ev) {
      res.status(404).json({ valid: false, message: 'No certificate matches that code.' });
      return;
    }
    const result: VerifyResult = {
      valid: true,
      code: cert.code,
      name: cert.name,
      eventTitle: ev.title,
      eventDate: ev.endsAt,
      kind: cert.kind,
    };
    res.json(result);
  });
}
