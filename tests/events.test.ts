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

// ---------------------------------------------------------------------------------------------
// Step 2: hackathon tools

describe('hackathon teams, judging and privacy', () => {
  let ev: any;
  // Seven people: team A (creator + joiners), a person for a second team, two judges (one is the host).
  const people: Record<string, { token: string; id: string }> = {};

  before(async () => {
    for (const [key, name] of [['b', 'Brenda'], ['c', 'Charles'], ['d', 'Diana'], ['e', 'Edwin'], ['f', 'Fiona'], ['judge', 'Jude Judge']]) {
      const r = await register(`${key}.team@kab.ac.ug`, `${name} Student`);
      people[key] = { token: r.token, id: r.user.id };
    }
    // The event is live now so that teams are open, and it ends later today.
    const created = await call(
      'POST',
      '/api/events',
      eventBody({ title: 'Kabale Hack Day', startsAt: iso(-3600_000), endsAt: iso(6 * 3600_000), hackathon: true, sessionIds: ['sess-ml-python'] }),
      host.token,
    );
    assert.equal(created.status, 201, JSON.stringify(created.json));
    ev = created.json.event;
  });

  const hack = (token?: string) => call('GET', `/api/events/${ev.id}/hackathon`, undefined, token);
  const createTeam = (token: string, name: string) => call('POST', `/api/events/${ev.id}/teams`, { name, idea: 'Predict crop disease from phone photos.' }, token);
  const joinTeam = (token: string, code: string) => call('POST', `/api/events/${ev.id}/teams/join`, { code }, token);

  let teamA: any;
  let teamB: any;

  test('hackathon tools only exist on events that switched hackathon mode on', async () => {
    const plain = await call('POST', '/api/events', eventBody({ title: 'Plain talk day' }), host.token);
    const r = await call('POST', `/api/events/${plain.json.event.id}/teams`, { name: 'Nope', idea: 'x' }, member.token);
    assert.equal(r.status, 404);
  });

  test('a member creates a team and gets a 6-character join code; other teams cannot see it', async () => {
    const r = await createTeam(member.token, 'Kabale Coders');
    assert.equal(r.status, 201, JSON.stringify(r.json));
    teamA = r.json.team;
    assert.match(teamA.joinCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(teamA.members.length, 1);
    // Others see the team but not its code.
    const asOther = await hack(people.b.token);
    assert.equal(asOther.json.teams[0].joinCode, null);
    assert.equal((await hack()).json.teams[0].joinCode, null);
    // Team mates and the host see it.
    assert.equal((await hack(member.token)).json.teams[0].joinCode, teamA.joinCode);
    assert.equal((await hack(host.token)).json.teams[0].joinCode, teamA.joinCode);
  });

  test('a join code works once per person, a person cannot be in two teams, and a visitor cannot join', async () => {
    assert.equal((await joinTeam(people.b.token, teamA.joinCode)).status, 200);
    assert.equal((await joinTeam(people.b.token, teamA.joinCode)).status, 409, 'same person, same code');
    assert.equal((await createTeam(people.b.token, 'Second Team')).status, 409, 'cannot start another team');
    const second = await createTeam(people.c.token, 'Night Owls');
    assert.equal(second.status, 201);
    teamB = second.json.team;
    assert.equal((await joinTeam(people.b.token, teamB.joinCode)).status, 409, 'cannot join a second team');
    assert.equal((await call('POST', `/api/events/${ev.id}/teams/join`, { code: teamA.joinCode })).status, 401);
    assert.equal((await joinTeam(people.d.token, 'ZZZZZZ')).status, 404);
    assert.equal((await createTeam(people.d.token, 'kabale coders')).status, 409, 'team names are unique');
  });

  test('a team holds at most 5 people', async () => {
    assert.equal((await joinTeam(people.d.token, teamA.joinCode)).status, 200); // 3
    assert.equal((await joinTeam(people.e.token, teamA.joinCode)).status, 200); // 4
    assert.equal((await joinTeam(people.f.token, teamA.joinCode)).status, 200); // 5
    assert.equal((await joinTeam(people.judge.token, teamA.joinCode)).status, 409);
  });

  test('only the creator renames; any member can submit; links must be https', async () => {
    const url = `/api/events/${ev.id}/teams/${teamA.id}`;
    assert.equal((await call('PATCH', url, { name: 'Hijack' }, people.b.token)).status, 403);
    assert.equal((await call('PATCH', url, { name: 'Kabale Coders Pro' }, member.token)).status, 200);
    assert.equal((await call('PATCH', url, { repoUrl: 'http://github.com/kab/x' }, people.b.token)).status, 400);
    const ok = await call('PATCH', url, { repoUrl: 'https://github.com/kab/crop-ai', summary: 'We detect crop disease from a phone photo. It works offline.' }, people.b.token);
    assert.equal(ok.status, 200);
    assert.equal(ok.json.team.repoUrl, 'https://github.com/kab/crop-ai');
    assert.equal((await call('PATCH', url, { summary: 'Not mine' }, people.judge.token)).status, 403);
  });

  test('only the host sets a demo slot', async () => {
    const url = `/api/events/${ev.id}/teams/${teamA.id}/demo`;
    assert.equal((await call('PUT', url, { demoAt: iso(3600_000) }, member.token)).status, 403);
    const ok = await call('PUT', url, { demoAt: iso(3600_000) }, host.token);
    assert.equal(ok.status, 200);
    assert.ok(ok.json.team.demoAt);
  });

  test('the creator can remove a member; a member can leave; the team passes to the next person', async () => {
    const del = (token: string, userId: string) => call('DELETE', `/api/events/${ev.id}/teams/${teamA.id}/members/${userId}`, undefined, token);
    assert.equal((await del(people.b.token, people.d.id)).status, 403, 'a member cannot remove another');
    assert.equal((await del(member.token, people.d.id)).status, 200);
    assert.equal((await del(people.e.token, people.e.id)).status, 200, 'leave');
    // d is free to join another team now
    assert.equal((await joinTeam(people.d.token, teamB.joinCode)).status, 200);
  });

  // ----- judging -----
  test('only the host adds judges, by the email of an existing account', async () => {
    const url = `/api/events/${ev.id}/judges`;
    assert.equal((await call('POST', url, { email: 'judge.team@kab.ac.ug' }, member.token)).status, 403);
    assert.equal((await call('POST', url, { email: 'nobody@kab.ac.ug' }, host.token)).status, 404);
    assert.equal((await call('POST', url, { email: 'b.team@kab.ac.ug' }, host.token)).status, 201); // Brenda judges, but is in team A
    assert.equal((await call('POST', url, { email: 'judge.team@kab.ac.ug' }, host.token)).status, 201);
    assert.equal((await call('POST', url, { email: 'judge.team@kab.ac.ug' }, host.token)).status, 409);
  });

  const score = (token: string, teamId: string, body: Record<string, unknown> = {}) =>
    call('PUT', `/api/events/${ev.id}/scores/${teamId}`, { idea: 4, build: 3, demo: 5, impact: 4, comment: 'Clear problem, rough demo.', ...body }, token);

  test('a judge cannot score their own team, a non-judge cannot score, scores must be whole numbers 1 to 5', async () => {
    const own = await score(people.b.token, teamA.id);
    assert.equal(own.status, 403);
    assert.equal(own.json.code, 'OWN_TEAM');
    assert.equal((await score(member.token, teamB.id)).status, 403);
    assert.equal((await score(people.judge.token, teamA.id, { idea: 6 })).status, 400);
    assert.equal((await score(people.judge.token, teamA.id, { build: 0 })).status, 400);
    assert.equal((await score(people.judge.token, teamA.id, { demo: 3.5 })).status, 400);
  });

  test('scores and comments are private before the reveal, visible to judges (their own) and the host only', async () => {
    assert.equal((await score(people.judge.token, teamA.id, { comment: 'SECRET-COMMENT-ONE' })).status, 200);
    assert.equal((await score(people.judge.token, teamB.id, { idea: 2, build: 2, demo: 2, impact: 2, comment: 'SECRET-COMMENT-TWO' })).status, 200);
    assert.equal((await score(people.b.token, teamB.id, { idea: 3, build: 3, demo: 3, impact: 3, comment: 'SECRET-COMMENT-THREE' })).status, 200);

    for (const [who, token] of [['visitor', undefined], ['member', member.token], ['team mate', people.d.token], ['other host', undefined]] as const) {
      if (who === 'other host') continue;
      const view = await hack(token);
      const text = JSON.stringify(view.json);
      assert.ok(!text.includes('SECRET-COMMENT'), `${who} must not see comments`);
      assert.equal(view.json.results, null, `${who} must not see results`);
      assert.deepEqual(view.json.myScores, []);
      assert.equal(view.json.judging, null);
    }
    // A judge sees only their own scores.
    const judgeView = await hack(people.b.token);
    const judgeText = JSON.stringify(judgeView.json);
    assert.ok(judgeText.includes('SECRET-COMMENT-THREE'));
    assert.ok(!judgeText.includes('SECRET-COMMENT-ONE') && !judgeText.includes('SECRET-COMMENT-TWO'), 'a judge must not see other judges');
    assert.equal(judgeView.json.myScores.length, 1);
    // The host sees everything and who has scored how many teams.
    const hostView = await hack(host.token);
    assert.equal(hostView.json.judging.scores.length, 3);
    assert.ok(JSON.stringify(hostView.json).includes('SECRET-COMMENT-ONE'));
    // The event itself never carries scores.
    const plain = JSON.stringify((await call('GET', `/api/events/${ev.slug}`, undefined, host.token)).json);
    assert.ok(!plain.includes('SECRET-COMMENT'));
  });

  test('only the host can reveal; after the reveal everyone sees the ranking with averages, never comments', async () => {
    assert.equal((await call('POST', `/api/events/${ev.id}/reveal`, {}, member.token)).status, 403);
    assert.equal((await call('POST', `/api/events/${ev.id}/reveal`, {}, people.judge.token)).status, 403);
    const r = await call('POST', `/api/events/${ev.id}/reveal`, {}, host.token);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await call('POST', `/api/events/${ev.id}/reveal`, {}, host.token)).status, 409);

    const view = await hack(); // a visitor
    assert.ok(view.json.resultsRevealed);
    const ranking = view.json.results.ranking;
    assert.equal(ranking.length, 2);
    // Team A: one judge, (4+3+5+4)/4 = 4. Team B: two judges, ((2+3)/2 each) = 2.5.
    assert.equal(ranking[0].teamName, 'Kabale Coders Pro');
    assert.equal(ranking[0].rank, 1);
    assert.deepEqual(ranking[0].average, { idea: 4, build: 3, demo: 5, impact: 4 });
    assert.equal(ranking[0].total, 4);
    assert.equal(ranking[1].teamName, 'Night Owls');
    assert.equal(ranking[1].total, 2.5);
    assert.ok(!JSON.stringify(view.json).includes('SECRET-COMMENT'));
    // Locked afterwards.
    assert.equal((await score(people.judge.token, teamB.id)).status, 409);
  });
});

