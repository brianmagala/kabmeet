// Task 16 tests: events, hackathon teams, judging privacy, certificates. They start the real server
// (with real websockets for attendance) on a spare port with a throwaway data folder.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { buildIcs } from '../src/lib/ics';
import { eventPhase, splitCountdown } from '../src/shared/events';

// ---------------------------------------------------------------------------------------------
// Pure rules (no server needed)

describe('calendar file', () => {
  const ics = buildIcs(
    {
      id: 'evt-1',
      title: 'IndabaX Kabale, Day 1; "Vision"',
      description: 'Four sessions.\nBring a laptop.',
      venue: 'Main Hall, Kabale University',
      startsAt: '2026-12-05T06:30:00.000Z',
      endsAt: '2026-12-05T14:00:00.000Z',
    },
    new Date('2026-11-26T08:00:00Z'),
  );

  test('times are UTC and use the calendar format', () => {
    assert.match(ics, /DTSTART:20261205T063000Z\r\n/);
    assert.match(ics, /DTEND:20261205T140000Z\r\n/);
    assert.match(ics, /DTSTAMP:20261126T080000Z\r\n/);
  });

  test('has a 15 minute reminder and well-formed lines', () => {
    assert.match(ics, /BEGIN:VALARM[\s\S]*TRIGGER:-PT15M[\s\S]*END:VALARM/);
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
    for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line}`);
  });

  test('commas, semicolons and new lines in text are escaped', () => {
    assert.match(ics, /SUMMARY:IndabaX Kabale\\, Day 1\; "Vision"/);
    assert.match(ics, /Four sessions\.\\nBring a laptop\./);
  });
});

describe('countdown', () => {
  test('splits into days, hours and minutes and never goes negative', () => {
    assert.deepEqual(splitCountdown((2 * 24 * 60 + 3 * 60 + 7) * 60000), { days: 2, hours: 3, minutes: 7 });
    assert.deepEqual(splitCountdown(-5000), { days: 0, hours: 0, minutes: 0 });
  });
  test('phase is upcoming, live, then ended', () => {
    const ev = { startsAt: '2026-12-05T06:00:00Z', endsAt: '2026-12-05T10:00:00Z' };
    assert.equal(eventPhase(ev, Date.parse('2026-12-05T05:59:59Z')), 'upcoming');
    assert.equal(eventPhase(ev, Date.parse('2026-12-05T06:00:00Z')), 'live');
    assert.equal(eventPhase(ev, Date.parse('2026-12-05T10:00:00Z')), 'ended');
  });
});

// ---------------------------------------------------------------------------------------------
// The real server

const PORT = 4900 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;
let dataDir: string;
let setupCode = '';
// People shared by the tests below. Registering is limited to 10 per hour per address, so keep this short.
let admin = { token: '', id: '' };
let host = { token: '', id: '' };
let member = { token: '', id: '' };

async function call(method: string, url: string, body?: unknown, token?: string) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let json: any = null;
  try {
    json = JSON.parse(buf.toString('utf8'));
  } catch {
    /* not JSON (a PDF, for instance) */
  }
  return { status: res.status, json, raw: buf, type: res.headers.get('content-type') ?? '' };
}

async function register(email: string, fullName: string) {
  const r = await call('POST', '/api/auth/register', { email, fullName, password: 'longpassword1' });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return { token: r.json.accessToken as string, user: r.json.user as { id: string; email: string; fullName: string } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Stay connected to a public session long enough to count as having attended it. */
async function attend(sessionId: string, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?sessionId=${sessionId}&token=${token}`);
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  await sleep(1600); // KABMEET_ATTEND_SECONDS is 1 in this test server
  ws.close();
  await sleep(150);
}

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'kabmeet-events-'));
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
  const claimed = await call('POST', '/api/auth/claim-admin', {
    email: 'admin@ai.kab.ac.ug',
    fullName: 'Admin One',
    password: 'longpassword1',
    setupCode,
  });
  assert.equal(claimed.status, 201, JSON.stringify(claimed.json));
  admin = { token: claimed.json.accessToken, id: claimed.json.user.id };
  const h = await register('host@kab.ac.ug', 'Hope Host');
  const roleRes = await call('PATCH', `/api/admin/users/${h.user.id}/role`, { role: 'HOST' }, admin.token);
  assert.equal(roleRes.status, 200, JSON.stringify(roleRes.json));
  host = { token: h.token, id: h.user.id };
  const m = await register('member@kab.ac.ug', 'Mary Member');
  member = { token: m.token, id: m.user.id };
});

