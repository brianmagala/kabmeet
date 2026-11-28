// Task 13 tests (bell + push rules) and Task 14b fixes (watch-time checkpoint, host badge). In-process, temp data dir.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inQuietHours } from '../src/shared/notifications';

const dir = mkdtempSync(path.join(tmpdir(), 'kab-ntf-'));
process.env.KABMEET_DATA_DIR = dir;
process.env.KABMEET_ATTEND_SECONDS = '1';

type N = typeof import('../server/notifications');
type E = typeof import('../server/engagement');
type S = typeof import('../server/store');
let n: N;
let eng: E;
let store: S['store'];
const sent: Array<{ endpoint: string; payload: any }> = [];

const SUB = (id: string) => ({ endpoint: `https://push.example/${id}`, keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(12) } });

function session(over: Record<string, unknown> = {}) {
  const s: any = {
    id: `t-${Math.random().toString(36).slice(2, 7)}`, title: 'Test talk', description: '', communitySlug: 'kab-ai', communityName: 'KAB AI Club',
    hostId: 'usr-host-1', hostName: 'Host', status: 'UPCOMING', mode: 'LIVE', scheduledAt: new Date().toISOString(), startedAt: null,
    thumbnailUrl: '', viewerCount: 0, peakViewers: 0, isPrivateClass: false, courseCode: null, allowedStudents: [], ...over,
  };
  store.state.sessions.unshift(s);
  return s;
}
const bell = (id: string) => n.listFor(id);

before(async () => {
  n = await import('../server/notifications');
  eng = await import('../server/engagement');
  store = (await import('../server/store')).store;
  n.forcePushReady(true);
  n.setPushSender(async (sub, payload) => {
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  });
});
after(() => {
  eng.clearPresenceTimers();
  n.stopNotificationScheduler();
  rmSync(dir, { recursive: true, force: true });
});

describe('quiet hours', () => {
  test('use Kabale time and wrap past midnight', () => {
    const q = { enabled: true, start: '22:00', end: '07:00' };
    assert.equal(inQuietHours(q, new Date('2026-11-28T19:30:00Z')), true); // 22:30 in Kabale
    assert.equal(inQuietHours(q, new Date('2026-11-28T03:00:00Z')), true); // 06:00 in Kabale
    assert.equal(inQuietHours(q, new Date('2026-11-28T04:00:00Z')), false); // 07:00 exactly: over
    assert.equal(inQuietHours(q, new Date('2026-11-28T09:00:00Z')), false);
    assert.equal(inQuietHours({ ...q, enabled: false }, new Date('2026-11-28T19:30:00Z')), false);
  });
});

describe('the bell', () => {
  test('a notification lands in the bell, unread, and can be marked read', () => {
    const e = n.notify('usr-member-1', { kind: 'badge', title: 'New badge: First Session', body: 'x', href: '/profile' });
    assert.ok(e);
    assert.equal(bell('usr-member-1').unread >= 1, true);
    n.markRead('usr-member-1', e!.id);
    assert.equal(bell('usr-member-1').items.find((i) => i.id === e!.id)!.read, true);
    n.markRead('usr-member-1', 'all');
    assert.equal(bell('usr-member-1').unread, 0);
  });

  test('a switched-off kind produces nothing, in the bell or in push', () => {
    n.setPrefs('usr-member-2', { kinds: { 'hand-approved': false } });
    n.addSubscription('usr-member-2', SUB('m2'));
    const before = bell('usr-member-2').items.length;
    sent.length = 0;
    assert.equal(n.notify('usr-member-2', { kind: 'hand-approved', title: 't', body: 'b' }), null);
    assert.equal(bell('usr-member-2').items.length, before);
    assert.equal(sent.length, 0);
  });

  test('an unknown or inactive person gets nothing', () => {
    assert.equal(n.notify('nobody', { kind: 'badge', title: 't', body: 'b' }), null);
  });
});