describe('ranking rules', () => {
  test('ties share a rank and unscored teams are left out', async () => {
    const { computeRanking } = await import('../server/events');
    const mk = (teamId: string, v: number) => ({ teamId, idea: v, build: v, demo: v, impact: v });
    const ranking = computeRanking(
      [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }, { id: 'd', name: 'Delta' }],
      [mk('a', 5), mk('b', 5), mk('c', 3)],
    );
    assert.deepEqual(ranking.map((r) => [r.teamName, r.rank]), [['Alpha', 1], ['Beta', 1], ['Gamma', 3]]);
  });
});

// ---------------------------------------------------------------------------------------------
// Step 3: certificates

describe('certificates', () => {
  const SESSIONS = ['sess-ml-python', 'sess-git-workshop', 'sess-indabax-vision', 'sess-kabai-pytorch'];
  let day: any;
  let hackEvent: any;
  const T: Record<string, { token: string; id: string }> = {};

  before(async () => {
    // People from the hackathon tests are signed in again with a fresh login (no new registrations).
    for (const [key, email] of [['e', 'e.team@kab.ac.ug'], ['judge', 'judge.team@kab.ac.ug'], ['d', 'd.team@kab.ac.ug'], ['f', 'f.team@kab.ac.ug'], ['b', 'b.team@kab.ac.ug']] as const) {
      const r = await call('POST', '/api/auth/login', { email, password: 'longpassword1' });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      T[key] = { token: r.json.accessToken, id: r.json.user.id };
    }
    // An event that is already over, with four public sessions: attending two of them is exactly half.
    const created = await call(
      'POST',
      '/api/events',
      eventBody({ title: 'IndabaX Certificates Day', startsAt: iso(-2 * DAY), endsAt: iso(-1 * DAY), sessionIds: SESSIONS }),
      host.token,
    );
    assert.equal(created.status, 201, JSON.stringify(created.json));
    day = created.json.event;
    // Attendance is real: stay connected to the session long enough.
    await Promise.all([
      attend(SESSIONS[0], T.e.token),
      attend(SESSIONS[1], T.e.token),
      attend(SESSIONS[0], T.judge.token),
    ]);
  });

  const status = (eventId: string, token?: string) => call('GET', `/api/events/${eventId}/certificate/status`, undefined, token);
  const download = (eventId: string, token?: string) => call('GET', `/api/events/${eventId}/certificate`, undefined, token);

  test('a visitor gets 401; an unpublished event looks missing', async () => {
    assert.equal((await download(day.id)).status, 401);
    const draftEvt = await call('POST', '/api/events', eventBody({ title: 'Draft certs', status: 'DRAFT', startsAt: iso(-2 * DAY), endsAt: iso(-1 * DAY) }), host.token);
    assert.equal((await download(draftEvt.json.event.id, member.token)).status, 404);
  });

  test('nothing is issued before the event ends', async () => {
    const live = await call('POST', '/api/events', eventBody({ title: 'Still running', startsAt: iso(-3600_000), endsAt: iso(3600_000) }), host.token);
    const r = await download(live.json.event.id, member.token);
    assert.equal(r.status, 409);
    assert.equal(r.json.code, 'NOT_ENDED');
  });

  test('attending at least half of the public sessions earns a certificate; less does not', async () => {
    const ok = await status(day.id, T.e.token);
    assert.equal(ok.json.available, true);
    assert.equal(ok.json.kind, 'ATTENDANCE');
    assert.equal(ok.json.attended, 2);
    assert.equal(ok.json.total, 4);
    assert.equal(ok.json.needed, 2);

    const short = await download(day.id, T.judge.token); // 1 of 4
    assert.equal(short.status, 403);
    assert.match(short.json.message, /1 of 4/);
    assert.equal((await download(day.id, T.f.token)).status, 403); // 0 of 4
  });

  let code = '';
  test('the PDF downloads, carries the code, and asking again returns the same certificate', async () => {
    const r = await download(day.id, T.e.token);
    assert.equal(r.status, 200);
    assert.match(r.type, /application\/pdf/);
    assert.equal(r.raw.subarray(0, 5).toString('latin1'), '%PDF-');
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.load(r.raw);
    assert.equal(pdf.getPageCount(), 1);
    assert.match(pdf.getTitle() ?? '', /Edwin Student/);
    const st = await status(day.id, T.e.token);
    code = st.json.code;
    assert.match(code, /^KAB-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
    await download(day.id, T.e.token);
    assert.equal((await status(day.id, T.e.token)).json.code, code, 'same person, same code');
  });

  test('anyone can verify a code; only name, event, date and kind come back', async () => {
    const r = await call('GET', `/api/verify/${code.toLowerCase()}`);
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json).sort(), ['code', 'eventDate', 'eventTitle', 'kind', 'name', 'valid']);
    assert.equal(r.json.valid, true);
    assert.equal(r.json.name, 'Edwin Student');
    assert.equal(r.json.eventTitle, 'IndabaX Certificates Day');
    assert.equal(r.json.kind, 'ATTENDANCE');
    assert.ok(!JSON.stringify(r.json).includes('@'), 'no email');
  });

  test('unknown or malformed codes are 404', async () => {
    for (const bad of ['KAB-2026-ZZZZ', 'nope', 'KAB-26-AB', '../etc/passwd']) {
      assert.equal((await call('GET', `/api/verify/${encodeURIComponent(bad)}`)).status, 404, bad);
    }
  });

  test('winners and runners-up get an achievement certificate; attendance and no-shows are handled separately', async () => {
    // The Hack Day from the judging tests is over now: move its dates into the past.
    const list = await call('GET', '/api/events', undefined, host.token);
    hackEvent = list.json.events.find((e: any) => e.title === 'Kabale Hack Day');
    const moved = await call('PATCH', `/api/events/${hackEvent.id}`, { startsAt: iso(-3 * 3600_000), endsAt: iso(-3600_000) }, host.token);
    assert.equal(moved.status, 200, JSON.stringify(moved.json));

    const winner = await status(hackEvent.id, member.token); // Kabale Coders Pro won
    assert.equal(winner.json.kind, 'WINNER');
    const runner = await status(hackEvent.id, T.d.token); // Night Owls came second
    assert.equal(runner.json.kind, 'RUNNER_UP');
    const pdf = await download(hackEvent.id, member.token);
    assert.equal(pdf.status, 200);
    const v = await call('GET', `/api/verify/${(await status(hackEvent.id, member.token)).json.code}`);
    assert.equal(v.json.kind, 'WINNER');
    assert.equal(v.json.eventTitle, 'Kabale Hack Day');
    // Someone with no team who attended its one public session gets the attendance certificate (Jude did)...
    assert.equal((await status(hackEvent.id, T.judge.token)).json.kind, 'ATTENDANCE');
    // ...and someone with no team who did not attend gets nothing.
    assert.equal((await download(hackEvent.id, admin.token)).status, 403);
  });

  test('codes are unique across certificates', async () => {
    const codes = new Set<string>();
    for (const [eid, token] of [[day.id, T.e.token], [hackEvent.id, member.token], [hackEvent.id, T.d.token]] as const) {
      await download(eid, token);
      codes.add((await status(eid, token)).json.code);
    }
    assert.equal(codes.size, 3);
  });
});
