/*
 * Notifications (Task 13): the in-app bell, and Web Push as an extra copy for people who allowed it.
 *
 * Rules
 * - The bell entry is always written (unless the person switched that kind off).
 * - Push goes out only if: VAPID keys are set, the person subscribed a browser, the kind is on, and it is
 *   not quiet hours (Kabale time). Quiet hours silence push only; the bell still fills up.
 * - Private classes never announce "going live" to followers. Only enrolled people hear about them (class-soon).
 * - Nothing here includes email, ids of other people, or chat text.
 */
import { createRequire } from 'node:module';
import type * as WebPush from 'web-push';
import {
  DEFAULT_PREFS,
  inQuietHours,
  isClockTime,
  type AppNotification,
  type NotificationKind,
  type NotificationPrefs,
  type NotificationsResponse,
} from '../src/shared/notifications';
import { store, type StoredPushSubscription, type StoredUser } from './store';
import type { KabSession } from '../src/types/kabmeet';

// web-push is a CommonJS package; require it the same way under tsx, node and the bundler.
const webpush = createRequire(import.meta.url)('web-push') as typeof WebPush;

const MAX_PER_USER = 50;
const MAX_NOTIFIED_KEYS = 2000;

// ---------------------------------------------------------------------------------------------
// Push setup. Without keys, push is simply off and the bell carries everything.

let vapidReady = false;

export function configurePush(env: NodeJS.ProcessEnv = process.env): boolean {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    vapidReady = false;
    return false;
  }
  try {
    webpush.setVapidDetails(env.VAPID_SUBJECT?.trim() || 'mailto:ai@kab.ac.ug', publicKey, privateKey);
    vapidReady = true;
  } catch (err) {
    console.warn('[kabmeet] VAPID keys are not valid, push is off:', (err as Error).message);
    vapidReady = false;
  }
  return vapidReady;
}

export const pushEnabled = () => vapidReady;
export const vapidPublicKey = () => (vapidReady ? (process.env.VAPID_PUBLIC_KEY?.trim() ?? null) : null);

/** Test hook: replace the function that actually talks to the push service. */
type PushSender = (sub: StoredPushSubscription, payload: string) => Promise<void>;
let sender: PushSender = async (sub, payload) => {
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 60 * 60 });
};
export function setPushSender(fn: PushSender | null): void {
  sender = fn ?? (async (sub, payload) => {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 60 * 60 });
  });
}
/** Test hook: pretend keys exist. */
export function forcePushReady(ready: boolean): void {
  vapidReady = ready;
}

// ---------------------------------------------------------------------------------------------
// Storage helpers

const lists = () => (store.state.notifications ??= {});
const prefsMap = () => (store.state.notificationPrefs ??= {});
const subsMap = () => (store.state.pushSubscriptions ??= {});
const keysMap = () => (store.state.notifiedKeys ??= {});

export function getPrefs(userId: string): NotificationPrefs {
  const saved = prefsMap()[userId];
  return {
    kinds: { ...DEFAULT_PREFS.kinds, ...(saved?.kinds ?? {}) },
    quiet: { ...DEFAULT_PREFS.quiet, ...(saved?.quiet ?? {}) },
  };
}

export function setPrefs(userId: string, patch: Partial<{ kinds: Partial<Record<NotificationKind, boolean>>; quiet: Partial<NotificationPrefs['quiet']> }>): NotificationPrefs {
  const cur = getPrefs(userId);
  if (patch.kinds) {
    for (const k of Object.keys(cur.kinds) as NotificationKind[]) {
      if (typeof patch.kinds[k] === 'boolean') cur.kinds[k] = patch.kinds[k]!;
    }
  }
  if (patch.quiet) {
    if (typeof patch.quiet.enabled === 'boolean') cur.quiet.enabled = patch.quiet.enabled;
    if (isClockTime(patch.quiet.start)) cur.quiet.start = patch.quiet.start;
    if (isClockTime(patch.quiet.end)) cur.quiet.end = patch.quiet.end;
  }
  prefsMap()[userId] = cur;
  store.save();
  return cur;
}

export function listFor(userId: string): NotificationsResponse {
  const items = lists()[userId] ?? [];
  return { items: items.slice(0, MAX_PER_USER), unread: items.filter((n) => !n.read).length };
}

export function markRead(userId: string, id: string | 'all'): void {
  for (const n of lists()[userId] ?? []) if (id === 'all' || n.id === id) n.read = true;
  store.save();
}

export function pushDeviceCount(userId: string): number {
  return (subsMap()[userId] ?? []).length;
}

export function addSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): void {
  const all = subsMap();
  const list = (all[userId] ??= []);
  const existing = list.find((s) => s.endpoint === sub.endpoint);
  if (existing) {
    existing.keys = sub.keys;
  } else {
    list.push({ endpoint: sub.endpoint, keys: sub.keys, createdAt: new Date().toISOString() });
  }
  // A browser belongs to one person at a time (shared computers): remove it from anyone else.
  for (const [other, theirs] of Object.entries(all)) {
    if (other !== userId) all[other] = theirs.filter((s) => s.endpoint !== sub.endpoint);
  }
  store.save();
}

