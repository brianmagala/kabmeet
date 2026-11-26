// Task 14 tests: the pure rules (weeks, streaks, badges) and the real server (awards, caps, leaderboard privacy, host stats).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { BADGES, badgesFor, computeStreak, weekIndexOf, weekKeyOf, type EngagementMetrics } from '../src/shared/engagement';

describe('weeks and streaks', () => {
  test('weeks run Monday to Sunday in Kabale time (UTC+3)', () => {
    assert.equal(weekKeyOf(new Date('2026-11-25T10:00:00Z')), '2026-W48');
    // Sunday 20:00 UTC is still Sunday 23:00 in Kabale, so still last week.
    assert.equal(weekKeyOf(new Date('2026-11-22T20:00:00Z')), '2026-W47');
    // Sunday 22:00 UTC is already Monday 01:00 in Kabale.
    assert.equal(weekKeyOf(new Date('2026-11-22T22:00:00Z')), '2026-W48');
  });

  test('week numbers count up by one, also across New Year', () => {
    assert.equal(weekIndexOf('2026-W48') - weekIndexOf('2026-W47'), 1);
    assert.equal(weekIndexOf('2026-W01') - weekIndexOf('2025-W52'), 1);
  });

  test('a streak is weeks in a row, and last week still keeps it alive', () => {
    assert.deepEqual(computeStreak(['2026-W46', '2026-W47', '2026-W48'], '2026-W48'), { current: 3, best: 3, thisWeekDone: true });
    assert.deepEqual(computeStreak(['2026-W46', '2026-W47'], '2026-W48'), { current: 2, best: 2, thisWeekDone: false });
    assert.deepEqual(computeStreak(['2026-W44', '2026-W45'], '2026-W48'), { current: 0, best: 2, thisWeekDone: false });
    assert.deepEqual(computeStreak(['2025-W52', '2026-W01'], '2026-W01'), { current: 2, best: 2, thisWeekDone: true });
    assert.deepEqual(computeStreak([], '2026-W48'), { current: 0, best: 0, thisWeekDone: false });
  });

  test('a gap resets the current streak but keeps the best', () => {
    const s = computeStreak(['2026-W40', '2026-W41', '2026-W42', '2026-W47', '2026-W48'], '2026-W48');
    assert.equal(s.current, 2);
    assert.equal(s.best, 3);
  });
});

describe('badges', () => {
  const none: EngagementMetrics = { sessionsAttended: 0, bestStreak: 0, chatMessages: 0, questionsAsked: 0, pollVotes: 0, sessionsHosted: 0 };
  test('nothing earned at zero, and ids are unique', () => {
    assert.deepEqual(badgesFor(none), []);
    assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
  });
  test('each badge unlocks exactly at its target', () => {
    for (const b of BADGES) {
      assert.ok(!badgesFor({ ...none, [b.metric]: b.target - 1 }).includes(b.id), `${b.id} should not unlock below target`);
      assert.ok(badgesFor({ ...none, [b.metric]: b.target }).includes(b.id), `${b.id} should unlock at target`);
    }
  });
});

// ---------------------------------------------------------------------------------------------
const PORT = 3800 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;
let dataDir: string;
let setupCode = '';

async function call(method: string, url: string, body?: unknown, token?: string) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json };
}

