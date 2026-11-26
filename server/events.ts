// Task 16: events (IndabaX day, hackathon). All rules are enforced here, not in the browser.
// Routes are registered from server.ts with registerEventRoutes(); data lives in store.state.eventsData
// (optional, so old data files still load).
import { randomInt, randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { EVENT_LIMITS, type EventRecord, type EventSessionSummary, type EventView } from '../src/shared/events';
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

  void asyncRoute;
  void randomInt;
}