describe('push', () => {
  test('goes to a subscribed browser with the same text as the bell', async () => {
    n.setPrefs('usr-member-1', { quiet: { enabled: false } });
    n.addSubscription('usr-member-1', SUB('m1'));
    sent.length = 0;
    n.notify('usr-member-1', { kind: 'badge', title: 'Hello', body: 'World', href: '/profile' });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].endpoint, SUB('m1').endpoint);
    assert.deepEqual([sent[0].payload.title, sent[0].payload.body, sent[0].payload.href], ['Hello', 'World', '/profile']);
  });

  test('quiet hours silence push but the bell still fills', async () => {
    n.setPrefs('usr-member-1', { quiet: { enabled: true, start: '22:00', end: '07:00' } });
    sent.length = 0;
    const before = bell('usr-member-1').items.length;
    n.notify('usr-member-1', { kind: 'badge', title: 'Late', body: 'x' }, new Date('2026-11-28T20:00:00Z')); // 23:00 Kabale
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(sent.length, 0);
    assert.equal(bell('usr-member-1').items.length, before + 1);
    n.setPrefs('usr-member-1', { quiet: { enabled: false } });
  });

  test('without keys on the server push is off and the bell still works', async () => {
    n.forcePushReady(false);
    sent.length = 0;
    const before = bell('usr-member-1').items.length;
    n.notify('usr-member-1', { kind: 'badge', title: 'NoKeys', body: 'x' });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(sent.length, 0);
    assert.equal(bell('usr-member-1').items.length, before + 1);
    n.forcePushReady(true);
  });

  test('a browser that unsubscribed (410) is forgotten', async () => {
    n.addSubscription('usr-member-1', SUB('gone'));
    n.setPushSender(async (sub) => {
      if (sub.endpoint.endsWith('/gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    });
    n.notify('usr-member-1', { kind: 'badge', title: 'x', body: 'y' });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(store.state.pushSubscriptions!['usr-member-1'].some((s) => s.endpoint.endsWith('/gone')), false);
    n.setPushSender(async (sub, payload) => {
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    });
  });

  test('a shared browser belongs to the last person who signed in on it', () => {
    n.addSubscription('usr-member-1', SUB('shared'));
    n.addSubscription('usr-member-2', SUB('shared'));
    assert.equal(store.state.pushSubscriptions!['usr-member-1'].some((s) => s.endpoint.endsWith('/shared')), false);
    assert.equal(store.state.pushSubscriptions!['usr-member-2'].some((s) => s.endpoint.endsWith('/shared')), true);
  });
});

describe('who hears what', () => {
  test('going live: followers and reminders hear it, the host does not, and only once', () => {
    store.state.communityFollows['kab-ai'] = ['usr-member-1', 'usr-host-1'];
    const s = session({ status: 'LIVE' });
    store.state.reminders[s.id] = ['usr-member-2'];
    const b1 = bell('usr-member-1').items.length;
    const b2 = bell('usr-member-2').items.length;
    const bh = bell('usr-host-1').items.length;
    n.notifySessionLive(s);
    n.notifySessionLive(s);
    assert.equal(bell('usr-member-1').items.length, b1 + 1);
    assert.equal(bell('usr-member-2').items.length, b2 + 1);
    assert.equal(bell('usr-host-1').items.length, bh);
    assert.equal(bell('usr-member-1').items[0].href, `/watch/${s.id}`);
  });

  test('a private class never announces itself to followers', () => {
    store.state.communityFollows['kab-ai'] = ['usr-member-1'];
    const s = session({ status: 'LIVE', isPrivateClass: true, allowedStudents: [] });
    const before = bell('usr-member-1').items.length;
    n.notifySessionLive(s);
    assert.equal(bell('usr-member-1').items.length, before);
  });

  test('10 minute reminder: inside the window once, not before it, and enrolled students of a private class', () => {
    const now = new Date('2026-11-28T10:00:00Z');
    const soon = session({ scheduledAt: new Date(now.getTime() + 8 * 60_000).toISOString() });
    const later = session({ scheduledAt: new Date(now.getTime() + 30 * 60_000).toISOString() });
    store.state.reminders[soon.id] = ['usr-member-1'];
    store.state.reminders[later.id] = ['usr-member-1'];
    const member2 = store.state.users.find((u) => u.id === 'usr-member-2')!;
    const cls = session({ isPrivateClass: true, courseCode: 'BCS 1', allowedStudents: [member2.email], scheduledAt: new Date(now.getTime() + 5 * 60_000).toISOString() });
    const b1 = bell('usr-member-1').items.length;
    const b2 = bell('usr-member-2').items.length;
    assert.equal(n.runClassSoonSweep(now), 2);
    assert.equal(n.runClassSoonSweep(now), 0); // already told
    assert.equal(bell('usr-member-1').items.length, b1 + 1);
    assert.equal(bell('usr-member-2').items.length, b2 + 1);
    assert.equal(bell('usr-member-2').items[0].href, `/watch/${cls.id}`);
    assert.ok(!bell('usr-member-1').items.some((i) => i.href === `/watch/${later.id}`));
  });

  test('a hand approval tells that person, with a link to the room', () => {
    const s = session({ status: 'LIVE' });
    const before = bell('usr-member-1').items.length;
    n.notifyHandApproved('usr-member-1', s);
    assert.equal(bell('usr-member-1').items.length, before + 1);
    assert.equal(bell('usr-member-1').items[0].href, `/room/${s.id}`);
  });

  test('earning a badge writes a bell entry', () => {
    const before = bell('usr-member-1').items.length;
    n.notifyAward('usr-member-1', { badges: [{ emoji: '🎓', name: 'First Session' }], streakWeeks: 3 });
    assert.equal(bell('usr-member-1').items.length, before + 2);
    assert.match(bell('usr-member-1').items[1].title, /First Session/);
  });
});

describe('Task 14b fixes', () => {
  test('watch time is saved by the checkpoint and never counted twice', () => {
    const s = session({ status: 'LIVE' });
    const t0 = 1_800_000_000_000;
    eng.presenceEnter(s.id, 'usr-member-1', 1, t0);
    eng.checkpointPresence(t0 + 40_000);
    // The server "restarts" here: only what was checkpointed is on disk.
    assert.equal(store.state.sessionStats![s.id].viewerSeconds['usr-member-1'], 40);
    eng.checkpointPresence(t0 + 70_000);
    eng.presenceLeave(s.id, 'usr-member-1', 0, t0 + 100_000);
    assert.equal(store.state.sessionStats![s.id].viewerSeconds['usr-member-1'], 100);
  });

  test('stats for a person still connected include the unsaved part exactly once', () => {
    const s = session({ status: 'LIVE' });
    const t0 = 1_800_000_000_000;
    eng.presenceEnter(s.id, 'usr-member-2', 1, t0);
    eng.checkpointPresence(t0 + 30_000);
    const stats = eng.getSessionStatsFor(s.id, 1, t0 + 45_000);
    assert.equal(stats.totalWatchSeconds, 45);
    eng.presenceLeave(s.id, 'usr-member-2', 0, t0 + 50_000);
  });

  test('a host who goes live gets the "On the Mic" badge at once', () => {
    store.state.users.push({ ...store.state.users.find((u) => u.id === 'usr-member-1')!, id: 'usr-newhost', email: 'newhost@kab.ac.ug' });
    session({ hostId: 'usr-newhost', status: 'LIVE' });
    assert.equal(eng.getEngagement('usr-newhost').badges['host'], undefined);
    eng.recordHostStarted('usr-newhost');
    assert.ok(eng.getEngagement('usr-newhost').badges['host']);
  });
});
