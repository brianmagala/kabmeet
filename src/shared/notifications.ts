/*
 * Notification rules shared by the server and the browser (Task 13).
 * The bell always works. Push is an extra copy of the same entry for people who allowed it.
 */

export type NotificationKind = 'badge' | 'session-live' | 'class-soon' | 'hand-approved';

export interface NotificationKindDef {
  kind: NotificationKind;
  /** Short label for the settings switch. */
  label: string;
  /** What the person will receive, in plain words. */
  hint: string;
}

export const NOTIFICATION_KINDS: readonly NotificationKindDef[] = [
  { kind: 'session-live', label: 'A club I follow goes live', hint: 'When a session starts in a community you follow.' },
  { kind: 'class-soon', label: 'A session starts in 10 minutes', hint: 'For sessions you asked to be reminded about, and classes you are enrolled in.' },
  { kind: 'hand-approved', label: 'The host approves my hand', hint: 'When you are allowed to speak.' },
  { kind: 'badge', label: 'Badges and streaks', hint: 'When you earn a badge or extend a weekly streak.' },
] as const;

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** In-app path to open, such as /watch/sess-1. */
  href: string | null;
  createdAt: string;
  read: boolean;
}

export interface QuietHours {
  enabled: boolean;
  /** "HH:MM" in Kabale time (UTC+3). Can wrap past midnight, e.g. 22:00 to 07:00. */
  start: string;
  end: string;
}

export interface NotificationPrefs {
  kinds: Record<NotificationKind, boolean>;
  quiet: QuietHours;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  kinds: { badge: true, 'session-live': true, 'class-soon': true, 'hand-approved': true },
  quiet: { enabled: false, start: '22:00', end: '07:00' },
};

export interface NotificationsResponse {
  items: AppNotification[];
  unread: number;
}

export interface NotificationConfig {
  /** Server has VAPID keys, so push can be offered. */
  pushEnabled: boolean;
  publicKey: string | null;
  prefs: NotificationPrefs;
  /** Browsers that this person subscribed on. */
  pushDevices: number;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isClockTime = (v: unknown): v is string => typeof v === 'string' && TIME.test(v);

function minutes(hhmm: string): number {
  const m = TIME.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Is this moment inside quiet hours? Kabale time, handles ranges that wrap midnight. */
export function inQuietHours(quiet: QuietHours, at: Date): boolean {
  if (!quiet.enabled) return false;
  const kabale = new Date(at.getTime() + 3 * 3_600_000);
  const now = kabale.getUTCHours() * 60 + kabale.getUTCMinutes();
  const start = minutes(quiet.start);
  const end = minutes(quiet.end);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}