async function register(email: string, fullName: string) {
  const r = await call('POST', '/api/auth/register', { email, fullName, password: 'longpassword1' });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return { token: r.json.accessToken as string, user: r.json.user };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Open a websocket to a session and collect what the server sends. */
function connect(sessionId: string, token: string, monitor = false) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?sessionId=${sessionId}&token=${token}${monitor ? '&monitor=1' : ''}`);
  const events: Array<{ event: string; payload: any }> = [];
  ws.on('message', (raw) => events.push(JSON.parse(raw.toString())));
  const ready = new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  const send = (event: string, payload: unknown = {}) => ws.send(JSON.stringify({ event, payload }));
  return { ws, events, ready, send };
}

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'kabmeet-eng-'));
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      KABMEET_DATA_DIR: dataDir,
      KABMEET_ATTEND_SECONDS: '1',
      ADMIN_PASSCODE: '',
      ADMIN_SETUP_CODE: '',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start in 30 s')), 30_000);
    server.stdout!.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const m = text.match(/setup code: ([a-f0-9]+)/);
      if (m) setupCode = m[1];
      if (text.includes('First-run admin setup code') || (setupCode && text.includes('running'))) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', () => reject(new Error('server exited early')));
  });
});

after(() => {
  server?.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

describe('engagement on the real server', () => {
  const SESSION = 'sess-ml-python'; // a public seeded session
  let adminToken = '';

  test('staying in a session earns attendance, a streak and the First Session badge', async () => {
    const amina = await register('amina@kab.ac.ug', 'Amina Tumwine');
    const c = connect(SESSION, amina.token);
    await c.ready;
    await sleep(2200); // the test server counts attendance after 1 second
    const me = await call('GET', '/api/engagement/me', undefined, amina.token);
    assert.equal(me.status, 200);
    const e = me.json.engagement;
    assert.equal(e.metrics.sessionsAttended, 1);
    assert.equal(e.streak.current, 1);
    assert.equal(e.streak.thisWeekDone, true);
    assert.equal(e.points, 10);
    assert.ok(e.badges.find((b: any) => b.id === 'first-session').earned);
    const award = c.events.find((ev) => ev.event === 'engagement:award');
    assert.ok(award, 'the person is told about the new badge');
    assert.ok(award!.payload.badges.some((b: any) => b.id === 'first-session'));
    c.ws.close();
  });

  test('a quick bounce earns nothing', async () => {
    const bo = await register('bounce@kab.ac.ug', 'Quick Visitor');
    const c = connect(SESSION, bo.token);
    await c.ready;
    c.ws.close();
    await sleep(1600);
    const me = await call('GET', '/api/engagement/me', undefined, bo.token);
    assert.equal(me.json.engagement.metrics.sessionsAttended, 0);
    assert.equal(me.json.engagement.points, 0);
  });

  test('chat points are capped per session, but the Chatterbox badge still counts every message', async () => {
    const chat = await register('chatty@kab.ac.ug', 'Chatty Student');
    const c = connect(SESSION, chat.token);
    await c.ready;
    for (let i = 0; i < 26; i++) c.send('chat:send', { text: `hello ${i}` });
    await sleep(2200);
    const e = (await call('GET', '/api/engagement/me', undefined, chat.token)).json.engagement;
    assert.equal(e.metrics.chatMessages, 26);
    assert.equal(e.points, 10 /* attend */ + 10 /* chat cap */);
    assert.ok(e.badges.find((b: any) => b.id === 'chatterbox').earned);
    c.ws.close();
  });

  test('two tabs of one person count as one attendance and one watcher', async () => {
    const two = await register('twotabs@kab.ac.ug', 'Two Tabs');
    const a = connect(SESSION, two.token);
    const b = connect(SESSION, two.token);
    await Promise.all([a.ready, b.ready]);
    await sleep(2200);
    const e = (await call('GET', '/api/engagement/me', undefined, two.token)).json.engagement;
    assert.equal(e.metrics.sessionsAttended, 1);
    assert.equal(e.points, 10);
    a.ws.close();
    b.ws.close();
  });

  test('the leaderboard is opt-in and never shows private details', async () => {
    const lb = await register('board@kab.ac.ug', 'Board Person');
    const c = connect(SESSION, lb.token);
    await c.ready;
    await sleep(2200);
    c.ws.close();

    // Not opted in yet: nobody who has not switched it on appears.
    const before = await call('GET', '/api/leaderboard?period=all', undefined, lb.token);
    assert.equal(before.status, 200);
    assert.ok(!before.json.entries.some((x: any) => x.name === 'Board Person'));

    const on = await call('PATCH', '/api/engagement/me', { leaderboardOptIn: true }, lb.token);
    assert.equal(on.json.engagement.leaderboardOptIn, true);
    const after = await call('GET', '/api/leaderboard?period=all', undefined, lb.token);
    const mine = after.json.entries.find((x: any) => x.isYou);
    assert.ok(mine, 'opted-in person appears and is marked as you');
    assert.equal(mine.points, 10);
    for (const entry of after.json.entries) {
      assert.deepEqual(Object.keys(entry).sort(), ['badgeCount', 'isYou', 'name', 'points', 'rank', 'streak']);
    }
    assert.ok(!JSON.stringify(after.json).includes('@kab.ac.ug'), 'no email on the board');

    const off = await call('PATCH', '/api/engagement/me', { leaderboardOptIn: false }, lb.token);
    assert.equal(off.json.engagement.leaderboardOptIn, false);
    const gone = await call('GET', '/api/leaderboard?period=all', undefined, lb.token);
    assert.ok(!gone.json.entries.some((x: any) => x.isYou));
  });

  test('leaderboard and engagement need sign-in, and the opt-in body is checked', async () => {
    assert.equal((await call('GET', '/api/leaderboard')).status, 401);
    assert.equal((await call('GET', '/api/engagement/me')).status, 401);
    const m = await register('checker@kab.ac.ug', 'Checker');
    assert.equal((await call('PATCH', '/api/engagement/me', { leaderboardOptIn: 'yes' }, m.token)).status, 400);
  });

  test('host stats: members are refused, an admin sees watch time and the viewers line', async () => {
    const member = await register('curious@kab.ac.ug', 'Curious Student');
    assert.equal((await call('GET', `/api/sessions/${SESSION}/stats`)).status, 401);
    assert.equal((await call('GET', `/api/sessions/${SESSION}/stats`, undefined, member.token)).status, 403);

    const admin = await call('POST', '/api/auth/claim-admin', { password: 'longpassword1', setupCode });
    assert.equal(admin.status, 201);
    adminToken = admin.json.accessToken;
    const watcher = await register('watcher@kab.ac.ug', 'Steady Watcher');
    const c = connect(SESSION, watcher.token);
    await c.ready;
    await sleep(2200);

    const live = await call('GET', `/api/sessions/${SESSION}/stats`, undefined, admin.json.accessToken);
    assert.equal(live.status, 200);
    const s = live.json.stats;
    assert.ok(s.currentViewers >= 1);
    assert.ok(s.uniqueSignedIn >= 1);
    assert.ok(s.totalWatchSeconds >= 2, `open connections are counted while live (got ${s.totalWatchSeconds})`);
    assert.ok(s.avgWatchSeconds >= 1);
    assert.ok(s.timeline.length >= 1);
    assert.ok(s.peakViewers >= 1);
    c.ws.close();

    await sleep(300);
    const closed = (await call('GET', `/api/sessions/${SESSION}/stats`, undefined, admin.json.accessToken)).json.stats;
    assert.ok(closed.currentViewers <= s.currentViewers);
    assert.ok(closed.totalWatchSeconds >= s.totalWatchSeconds - 1, 'watch time is kept after people leave');
    assert.equal((await call('GET', '/api/sessions/nope/stats', undefined, admin.json.accessToken)).status, 404);
  });

  test('private classes earn nothing, so class activity never reaches a leaderboard', async () => {
    assert.ok(adminToken, 'admin token from the previous test');
    const student = await register('classmate@kab.ac.ug', 'Class Mate');
    const created = await call(
      'POST',
      '/api/classes',
      { courseCode: 'BCS3104', title: 'Private seminar', description: 'Only listed students', allowedStudents: ['classmate@kab.ac.ug'] },
      adminToken,
    );
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const classId = created.json.classSession?.id;
    assert.ok(classId, `class id in ${JSON.stringify(created.json)}`);
    const c = connect(classId, student.token);
    await c.ready;
    c.send('chat:send', { text: 'hello class' });
    await sleep(2200);
    c.ws.close();
    const e = (await call('GET', '/api/engagement/me', undefined, student.token)).json.engagement;
    assert.equal(e.metrics.sessionsAttended, 0);
    assert.equal(e.metrics.chatMessages, 0);
    assert.equal(e.points, 0);
  });

  test('the Host Panel connection (monitor) is not a viewer and earns nothing', async () => {
    const mod = await register('moderator-view@kab.ac.ug', 'Panel Watcher');
    const c = connect(SESSION, mod.token, true);
    await c.ready;
    await sleep(2200);
    const e = (await call('GET', '/api/engagement/me', undefined, mod.token)).json.engagement;
    assert.equal(e.metrics.sessionsAttended, 0);
    assert.equal(e.points, 0);
    const stats = (await call('GET', `/api/sessions/${SESSION}/stats`, undefined, adminToken)).json.stats;
    assert.equal(stats.currentViewers, 0, 'a monitor is not counted as watching');
    c.ws.close();
  });
});