export function removeSubscription(userId: string, endpoint: string): void {
  const all = subsMap();
  all[userId] = (all[userId] ?? []).filter((s) => s.endpoint !== endpoint);
  store.save();
}

/** True the first time a one-time key is used; false after. Survives restarts. */
function firstTime(key: string): boolean {
  const keys = keysMap();
  if (keys[key]) return false;
  keys[key] = Date.now();
  const all = Object.keys(keys);
  if (all.length > MAX_NOTIFIED_KEYS) {
    for (const old of all.sort((a, b) => keys[a] - keys[b]).slice(0, all.length - MAX_NOTIFIED_KEYS)) delete keys[old];
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Sending

export interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string | null;
}

type Listener = (userId: string, n: AppNotification) => void;
let listener: Listener | null = null;
/** The websocket server registers here so open pages see the bell change at once. */
export function setNotificationListener(fn: Listener | null): void {
  listener = fn;
}

export function notify(userId: string, input: NotifyInput, now: Date = new Date()): AppNotification | null {
  const user = store.state.users.find((u) => u.id === userId && u.isActive);
  if (!user) return null;
  const prefs = getPrefs(userId);
  if (!prefs.kinds[input.kind]) return null;

  const entry: AppNotification = {
    id: `ntf-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    createdAt: now.toISOString(),
    read: false,
  };
  const list = (lists()[userId] ??= []);
  list.unshift(entry);
  if (list.length > MAX_PER_USER) list.length = MAX_PER_USER;
  store.save();
  listener?.(userId, entry);

  if (vapidReady && !inQuietHours(prefs.quiet, now)) void pushTo(userId, entry);
  return entry;
}

async function pushTo(userId: string, n: AppNotification): Promise<void> {
  const subs = [...(subsMap()[userId] ?? [])];
  if (subs.length === 0) return;
  const payload = JSON.stringify({ id: n.id, title: n.title, body: n.body, href: n.href ?? '/', tag: n.kind });
  for (const sub of subs) {
    try {
      await sender(sub, payload);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404 and 410 mean the browser unsubscribed. Forget it so we stop trying.
      if (status === 404 || status === 410) removeSubscription(userId, sub.endpoint);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Events that produce notifications

/** Badges and streaks (the first entry type). */
export function notifyAward(userId: string, notice: { badges: Array<{ emoji: string; name: string }>; streakWeeks?: number }): void {
  for (const b of notice.badges) {
    notify(userId, { kind: 'badge', title: `New badge: ${b.name}`, body: `${b.emoji} You earned it. See all of yours on your profile.`, href: '/profile' });
  }
  if (notice.streakWeeks) {
    notify(userId, { kind: 'badge', title: `${notice.streakWeeks} weeks in a row`, body: 'Your weekly streak keeps growing. Come back next week to keep it.', href: '/profile' });
  }
}

const watchPath = (s: KabSession) => `/watch/${s.id}`;

/** A public session went live: tell people who follow its community or asked for a reminder. */
export function notifySessionLive(session: KabSession): void {
  if (session.isPrivateClass) return;
  if (!firstTime(`live:${session.id}`)) return;
  const ids = new Set<string>([
    ...(store.state.communityFollows[session.communitySlug] ?? []),
    ...(store.state.reminders[session.id] ?? []),
  ]);
  ids.delete(session.hostId);
  for (const id of ids) {
    notify(id, { kind: 'session-live', title: `${session.communityName} is live`, body: session.title, href: watchPath(session) });
  }
}

function enrolled(session: KabSession, user: StoredUser): boolean {
  const email = user.email.toLowerCase();
  const uni = user.universityId?.toLowerCase();
  return session.allowedStudents.some((e) => e.toLowerCase() === email || (uni !== undefined && e.toLowerCase() === uni));
}

/** Sessions that start within 10 minutes: tell people who asked, and enrolled students of private classes. */
export function runClassSoonSweep(now: Date = new Date()): number {
  let sent = 0;
  for (const s of store.state.sessions) {
    if (s.status !== 'UPCOMING') continue;
    const startsIn = new Date(s.scheduledAt).getTime() - now.getTime();
    if (startsIn <= 0 || startsIn > 10 * 60_000) continue;
    if (!firstTime(`soon:${s.id}:${s.scheduledAt}`)) continue;
    const ids = new Set<string>(store.state.reminders[s.id] ?? []);
    if (s.isPrivateClass) for (const u of store.state.users) if (u.isActive && enrolled(s, u)) ids.add(u.id);
    ids.delete(s.hostId);
    const minutes = Math.max(1, Math.round(startsIn / 60_000));
    for (const id of ids) {
      notify(id, { kind: 'class-soon', title: `Starts in ${minutes} min`, body: s.title, href: watchPath(s) }, now);
      sent++;
    }
  }
  return sent;
}

export function notifyHandApproved(userId: string, session: KabSession): void {
  notify(userId, { kind: 'hand-approved', title: 'The host approved your hand', body: `You can speak now in ${session.title}.`, href: `/room/${session.id}` });
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;
export function startNotificationScheduler(everyMs = 60_000): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => runClassSoonSweep(), everyMs);
  sweepTimer.unref?.();
}
export function stopNotificationScheduler(): void {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}