after(() => {
  server?.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

const DAY = 24 * 3600 * 1000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'IndabaX Kabale Day',
    description: 'A day of talks and a hackathon.',
    startsAt: iso(3 * DAY),
    endsAt: iso(3 * DAY + 8 * 3600 * 1000),
    venue: 'Main Hall',
    sessionIds: ['sess-ml-python', 'sess-git-workshop'],
    speakers: [{ name: 'Aisha Namukasa', role: 'Lecturer', bio: 'Teaches machine learning.' }],
    status: 'PUBLISHED',
    hackathon: false,
    ...overrides,
  };
}

describe('events and the event page', () => {
  let published: any;
  let draft: any;

  test('a member cannot create an event, a visitor gets 401', async () => {
    assert.equal((await call('POST', '/api/events', eventBody(), member.token)).status, 403);
    assert.equal((await call('POST', '/api/events', eventBody())).status, 401);
  });

  test('a host creates an event; the slug comes from the title and stays unique', async () => {
    const a = await call('POST', '/api/events', eventBody(), host.token);
    assert.equal(a.status, 201, JSON.stringify(a.json));
    published = a.json.event;
    assert.equal(published.slug, 'indabax-kabale-day');
    assert.equal(published.sessions.length, 2);
    assert.equal(published.canEdit, true);
    const b = await call('POST', '/api/events', eventBody(), host.token);
    assert.equal(b.json.event.slug, 'indabax-kabale-day-2');
  });

  test('draft events are hidden from members and visitors, and visible to the host and an admin', async () => {
    const d = await call('POST', '/api/events', eventBody({ title: 'Secret planning day', status: 'DRAFT' }), host.token);
    assert.equal(d.status, 201);
    draft = d.json.event;
    for (const token of [undefined, member.token]) {
      const list = await call('GET', '/api/events', undefined, token);
      assert.ok(!list.json.events.some((e: any) => e.id === draft.id), 'draft must not be listed');
      assert.equal((await call('GET', `/api/events/${draft.slug}`, undefined, token)).status, 404);
    }
    assert.equal((await call('GET', `/api/events/${draft.slug}`, undefined, host.token)).status, 200);
    assert.equal((await call('GET', `/api/events/${draft.slug}`, undefined, admin.token)).status, 200);
    const list = await call('GET', '/api/events', undefined, host.token);
    assert.ok(list.json.events.some((e: any) => e.id === draft.id));
  });

  test('everyone can read a published event, signed in or not', async () => {
    const r = await call('GET', `/api/events/${published.slug}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.event.canEdit, false);
    assert.equal(r.json.event.title, 'IndabaX Kabale Day');
  });

  test('a private class can never be part of an event', async () => {
    const r = await call('POST', '/api/events', eventBody({ sessionIds: ['class-bcs-3104'] }), host.token);
    assert.equal(r.status, 400);
    assert.match(r.json.message, /private/i);
    const patch = await call('PATCH', `/api/events/${published.id}`, { sessionIds: ['sess-ml-python', 'class-bcs-3104'] }, host.token);
    assert.equal(patch.status, 400);
  });

  test('bad input is refused: end before start, unknown session, http cover link, too long title', async () => {
    const cases: Array<Record<string, unknown>> = [
      { endsAt: iso(2 * DAY) },
      { sessionIds: ['does-not-exist'] },
      { coverUrl: 'http://example.com/cover.jpg' },
      { title: 'x'.repeat(500) },
      { startsAt: 'not a date' },
      { sessionIds: ['sess-ml-python', 'sess-ml-python'] },
    ];
    for (const c of cases) {
      assert.equal((await call('POST', '/api/events', eventBody(c), host.token)).status, 400, JSON.stringify(c));
    }
  });

  test('only the owner host or an admin can edit; the slug does not change', async () => {
    const other = await register('host2@kab.ac.ug', 'Other Host');
    await call('PATCH', `/api/admin/users/${other.user.id}/role`, { role: 'HOST' }, admin.token);
    assert.equal((await call('PATCH', `/api/events/${published.id}`, { title: 'Hijacked' }, other.token)).status, 403);
    assert.equal((await call('PATCH', `/api/events/${published.id}`, { title: 'Hijacked' }, member.token)).status, 403);
    const ok = await call('PATCH', `/api/events/${published.id}`, { title: 'IndabaX Kabale Day One' }, host.token);
    assert.equal(ok.status, 200);
    assert.equal(ok.json.event.slug, 'indabax-kabale-day');
    const byAdmin = await call('PATCH', `/api/events/${published.id}`, { venue: 'Hall B' }, admin.token);
    assert.equal(byAdmin.json.event.venue, 'Hall B');
  });
});
