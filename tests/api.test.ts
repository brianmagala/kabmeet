// Integration tests for the rules that protect Kabmeet: roles, admin setup, rate limits, private classes.
// They start the real server on a spare port with a throwaway data folder.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 3200 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;
let dataDir: string;
let setupCode = '';

async function call(method: string, url: string, body?: unknown, token?: string) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
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

async function register(email: string, extra: Record<string, unknown> = {}) {
  const r = await call('POST', '/api/auth/register', {
    email,
    fullName: 'Test Student',
    password: 'longpassword1',
    ...extra,
  });
  assert.equal(r.status, 201, `register ${email} failed: ${JSON.stringify(r.json)}`);
  return { token: r.json.accessToken as string, user: r.json.user };
}

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'kabmeet-test-'));
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      KABMEET_DATA_DIR: dataDir,
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

describe('first admin setup', () => {
  test('is refused without the right setup code', async () => {
    const none = await call('POST', '/api/auth/claim-admin', { password: 'longpassword1' });
    assert.equal(none.status, 400);
    const wrong = await call('POST', '/api/auth/claim-admin', { password: 'longpassword1', setupCode: 'wrong-code' });
    assert.equal(wrong.status, 403);
  });

  test('works once with the right code, then is closed', async () => {
    assert.ok(setupCode, 'setup code should be printed on first start');
    const ok = await call('POST', '/api/auth/claim-admin', { password: 'longpassword1', setupCode });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.user.role, 'ADMIN');
    const again = await call('POST', '/api/auth/claim-admin', { password: 'longpassword1', setupCode });
    assert.equal(again.status, 409);
  });
});

describe('roles', () => {
  test('registering always creates a MEMBER, even if the body asks for ADMIN', async () => {
    const r = await call('POST', '/api/auth/register', {
      email: 'sneaky@kab.ac.ug',
      fullName: 'Sneaky Student',
      password: 'longpassword1',
      role: 'ADMIN',
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.user.role, 'MEMBER');
  });

  test('a member cannot change roles, create sessions or create classes', async () => {
    const member = await register('member1@kab.ac.ug');
    const role = await call('PATCH', `/api/admin/users/${member.user.id}/role`, { role: 'ADMIN' }, member.token);
    assert.equal(role.status, 403);
    const session = await call(
      'POST',
      '/api/sessions',
      { title: 'My session', description: 'A session I should not create', communitySlug: 'kab-ai', mode: 'WATCH' },
      member.token,
    );
    assert.equal(session.status, 403);
    const cls = await call(
      'POST',
      '/api/classes',
      { courseCode: 'BCS101', title: 'Intro class', description: 'Not allowed', allowedStudents: ['a@b.com'] },
      member.token,
    );
    assert.equal(cls.status, 403);
  });

  test('someone not signed in is turned away from protected routes', async () => {
    assert.equal((await call('GET', '/api/admin/overview')).status, 401);
    assert.equal((await call('GET', '/api/profile/dashboard')).status, 401);
  });
});

describe('private classes', () => {
  test('only allowed students and staff can open a private class', async () => {
    const admin = await call('POST', '/api/auth/login', { email: 'admin@ai.kab.ac.ug', password: 'longpassword1' });
    assert.equal(admin.status, 200);
    const created = await call(
      'POST',
      '/api/classes',
      {
        courseCode: 'BCS2104',
        title: 'Data coding and encryption',
        description: 'Private class for enrolled students',
        allowedStudents: ['enrolled@kab.ac.ug'],
      },
      admin.json.accessToken,
    );
    assert.equal(created.status, 201);
    const id = created.json.classSession.id;

    const outsider = await register('outsider@kab.ac.ug');
    assert.equal((await call('GET', `/api/sessions/${id}`, undefined, outsider.token)).status, 403);
    assert.equal((await call('GET', `/api/sessions/${id}`)).status, 403);

    const enrolled = await register('enrolled@kab.ac.ug');
    assert.equal((await call('GET', `/api/sessions/${id}`, undefined, enrolled.token)).status, 200);
  });
});

describe('rate limits', () => {
  test('too many sign-in attempts are blocked with 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 14; i++) {
      codes.push((await call('POST', '/api/auth/login', { email: 'nobody@kab.ac.ug', password: 'bad-password' })).status);
    }
    assert.ok(codes.includes(401), 'early attempts are normal failures');
    assert.ok(codes.includes(429), `expected a 429 in ${codes.join(',')}`);
  });
});
