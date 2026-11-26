// Task 7: staying signed in with an httpOnly cookie, and the CSRF rules that make that safe.
// Starts the real server on a spare port with a throwaway data folder.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const PORT = 4300 + Math.floor(Math.random() * 500);
const HOST = `127.0.0.1:${PORT}`;
const BASE = `http://${HOST}`;
let server: ChildProcess;
let dataDir: string;

interface Reply {
  status: number;
  json: any;
  cookies: string[];
}

async function send(method: string, url: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<Reply> {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, cookies: res.headers.getSetCookie() };
}

/** Turns Set-Cookie lines into the Cookie header a browser would send back, plus the CSRF value. */
function jar(cookies: string[]) {
  const pairs = cookies.map((c) => c.split(';')[0]).filter((p) => !p.endsWith('='));
  const value = (name: string) => pairs.find((p) => p.startsWith(`${name}=`))?.slice(name.length + 1);
  return { header: pairs.join('; '), csrf: value('kab_csrf') ?? '', session: value('kab_session') ?? '' };
}

const cookieLine = (cookies: string[], name: string) => cookies.find((c) => c.startsWith(`${name}=`)) ?? '';

async function register(email: string, headers: Record<string, string> = {}) {
  const r = await send('POST', '/api/auth/register', {
    body: { email, fullName: 'Cookie Student', password: 'longpassword1' },
    headers,
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r;
}

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'kabmeet-session-test-'));
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), KABMEET_DATA_DIR: dataDir, ADMIN_PASSCODE: '', ADMIN_SETUP_CODE: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start in 30 s')), 30_000);
    server.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('running on')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', () => reject(new Error('server exited early')));
  });
});

/** One signed-in student shared by the tests that only need "someone signed in" (registering is rate limited). */
let shared: { reply: Reply; header: string; csrf: string };

