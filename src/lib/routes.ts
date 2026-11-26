// Address bar <-> app screen. Pure functions, so they are easy to test.
//   /                    discover
//   /communities         communities list      /communities/:slug  one community
//   /watch               watch (default session)  /watch/:id   one session
//   /room/:id            interactive room      /classes   /host   /profile   /admin   /auth
//   /leaderboard         club leaderboard      /events   /events/:slug  events and one event
export type AppRoute =
  | 'discover'
  | 'communities'
  | 'watch'
  | 'room'
  | 'classes'
  | 'host-panel'
  | 'profile'
  | 'leaderboard'
  | 'events'
  | 'event'
  | 'admin'
  | 'auth';

export interface ParsedLocation {
  route: AppRoute;
  sessionId?: string;
  communitySlug?: string | null;
  eventSlug?: string | null;
}

/** Screens that need a signed-in person. A signed-out visitor is sent to sign in, then back here. */
export const SIGN_IN_ROUTES: ReadonlySet<AppRoute> = new Set(['room', 'classes', 'host-panel', 'profile', 'leaderboard', 'admin']);

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function segment(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  return ID_PATTERN.test(value) ? value : undefined;
}

/** Returns null for an address the app does not know (the caller shows Discover at "/"). */
export function parsePath(pathname: string): ParsedLocation | null {
  const parts = pathname.split('/').filter(Boolean);
  const [head, second, ...rest] = parts;
  if (rest.length > 0) return null;
  switch (head) {
    case undefined:
      return second ? null : { route: 'discover' };
    case 'communities': {
      if (!second) return { route: 'communities', communitySlug: null };
      const slug = segment(second);
      return slug ? { route: 'communities', communitySlug: slug } : null;
    }
    case 'watch': {
      if (!second) return { route: 'watch' };
      const id = segment(second);
      return id ? { route: 'watch', sessionId: id } : null;
    }
    case 'room': {
      const id = segment(second);
      return id ? { route: 'room', sessionId: id } : null;
    }
    case 'classes':
      return second ? null : { route: 'classes' };
    case 'host':
      return second ? null : { route: 'host-panel' };
    case 'profile':
      return second ? null : { route: 'profile' };
    case 'leaderboard':
      return second ? null : { route: 'leaderboard' };
    case 'events': {
      if (!second) return { route: 'events' };
      const slug = segment(second);
      return slug ? { route: 'event', eventSlug: slug } : null;
    }
    case 'admin':
      return second ? null : { route: 'admin' };
    case 'auth':
      return second ? null : { route: 'auth' };
    default:
      return null;
  }
}

export function buildPath(
  route: AppRoute,
  opts: { sessionId?: string; communitySlug?: string | null; eventSlug?: string | null } = {},
): string {
  switch (route) {
    case 'discover':
      return '/';
    case 'communities':
      return opts.communitySlug ? `/communities/${encodeURIComponent(opts.communitySlug)}` : '/communities';
    case 'watch':
      return opts.sessionId ? `/watch/${encodeURIComponent(opts.sessionId)}` : '/watch';
    case 'room':
      return opts.sessionId ? `/room/${encodeURIComponent(opts.sessionId)}` : '/';
    case 'classes':
      return '/classes';
    case 'host-panel':
      return '/host';
    case 'profile':
      return '/profile';
    case 'leaderboard':
      return '/leaderboard';
    case 'events':
      return '/events';
    case 'event':
      return opts.eventSlug ? `/events/${encodeURIComponent(opts.eventSlug)}` : '/events';
    case 'admin':
      return '/admin';
    case 'auth':
      return '/auth';
  }
}

/** Only same-site paths may be used as a "go back here after sign-in" target. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  const parsed = parsePath(value.split(/[?#]/)[0]);
  return parsed && parsed.route !== 'auth' ? value : null;
}
