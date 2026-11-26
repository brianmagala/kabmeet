import 'dotenv/config';
import { createServer } from 'node:http';
import path from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import {
  generateToken,
  getAllowedRoutesForRole,
  hashPassword,
  hashToken,
  isStaffOrHost,
  verifyPassword,
} from './server/auth';
import {
  getLeaderboard,
  getSessionStatsFor,
  getSummary,
  setLeaderboardOptIn,
} from './server/engagement';
import { registerEventRoutes } from './server/events';
import {
  clearSessionCookies,
  csrfGuard,
  ensureCsrfCookie,
  sessionTokenFromCookies,
  setSessionCookies,
} from './server/session-cookie';
import { store, type StoredUser } from './server/store';
import { getVideoProvider } from './server/video';
import {
  attachWebSocketServer,
  broadcastToSession,
  canUserAccessSession,
  getLiveViewerCount,
  getRoomSeat,
  isAutoAdmitted,
} from './server/ws';
import type { AuthUser, UserRole } from './src/types/kabmeet';

const PORT = Number(process.env.PORT ?? 3000);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface AuthedRequest extends Request {
  authUser?: StoredUser;
  authTokenHash?: string;
}

function sanitizeUser(u: StoredUser): AuthUser {
  return {
    id: u.id,
    email: u.email,
    universityId: u.universityId,
    fullName: u.fullName,
    nickname: u.nickname ?? null,
    department: u.department,
    avatarUrl: u.avatarUrl ?? null,
    role: u.role,
    createdAt: u.createdAt,
  };
}

/** Bearer header first (tests, scripts), then the httpOnly session cookie (the browser app). */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token.length > 0) return token;
  }
  return sessionTokenFromCookies(req.headers);
}

function resolveAuthUser(req: Request): { user: StoredUser; tokenHash: string } | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const sess = store.state.tokens.find(
    (t) => t.tokenHash === tokenHash && new Date(t.expiresAt) > new Date(),
  );
  if (!sess) return null;
  const user = store.state.users.find((u) => u.id === sess.userId && u.isActive);
  if (!user) return null;
  return { user, tokenHash };
}

function attachOptionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const resolved = resolveAuthUser(req);
  if (resolved) {
    req.authUser = resolved.user;
    req.authTokenHash = resolved.tokenHash;
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const resolved = resolveAuthUser(req);
  if (!resolved) {
    res.status(401).json({ message: 'Please sign in to continue.' });
    return;
  }
  req.authUser = resolved.user;
  req.authTokenHash = resolved.tokenHash;
  next();
}

function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      const resolved = resolveAuthUser(req);
      if (!resolved) {
        res.status(401).json({ message: 'Please sign in to continue.' });
        return;
      }
      req.authUser = resolved.user;
      req.authTokenHash = resolved.tokenHash;
    }
    if (req.authUser.role !== 'ADMIN' && !roles.includes(req.authUser.role)) {
      res.status(403).json({ message: 'Your account role does not allow this action.' });
      return;
    }
    next();
  };
}

function issueUserToken(userId: string): { accessToken: string; expiresAt: string } {
  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  // Drop expired tokens, and keep at most 5 live sign-ins per person (oldest go first).
  // The old global cap of 200 signed out other users once more than 200 people were online.
  const live = store.state.tokens.filter((t) => new Date(t.expiresAt) > new Date());
  const mine = live.filter((t) => t.userId === userId).slice(-4);
  const others = live.filter((t) => t.userId !== userId);
  store.state.tokens = [...others, ...mine];
  store.state.tokens.push({ tokenHash, userId, expiresAt });
  store.save();
  return { accessToken: raw, expiresAt };
}

function safeCompareString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// --- Basic protection: rate limits, one-time admin setup code, security headers ---
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(name: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || entry.resetAt < now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' });
      return;
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.resetAt < now) attempts.delete(key);
}, 10 * 60 * 1000).unref();

// The first admin must prove they control the server. Set ADMIN_SETUP_CODE in .env,
// or read the one-time code printed in the server console on first start.
let adminSetupCode: string | null = null;
function getAdminSetupCode(): string {
  if (!adminSetupCode) {
    adminSetupCode = process.env.ADMIN_SETUP_CODE?.trim() || randomBytes(4).toString('hex');
  }
  return adminSetupCode;
}

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
  next();
}

const registerSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  fullName: z.string().trim().min(2).max(100),
  universityId: z.string().trim().min(3).max(40).optional(),
  department: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(128),
});

const claimAdminSchema = z.object({
  email: z.string().trim().email().toLowerCase().default('admin@ai.kab.ac.ug'),
  fullName: z.string().trim().min(2).max(100).default('Kabmeet Admin'),
  password: z.string().min(8).max(128),
  setupCode: z.string().trim().min(4).max(64),
});

const createSessionSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(600),
  communitySlug: z.string().trim().min(2),
  mode: z.enum(['WATCH', 'ROOM']),
  contentType: z
    .enum(['ML_AI', 'CODING_JAM', 'CLOUD_INFRA', 'COMMUNITY_TALK', 'CLASS_SEMINAR'])
    .optional(),
  startNow: z.boolean().default(false),
  scheduledAt: z.string().optional(),
});

const createClassSchema = z.object({
  courseCode: z.string().trim().min(2).max(24),
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(8).max(500),
  communitySlug: z.string().trim().min(2).default('kab-ai'),
  allowedStudents: z.array(z.string().trim().min(2)).min(1),
});

const createPostSchema = z.object({
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(6).max(800),
});

const updateRoleSchema = z.object({
  role: z.enum(['VISITOR', 'MEMBER', 'SPEAKER', 'MODERATOR', 'HOST', 'LECTURER', 'ADMIN']),
});

const createCommunitySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().min(10).max(320),
  accentColor: z.enum(['deep-green', 'kab-blue']).default('deep-green'),
});

const createReportSchema = z.object({
  sessionId: z.string().trim().min(2),
  reason: z.string().trim().min(5).max(320),
});

const safeAvatarSchema = z
  .string()
  .trim()
  .max(450_000, 'Profile picture must be under 350 KB after compression.')
  .refine(
    (val) =>
      val === '' ||
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(val) ||
      /^https:\/\/[^\s]+$/.test(val),
    'Please upload a valid PNG, JPEG, WebP, or GIF image.',
  );

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(100),
  nickname: z.string().trim().max(40, 'Nickname must be 40 characters or fewer.').nullable().optional(),
  department: z.string().trim().max(80).nullable().optional(),
  avatarUrl: safeAvatarSchema.nullable().optional(),
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', csrfGuard);
  app.use('/api/auth/login', rateLimit('login', 10, 15 * 60 * 1000));
  app.use('/api/auth/register', rateLimit('register', 10, 60 * 60 * 1000));
  app.use('/api/auth/claim-admin', rateLimit('claim', 5, 15 * 60 * 1000));
  // A whole class can share one campus IP, so this limit is generous.
  app.use('/api/sessions/:id/video-token', rateLimit('video-token', 240, 60 * 1000));

  const httpServer = createServer(app);
  attachWebSocketServer(httpServer);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'kabmeet' });
  });

  // --- Phase 1: Auth & Roles ---
  app.get('/api/auth/session', attachOptionalAuth, (req: AuthedRequest, res) => {
    const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const hasAdminUser = store.state.users.some((u) => u.role === 'ADMIN' && u.passwordHash !== null);
    const adminConfigured = envPasscodeSet || store.state.adminClaimed || hasAdminUser;

    if (!req.authUser) {
      // A cookie that no longer matches a live sign-in is dropped so the browser stops sending it.
      if (sessionTokenFromCookies(req.headers)) clearSessionCookies(req, res);
      res.json({
        authenticated: false,
        role: 'VISITOR',
        user: null,
        allowedRoutes: getAllowedRoutesForRole('VISITOR'),
        adminConfigured,
      });
      return;
    }

    ensureCsrfCookie(req, res, new Date(Date.now() + SESSION_TTL_MS).toISOString());
    res.json({
      authenticated: true,
      role: req.authUser.role,
      user: sanitizeUser(req.authUser),
      allowedRoutes: getAllowedRoutesForRole(req.authUser.role),
      adminConfigured,
    });
  });

  app.post('/api/auth/claim-admin', async (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      res.status(403).json({
        message: 'Admin sign-in is configured via environment secret. Use the Sign In form.',
      });
      return;
    }
    if (store.state.adminClaimed || store.state.users.some((u) => u.role === 'ADMIN')) {
      res.status(409).json({ message: 'Admin account has already been claimed.' });
      return;
    }
    const parsed = claimAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Please provide a valid email, name, setup code, and 8+ character password.' });
      return;
    }
    if (!safeCompareString(parsed.data.setupCode, getAdminSetupCode())) {
      res.status(403).json({ message: 'That setup code is not correct. Check the server console or ADMIN_SETUP_CODE.' });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const adminUser: StoredUser = {
      id: `usr-admin-${randomUUID()}`,
      email: parsed.data.email,
      universityId: 'KAB/ADMIN/001',
      fullName: parsed.data.fullName,
      department: 'Kabale University AI Lab',
      role: 'ADMIN',
      passwordHash,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    store.state.users.unshift(adminUser);
    store.state.adminClaimed = true;
    store.save();

    const { accessToken, expiresAt } = issueUserToken(adminUser.id);
    setSessionCookies(req, res, accessToken, expiresAt);
    res.status(201).json({
      user: sanitizeUser(adminUser),
      accessToken,
      expiresAt,
      allowedRoutes: getAllowedRoutesForRole(adminUser.role),
    });
  });

  app.post('/api/auth/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Please enter a valid name, email, and 8+ character password.' });
      return;
    }

    const existing = store.state.users.find(
      (u) =>
        u.email === parsed.data.email ||
        (parsed.data.universityId && u.universityId === parsed.data.universityId),
    );
    if (existing) {
      res.status(409).json({ message: 'An account with that email or university ID already exists.' });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const created: StoredUser = {
      id: `usr-${randomUUID()}`,
      email: parsed.data.email,
      universityId: parsed.data.universityId ?? null,
      fullName: parsed.data.fullName,
      department: parsed.data.department ?? 'Kabale University',
      role: 'MEMBER', // Forced server-side
      passwordHash,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    store.state.users.push(created);
    store.save();

    const { accessToken, expiresAt } = issueUserToken(created.id);
    setSessionCookies(req, res, accessToken, expiresAt);
    res.status(201).json({
      user: sanitizeUser(created),
      accessToken,
      expiresAt,
      allowedRoutes: getAllowedRoutesForRole(created.role),
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Please enter your email and password.' });
      return;
    }

    const envAdminPass = process.env.ADMIN_PASSCODE?.trim();
    let user = store.state.users.find((u) => u.email === parsed.data.email && u.isActive);

    if (envAdminPass && parsed.data.email === 'admin@ai.kab.ac.ug') {
      if (!safeCompareString(parsed.data.password, envAdminPass)) {
        res.status(401).json({ message: 'Invalid email or password.' });
        return;
      }
      if (!user) {
        user = {
          id: 'usr-admin-env',
          email: 'admin@ai.kab.ac.ug',
          universityId: 'KAB/ADMIN/001',
          fullName: 'Kabmeet Admin',
          department: 'Kabale University AI Lab',
          role: 'ADMIN',
          passwordHash: null,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        store.state.users.unshift(user);
        store.save();
      }
      const { accessToken, expiresAt } = issueUserToken(user.id);
      setSessionCookies(req, res, accessToken, expiresAt);
      res.json({
        user: sanitizeUser(user),
        accessToken,
        expiresAt,
        allowedRoutes: getAllowedRoutesForRole(user.role),
      });
      return;
    }

    if (!user || !user.passwordHash) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const { accessToken, expiresAt } = issueUserToken(user.id);
    setSessionCookies(req, res, accessToken, expiresAt);
    res.json({
      user: sanitizeUser(user),
      accessToken,
      expiresAt,
      allowedRoutes: getAllowedRoutesForRole(user.role),
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    store.state.tokens = store.state.tokens.filter((t) => t.tokenHash !== req.authTokenHash);
    store.save();
    clearSessionCookies(req, res);
    res.json({ ok: true });
  });

  // --- Phase 2: Discover & Communities ---
  app.get('/api/communities', attachOptionalAuth, (req: AuthedRequest, res) => {
    const uid = req.authUser?.id;
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const list = store.state.communities
      .filter((c) =>
        q
          ? c.name.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q)
          : true,
      )
      .map((c) => {
        const followers = store.state.communityFollows[c.slug] ?? [];
        return {
          ...c,
          memberCount: c.memberCount + followers.length,
          isFollowing: uid ? followers.includes(uid) : false,
        };
      });
    res.json({ communities: list });
  });

  app.get('/api/communities/:slug', attachOptionalAuth, (req: AuthedRequest, res) => {
    const slug = String(req.params.slug);
    const community = store.state.communities.find((c) => c.slug === slug);
    if (!community) {
      res.status(404).json({ message: 'Community not found.' });
      return;
    }
    const uid = req.authUser?.id;
    const followers = store.state.communityFollows[slug] ?? [];
    const sessions = store.state.sessions
      .filter((s) => s.communitySlug === slug && !s.isPrivateClass)
      .map((s) => ({
        ...s,
        reminded: uid ? (store.state.reminders[s.id] ?? []).includes(uid) : false,
      }));
    const posts = store.state.posts.filter((p) => p.communitySlug === slug);

    res.json({
      community: {
        ...community,
        memberCount: community.memberCount + followers.length,
        isFollowing: uid ? followers.includes(uid) : false,
      },
      sessions,
      posts,
    });
  });

  app.post('/api/communities/:slug/follow', requireAuth, (req: AuthedRequest, res) => {
    const slug = String(req.params.slug);
    const community = store.state.communities.find((c) => c.slug === slug);
    if (!community) {
      res.status(404).json({ message: 'Community not found.' });
      return;
    }
    if (!store.state.communityFollows[slug]) store.state.communityFollows[slug] = [];
    const uid = req.authUser!.id;
    const list = store.state.communityFollows[slug];
    const idx = list.indexOf(uid);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(uid);
    }
    store.save();
    res.json({
      isFollowing: idx < 0,
      memberCount: community.memberCount + list.length,
    });
  });

  app.post(
    '/api/communities/:slug/posts',
    requireRoles('HOST', 'MODERATOR', 'LECTURER', 'ADMIN'),
    (req: AuthedRequest, res) => {
      const slug = String(req.params.slug);
      const community = store.state.communities.find((c) => c.slug === slug);
      if (!community) {
        res.status(404).json({ message: 'Community not found.' });
        return;
      }
      const parsed = createPostSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Please enter a post title and message.' });
        return;
      }
      const post = {
        id: `post-${Date.now()}`,
        communitySlug: slug,
        authorName: req.authUser!.fullName,
        authorRole: req.authUser!.role,
        title: parsed.data.title,
        body: parsed.data.body,
        createdAt: new Date().toISOString(),
      };
      store.state.posts.unshift(post);
      store.save();
      res.status(201).json({ post });
    },
  );

  app.get('/api/sessions', attachOptionalAuth, (req: AuthedRequest, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const community = String(req.query.community ?? '').trim();
    const status = String(req.query.status ?? '').trim().toUpperCase();
    const uid = req.authUser?.id;

    const list = store.state.sessions
      .filter((s) => !s.isPrivateClass)
      .filter((s) => (community ? s.communitySlug === community : true))
      .filter((s) => (status && ['LIVE', 'UPCOMING', 'REPLAY'].includes(status) ? s.status === status : true))
      .filter((s) =>
        q
          ? s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.communityName.toLowerCase().includes(q) ||
            s.hostName.toLowerCase().includes(q)
          : true,
      )
      .map((s) => {
        const hostUser = store.state.users.find((u) => u.id === s.hostId);
        const reminderCount = (store.state.reminders[s.id] ?? []).length;
        const qaCount = (store.state.questions[s.id] ?? []).length;
        const attendeeCount =
          s.status === 'LIVE'
            ? s.viewerCount
            : s.status === 'UPCOMING'
              ? reminderCount
              : s.peakViewers;
        return {
          ...s,
          hostAvatarUrl: hostUser?.avatarUrl ?? null,
          attendeeCount,
          hasRecording: Boolean(s.hasRecording || s.status === 'REPLAY' || s.replayDurationSec),
          isInteractive: Boolean(s.isInteractive || s.mode === 'ROOM' || s.mode === 'CLASS'),
          hasQa: Boolean(s.hasQa || qaCount > 0),
          reminded: uid ? (store.state.reminders[s.id] ?? []).includes(uid) : false,
        };
      });

    res.json({ sessions: list });
  });

  app.get('/api/sessions/:id', attachOptionalAuth, (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const session = store.state.sessions.find((s) => s.id === id);
    if (!session) {
      res.status(404).json({ message: 'Session not found.' });
      return;
    }
    if (!canUserAccessSession(id, req.authUser ?? null)) {
      res.status(403).json({
        message: 'This virtual class is private. Only enrolled students and the lecturer can join.',
      });
      return;
    }
    const uid = req.authUser?.id;
    const hostUser = store.state.users.find((u) => u.id === session.hostId);
    const reminderCount = (store.state.reminders[id] ?? []).length;
    const qaCount = (store.state.questions[id] ?? []).length;
    res.json({
      session: {
        ...session,
        hostAvatarUrl: hostUser?.avatarUrl ?? null,
        attendeeCount:
          session.status === 'LIVE'
            ? session.viewerCount
            : session.status === 'UPCOMING'
              ? reminderCount
              : session.peakViewers,
        hasRecording: Boolean(
          session.hasRecording || session.status === 'REPLAY' || session.replayDurationSec,
        ),
        isInteractive: Boolean(
          session.isInteractive || session.mode === 'ROOM' || session.mode === 'CLASS',
        ),
        hasQa: Boolean(session.hasQa || qaCount > 0),
        canJoin: true,
        reminded: uid ? (store.state.reminders[id] ?? []).includes(uid) : false,
      },
    });
  });

  app.post(
    '/api/sessions',
    requireRoles('HOST', 'LECTURER', 'ADMIN'),
    (req: AuthedRequest, res) => {
      const parsed = createSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Please provide a valid session title, community, and description.' });
        return;
      }
      const community = store.state.communities.find((c) => c.slug === parsed.data.communitySlug);
      if (!community) {
        res.status(404).json({ message: 'Selected community was not found.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const defaultUpcomingIso = new Date(Date.now() + 3600_000).toISOString();
      const thumbByClub: Record<string, string> = {
        indabax: '/src/assets/images/session_ml_python_1795385728974.jpg',
        'kab-ai': '/src/assets/images/session_git_workshop_1795385728390.jpg',
        'aws-cloud-club': '/src/assets/images/session_cloud_lab_1795385729506.jpg',
      };

      const created = {
        id: `sess-${Date.now()}`,
        title: parsed.data.title,
        description: parsed.data.description,
        communitySlug: community.slug,
        communityName: community.name,
        hostId: req.authUser!.id,
        hostName: req.authUser!.fullName,
        status: parsed.data.startNow ? ('LIVE' as const) : ('UPCOMING' as const),
        mode: parsed.data.mode,
        ...(parsed.data.contentType ? { contentType: parsed.data.contentType } : {}),
        scheduledAt:
          parsed.data.scheduledAt || (parsed.data.startNow ? nowIso : defaultUpcomingIso),
        startedAt: parsed.data.startNow ? nowIso : null,
        thumbnailUrl: thumbByClub[community.slug] ?? '/src/assets/images/hero_indabax_campus_1795385728289.jpg',
        viewerCount: 0,
        peakViewers: 0,
        isPrivateClass: false,
        courseCode: null,
        allowedStudents: [],
      };
      store.state.sessions.unshift(created);
      store.save();
      res.status(201).json({
        session: {
          ...created,
          hostAvatarUrl: req.authUser!.avatarUrl ?? null,
          attendeeCount: 0,
        },
      });
    },
  );

  // Join token for the video room. The server decides who may send video and sound;
  // the browser only receives a token that says so.
  app.post('/api/sessions/:id/video-token', requireAuth, async (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const sessionId = String(req.params.id);
    const session = store.state.sessions.find((s) => s.id === sessionId);
    if (!session) {
      res.status(404).json({ message: 'Session not found.' });
      return;
    }
    if (!canUserAccessSession(sessionId, user)) {
      res.status(403).json({
        message: 'This virtual class is private. Only enrolled students and the lecturer can join.',
      });
      return;
    }

    const video = getVideoProvider();
    if (!video.isConfigured()) {
      // Not an error: the room still works for chat, hands and the workspace.
      res.json({ configured: false, message: 'Video is not configured on this server.' });
      return;
    }
    if (store.getModeration(sessionId).endedForAll) {
      res.status(409).json({ message: 'This session has ended.' });
      return;
    }

    // People in the waiting room get no video until the host lets them in.
    const seat = getRoomSeat(sessionId, user.id);
    if (seat?.state === 'waiting') {
      res.status(403).json({ code: 'WAITING', message: 'The host has not let you in yet.' });
      return;
    }
    if (!seat && !isAutoAdmitted(user, session)) {
      res.status(403).json({ code: 'NOT_IN_ROOM', message: 'Join the room first, then your video will connect.' });
      return;
    }

    // Hosts and speakers may publish. A member may publish only after the host approves them.
    const admitted = seat?.state === 'admitted' ? seat : null;
    const canPublish = admitted ? admitted.isSpeaker : isStaffOrHost(user.role) || user.role === 'SPEAKER';
    const canUseMicrophone = !(admitted && admitted.mutedByHost);

    try {
      const issued = await video.createRoomToken({
        sessionId,
        userId: user.id,
        displayName: user.nickname?.trim() || user.fullName,
        canPublish,
        canUseMicrophone,
      });
      res.json({
        configured: true,
        url: issued.url,
        token: issued.token,
        expiresAt: issued.expiresAt,
        identity: user.id,
        canPublish,
      });
    } catch (err) {
      console.error('[kabmeet] Video: could not create a join token:', err);
      res.status(502).json({ message: 'Video is not available right now. Chat still works.' });
    }
  });

  app.post('/api/sessions/:id/remind', requireAuth, (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const session = store.state.sessions.find((s) => s.id === id);
    if (!session) {
      res.status(404).json({ message: 'Session not found.' });
      return;
    }
    if (!store.state.reminders[id]) store.state.reminders[id] = [];
    const uid = req.authUser!.id;
    const list = store.state.reminders[id];
    const idx = list.indexOf(uid);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(uid);
    }
    store.save();
    res.json({ reminded: idx < 0, attendeeCount: list.length });
  });

  app.patch(
    '/api/sessions/:id/status',
    requireRoles('HOST', 'LECTURER', 'ADMIN'),
    (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const session = store.state.sessions.find((s) => s.id === id);
      if (!session) {
        res.status(404).json({ message: 'Session not found.' });
        return;
      }
      if (req.authUser!.role !== 'ADMIN' && session.hostId !== req.authUser!.id) {
        res.status(403).json({ message: 'Only the session host or an admin can change session status.' });
        return;
      }
      const nextStatus = req.body?.status;
      if (!['LIVE', 'UPCOMING', 'REPLAY'].includes(nextStatus)) {
        res.status(400).json({ message: 'Invalid status.' });
        return;
      }
      session.status = nextStatus;
      if (nextStatus === 'LIVE' && !session.startedAt) {
        session.startedAt = new Date().toISOString();
      }
      store.save();
      broadcastToSession(id, 'session:status', { status: nextStatus });
      res.json({ session });
    },
  );

  // --- Phase 5: Virtual Classes & Attendance ---
  app.get('/api/classes', attachOptionalAuth, (req: AuthedRequest, res) => {
    const user = req.authUser ?? null;
    const classes = store.state.sessions
      .filter((s) => s.isPrivateClass)
      .map((s) => {
        const canJoin = canUserAccessSession(s.id, user);
        const isManager = Boolean(user && (user.role === 'ADMIN' || user.id === s.hostId));
        return {
          ...s,
          // Never expose full student allow-list to unauthorized callers
          allowedStudents: isManager ? s.allowedStudents : [],
          canJoin,
          attendanceCount: isManager
            ? store.state.attendance.filter((a) => a.classId === s.id).length
            : undefined,
        };
      });
    res.json({ classes });
  });

  app.post(
    '/api/classes',
    requireRoles('LECTURER', 'ADMIN'),
    (req: AuthedRequest, res) => {
      const parsed = createClassSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: 'Please provide course code, class title, description, and at least one student email or ID.',
        });
        return;
      }
      const community = store.state.communities.find((c) => c.slug === parsed.data.communitySlug);
      const created = {
        id: `class-${Date.now()}`,
        title: `${parsed.data.courseCode} — ${parsed.data.title}`,
        description: parsed.data.description,
        communitySlug: community?.slug ?? 'kab-ai',
        communityName: community?.name ?? 'KAB AI Club',
        hostId: req.authUser!.id,
        hostName: req.authUser!.fullName,
        status: 'LIVE' as const,
        mode: 'CLASS' as const,
        scheduledAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        thumbnailUrl: '/src/assets/images/hero_indabax_campus_1795385728289.jpg',
        viewerCount: 0,
        peakViewers: 0,
        isPrivateClass: true,
        courseCode: parsed.data.courseCode,
        allowedStudents: parsed.data.allowedStudents,
      };
      store.state.sessions.unshift(created);
      store.save();
      res.status(201).json({ classSession: { ...created, canJoin: true } });
    },
  );

  app.get(
    '/api/classes/:id/attendance',
    requireRoles('LECTURER', 'ADMIN'),
    (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const classSession = store.state.sessions.find((s) => s.id === id && s.isPrivateClass);
      if (!classSession) {
        res.status(404).json({ message: 'Virtual class not found.' });
        return;
      }
      if (req.authUser!.role !== 'ADMIN' && classSession.hostId !== req.authUser!.id) {
        res.status(403).json({ message: 'Only the class lecturer or admin can inspect attendance.' });
        return;
      }
      const records = store.state.attendance.filter((a) => a.classId === id);
      res.json({ records });
    },
  );

  app.post('/api/classes/:id/attendance/ping', requireAuth, (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const classSession = store.state.sessions.find((s) => s.id === id && s.isPrivateClass);
    if (!classSession) {
      res.status(404).json({ message: 'Virtual class not found.' });
      return;
    }
    if (!canUserAccessSession(id, req.authUser!)) {
      res.status(403).json({ message: 'You are not enrolled in this private virtual class.' });
      return;
    }

    const user = req.authUser!;
    const nowIso = new Date().toISOString();
    let rec = store.state.attendance.find((a) => a.classId === id && a.userId === user.id);
    if (!rec) {
      rec = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        classId: id,
        userId: user.id,
        universityId: user.universityId ?? 'N/A',
        fullName: user.fullName,
        email: user.email,
        joinedAt: nowIso,
        lastSeenAt: nowIso,
        durationSeconds: 30,
      };
      store.state.attendance.push(rec);
    } else {
      const deltaSec = Math.max(
        10,
        Math.min(120, Math.round((Date.now() - new Date(rec.lastSeenAt).getTime()) / 1000)),
      );
      rec.lastSeenAt = nowIso;
      rec.durationSeconds += deltaSec;
    }
    store.save();
    res.json({ record: rec });
  });

  app.get(
    '/api/classes/:id/attendance.csv',
    requireRoles('LECTURER', 'ADMIN'),
    (req: AuthedRequest, res) => {
      const id = String(req.params.id);
      const classSession = store.state.sessions.find((s) => s.id === id && s.isPrivateClass);
      if (!classSession) {
        res.status(404).json({ message: 'Virtual class not found.' });
        return;
      }
      if (req.authUser!.role !== 'ADMIN' && classSession.hostId !== req.authUser!.id) {
        res.status(403).json({ message: 'Only the class lecturer or admin can export attendance.' });
        return;
      }

      const records = store.state.attendance.filter((a) => a.classId === id);
      const header = ['University ID', 'Full Name', 'Email', 'Joined At', 'Last Active', 'Duration (min)'];
      const rows = records.map((r) => [
        escapeCsvCell(r.universityId),
        escapeCsvCell(r.fullName),
        escapeCsvCell(r.email),
        escapeCsvCell(r.joinedAt),
        escapeCsvCell(r.lastSeenAt),
        escapeCsvCell((r.durationSeconds / 60).toFixed(1)),
      ]);
      const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${(classSession.courseCode ?? 'class').replace(/[^a-zA-Z0-9_-]/g, '_')}_attendance.csv"`,
      );
      res.send(csv);
    },
  );

  // --- Phase 7: Profile Dashboard, Reports & Admin ---
  app.get('/api/profile/dashboard', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const myFollowedSlugs = Object.entries(store.state.communityFollows)
      .filter(([, ids]) => ids.includes(user.id))
      .map(([slug]) => slug);
    const myCommunities = store.state.communities.filter((c) => myFollowedSlugs.includes(c.slug));

    const mySessions = store.state.sessions.filter(
      (s) =>
        s.hostId === user.id ||
        (store.state.reminders[s.id] ?? []).includes(user.id),
    );
    const myAttendance = store.state.attendance
      .filter((a) => a.userId === user.id)
      .map((a) => {
        const cls = store.state.sessions.find((s) => s.id === a.classId);
        return {
          ...a,
          classTitle: cls?.title ?? a.classId,
        };
      });

    res.json({
      user: sanitizeUser(user),
      myCommunities,
      mySessions,
      myAttendance,
    });
  });

  app.patch('/api/profile', requireAuth, (req: AuthedRequest, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message ?? 'Invalid profile details.';
      res.status(400).json({ message: firstErr });
      return;
    }

    const user = req.authUser!;
    user.fullName = parsed.data.fullName;
    if (parsed.data.nickname !== undefined) {
      user.nickname = parsed.data.nickname && parsed.data.nickname.length > 0 ? parsed.data.nickname : null;
    }
    if (parsed.data.department !== undefined) {
      user.department =
        parsed.data.department && parsed.data.department.length > 0 ? parsed.data.department : null;
    }
    if (parsed.data.avatarUrl !== undefined) {
      user.avatarUrl =
        parsed.data.avatarUrl && parsed.data.avatarUrl.length > 0 ? parsed.data.avatarUrl : null;
    }

    // Keep any existing session hostName synced if user hosts sessions
    for (const s of store.state.sessions) {
      if (s.hostId === user.id) {
        s.hostName = user.fullName;
      }
    }

    store.save();
    res.json({ user: sanitizeUser(user) });
  });

  // --- Task 16: events, hackathon and certificates (server/events.ts) ---
  registerEventRoutes({
    app,
    requireAuth,
    requireRoles,
    optionalUser: (req) => resolveAuthUser(req)?.user ?? null,
    rateLimit,
  });

  // --- Task 14: engagement (badges, streaks, leaderboard, host stats) ---
  app.get('/api/engagement/me', requireAuth, (req: AuthedRequest, res) => {
    const summary = getSummary(req.authUser!);
    store.save(); // getSummary can quietly award a badge that depends on hosted sessions
    res.json({ engagement: summary });
  });

  const engagementPrefsSchema = z.object({ leaderboardOptIn: z.boolean() });
  app.patch('/api/engagement/me', requireAuth, (req: AuthedRequest, res) => {
    const parsed = engagementPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Send leaderboardOptIn as true or false.' });
      return;
    }
    setLeaderboardOptIn(req.authUser!.id, parsed.data.leaderboardOptIn);
    store.save();
    res.json({ engagement: getSummary(req.authUser!) });
  });

  app.get('/api/leaderboard', requireAuth, (req: AuthedRequest, res) => {
    const period = req.query.period === 'all' ? 'all' : 'week';
    res.json(getLeaderboard(period, req.authUser!.id));
  });

  app.get('/api/sessions/:id/stats', requireAuth, (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const session = store.state.sessions.find((s) => s.id === id);
    if (!session) {
      res.status(404).json({ message: 'Session not found.' });
      return;
    }
    const user = req.authUser!;
    const allowed = user.role === 'ADMIN' || user.role === 'LECTURER' || user.id === session.hostId;
    if (!allowed) {
      res.status(403).json({ message: 'Only the session host, a lecturer or an admin can see these numbers.' });
      return;
    }
    res.json({ stats: getSessionStatsFor(id, getLiveViewerCount(id)) });
  });

  app.post('/api/reports', requireAuth, (req: AuthedRequest, res) => {
    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Please describe the issue you are reporting.' });
      return;
    }
    const sess = store.state.sessions.find((s) => s.id === parsed.data.sessionId);
    const report = {
      id: `rep-${Date.now()}`,
      sessionId: parsed.data.sessionId,
      sessionTitle: sess?.title ?? 'Session',
      reporterName: req.authUser!.fullName,
      reason: parsed.data.reason,
      status: 'OPEN' as const,
      createdAt: new Date().toISOString(),
    };
    store.state.reports.unshift(report);
    store.save();
    res.status(201).json({ report });
  });

  app.get('/api/admin/overview', requireRoles('ADMIN'), (_req, res) => {
    res.json({
      users: store.state.users.map(sanitizeUser),
      communities: store.state.communities,
      reports: store.state.reports,
      roleAuditLog: store.state.roleAuditLog,
    });
  });

  app.patch('/api/admin/users/:id/role', requireRoles('ADMIN'), (req: AuthedRequest, res) => {
    const targetId = String(req.params.id);
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid role selected.' });
      return;
    }
    const target = store.state.users.find((u) => u.id === targetId);
    if (!target) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    if (target.id === req.authUser!.id && parsed.data.role !== 'ADMIN') {
      res.status(400).json({ message: 'You cannot remove your own ADMIN role.' });
      return;
    }
    const previousRole = target.role;
    target.role = parsed.data.role;
    store.state.roleAuditLog.unshift({
      id: `audit-${Date.now()}`,
      targetName: target.fullName,
      actorName: req.authUser!.fullName,
      previousRole,
      newRole: parsed.data.role,
      createdAt: new Date().toISOString(),
    });
    store.save();
    res.json({ user: sanitizeUser(target) });
  });

  app.post('/api/admin/communities', requireRoles('ADMIN'), (req, res) => {
    const parsed = createCommunitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Please provide a valid name, lowercase slug, and description.' });
      return;
    }
    if (store.state.communities.some((c) => c.slug === parsed.data.slug)) {
      res.status(409).json({ message: 'A community with this slug already exists.' });
      return;
    }
    const created = {
      id: `com-${Date.now()}`,
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      accentColor: parsed.data.accentColor,
      memberCount: 1,
    };
    store.state.communities.push(created);
    store.save();
    res.status(201).json({ community: created });
  });

  app.patch('/api/admin/reports/:id', requireRoles('ADMIN', 'MODERATOR'), (req, res) => {
    const report = store.state.reports.find((r) => r.id === String(req.params.id));
    if (!report) {
      res.status(404).json({ message: 'Report not found.' });
      return;
    }
    const status = req.body?.status;
    if (!['RESOLVED', 'DISMISSED', 'OPEN'].includes(status)) {
      res.status(400).json({ message: 'Invalid report status.' });
      return;
    }
    report.status = status;
    store.save();
    res.json({ report });
  });

  const safeLinkSchema = z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((val) => /^https?:\/\//i.test(val) || val.startsWith('/'), {
      message: 'URLs must start with https://, http://, or /',
    });

  const siteFooterSchema = z.object({
    tagline: z.string().trim().min(2).max(220),
    docsLabel: z.string().trim().min(1).max(60),
    docsUrl: safeLinkSchema,
    githubLabel: z.string().trim().min(1).max(60),
    githubUrl: safeLinkSchema,
    contactEmail: z.string().trim().email().max(120),
    contactPhone: z.string().trim().min(3).max(40),
    campusLocation: z.string().trim().min(2).max(120),
  });

  app.get('/api/site-footer', (_req, res) => {
    res.json({ footer: store.state.siteFooter });
  });

  app.patch('/api/admin/site-footer', requireRoles('ADMIN'), (req, res) => {
    const parsed = siteFooterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message:
          parsed.error.issues[0]?.message ||
          'Please check the footer links, email, and contact fields.',
      });
      return;
    }
    store.state.siteFooter = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };
    store.save();
    res.json({ footer: store.state.siteFooter });
  });

  // --- Vite middleware / static serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });

    // HMR is disabled in this environment; stub @vite/client's WebSocket with an
    // immediately-open no-op socket so transport.connect completes without opening
    // an unexposed port 24678 socket and plugins calling import.meta.hot.send()
    // (such as vite-plugin-pwa) do not throw SendBeforeConnectError.
    app.get('/@vite/client', async (req, res, next) => {
      try {
        const result = await vite.transformRequest(req.originalUrl);
        if (!result) {
          next();
          return;
        }
        const patched = result.code.replace(
          /createConnection:\s*\(\)\s*=>\s*new WebSocket\([^)]*\)/g,
          'createConnection: () => ({ readyState: 1, OPEN: 1, addEventListener() {}, removeEventListener() {}, send() {}, close() {} })',
        );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.send(patched);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Kabmeet server running on http://0.0.0.0:${PORT}`);
    const needsAdmin =
      !process.env.ADMIN_PASSCODE?.trim() &&
      !store.state.adminClaimed &&
      !store.state.users.some((u) => u.role === 'ADMIN');
    if (needsAdmin) {
      console.log(`First-run admin setup code: ${getAdminSetupCode()}  (enter it on the Setup Admin tab)`);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start Kabmeet server:', err);
  process.exit(1);
});