after(() => {
  server?.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

describe('session cookie', () => {
  before(async () => {
    const reply = await register('shared@kab.ac.ug');
    shared = { reply, ...jar(reply.cookies) };
  });

  test('sign-in sets an httpOnly, SameSite=Lax session cookie and a readable CSRF cookie', async () => {
    const r = await register('flags@kab.ac.ug');
    const session = cookieLine(r.cookies, 'kab_session');
    const csrf = cookieLine(r.cookies, 'kab_csrf');
    assert.match(session, /HttpOnly/);
    assert.match(session, /SameSite=Lax/);
    assert.match(session, /Path=\//);
    assert.match(session, /Max-Age=\d+/);
    assert.doesNotMatch(csrf, /HttpOnly/, 'the page must be able to read the CSRF value');
    assert.match(csrf, /SameSite=Lax/);
  });

  test('behind https (X-Forwarded-Proto) both cookies are Secure; on plain http they are not', async () => {
    assert.doesNotMatch(cookieLine(shared.reply.cookies, 'kab_session'), /Secure/);
    const behindProxy = await register('secure@kab.ac.ug', { 'x-forwarded-proto': 'https' });
    assert.match(cookieLine(behindProxy.cookies, 'kab_session'), /Secure/);
    assert.match(cookieLine(behindProxy.cookies, 'kab_csrf'), /Secure/);
  });

  test('the cookie alone restores the session (what a page refresh does)', async () => {
    const s = await send('GET', '/api/auth/session', { headers: { cookie: shared.header } });
    assert.equal(s.json.authenticated, true);
    assert.equal(s.json.user.email, 'shared@kab.ac.ug');
  });

  test('without any cookie the visitor stays signed out', async () => {
    const s = await send('GET', '/api/auth/session');
    assert.equal(s.json.authenticated, false);
  });

  test('a cookie that matches no sign-in is cleared and treated as signed out', async () => {
    const s = await send('GET', '/api/auth/session', { headers: { cookie: 'kab_session=not-a-real-token' } });
    assert.equal(s.json.authenticated, false);
    assert.match(cookieLine(s.cookies, 'kab_session'), /Max-Age=0/);
  });
});

describe('CSRF protection', () => {
  const profile = { fullName: 'Changed Name' };

  test('a cookie-signed write with no CSRF header is refused', async () => {
    const { header } = shared;
    const r = await send('PATCH', '/api/profile', { body: profile, headers: { cookie: header } });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'CSRF');
  });

  test('a wrong CSRF header is refused, the right one works', async () => {
    const { header, csrf } = shared;
    const bad = await send('PATCH', '/api/profile', { body: profile, headers: { cookie: header, 'x-csrf-token': 'x'.repeat(csrf.length) } });
    assert.equal(bad.status, 403);
    const ok = await send('PATCH', '/api/profile', { body: profile, headers: { cookie: header, 'x-csrf-token': csrf } });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.user.fullName, 'Changed Name');
  });

  test('a write from another site is refused even with a valid CSRF header', async () => {
    const { header, csrf } = shared;
    const r = await send('PATCH', '/api/profile', {
      body: profile,
      headers: { cookie: header, 'x-csrf-token': csrf, origin: 'https://evil.example' },
    });
    assert.equal(r.status, 403);
    const sameSite = await send('PATCH', '/api/profile', {
      body: profile,
      headers: { cookie: header, 'x-csrf-token': csrf, origin: BASE },
    });
    assert.equal(sameSite.status, 200);
  });

  test('sign-in refuses a cross-site origin, and works with a stale cookie from this site', async () => {
    const cross = await send('POST', '/api/auth/login', {
      body: { email: 'shared@kab.ac.ug', password: 'longpassword1' },
      headers: { cookie: 'kab_session=old', origin: 'https://evil.example' },
    });
    assert.equal(cross.status, 403);
    const stale = await send('POST', '/api/auth/login', {
      body: { email: 'shared@kab.ac.ug', password: 'longpassword1' },
      headers: { cookie: 'kab_session=old', origin: BASE },
    });
    assert.equal(stale.status, 200);
    assert.ok(cookieLine(stale.cookies, 'kab_session'));
  });

  test('Bearer-token clients (scripts, tests) need no CSRF header', async () => {
    const r = await send('PATCH', '/api/profile', { body: profile, headers: { authorization: `Bearer ${shared.reply.json.accessToken}` } });
    assert.equal(r.status, 200);
  });
});

describe('sign-out', () => {
  test('clears both cookies and the old cookie stops working', async () => {
    const { header, csrf } = jar((await register('bye@kab.ac.ug')).cookies);
    const out = await send('POST', '/api/auth/logout', { headers: { cookie: header, 'x-csrf-token': csrf } });
    assert.equal(out.status, 200);
    assert.match(cookieLine(out.cookies, 'kab_session'), /Max-Age=0/);
    assert.match(cookieLine(out.cookies, 'kab_csrf'), /Max-Age=0/);
    const after = await send('GET', '/api/auth/session', { headers: { cookie: header } });
    assert.equal(after.json.authenticated, false);
  });

  test('sign-out without the CSRF header is refused, so another site cannot sign you out', async () => {
    const { header } = shared;
    const out = await send('POST', '/api/auth/logout', { headers: { cookie: header } });
    assert.equal(out.status, 403);
    const still = await send('GET', '/api/auth/session', { headers: { cookie: header } });
    assert.equal(still.json.authenticated, true);
  });
});

describe('websocket with the session cookie', () => {
  /** Opens the socket, tries to post a chat line, and reports whether the server refused it. */
  function tryChat(headers: Record<string, string>): Promise<{ refused: boolean }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${HOST}/ws?sessionId=sess-ml-python`, { headers });
      const events: Array<{ event: string; payload: any }> = [];
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        events.push(msg);
        if (msg.event === 'session:init') ws.send(JSON.stringify({ event: 'chat:send', payload: { text: 'hello from a cookie' } }));
      });
      ws.on('error', reject);
      setTimeout(() => {
        ws.close();
        resolve({ refused: events.some((e) => e.event === 'error') });
      }, 600);
    });
  }

  test('a signed-in browser is recognised from its cookie, with no token in the address', async () => {
    assert.equal((await tryChat({ cookie: shared.header, origin: BASE })).refused, false);
  });

  test('the cookie is ignored when the socket is opened from another site', async () => {
    assert.equal((await tryChat({ cookie: shared.header, origin: 'https://evil.example' })).refused, true);
  });

  test('no cookie means a visitor who cannot post', async () => {
    assert.equal((await tryChat({ origin: BASE })).refused, true);
  });
});
