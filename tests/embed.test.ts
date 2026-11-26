// Embedding in ai.kab.ac.ug/indabax: who may frame Kabmeet, and the cookie mode for a cross-site frame.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 4200 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;
let dataDir: string;

function start(env: Record<string, string>): Promise<string> {
  dataDir = mkdtempSync(path.join(tmpdir(), 'kabmeet-embed-'));
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), KABMEET_DATA_DIR: dataDir, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let code = '';
    let warnings = '';
    const timer = setTimeout(() => reject(new Error('server did not start in 30 s')), 30_000);
    server.stderr!.on('data', (c: Buffer) => (warnings += c.toString()));
    server.stdout!.on('data', (c: Buffer) => {
      const m = c.toString().match(/setup code: ([a-f0-9]+)/i);
      if (m) code = m[1];
      if (code) {
        clearTimeout(timer);
        resolve(code + '|' + warnings);
      }
    });
    server.on('exit', () => reject(new Error('server exited early')));
  });
}

describe('framing and cookies', () => {
  let setupCode = '';
  before(async () => {
    const out = await start({
      EMBED_ORIGINS: 'https://ai.kab.ac.ug, https://club.example.org/path not-a-url',
      COOKIE_SAMESITE: 'none',
    });
    setupCode = out.split('|')[0];
  });
  after(() => {
    server?.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });

  test('only the listed sites may frame Kabmeet, and the old SAMEORIGIN header is gone', async () => {
    const res = await fetch(BASE + '/api/health').catch(() => fetch(BASE + '/'));
    const csp = res.headers.get('content-security-policy') ?? '';
    assert.match(csp, /frame-ancestors 'self' https:\/\/ai\.kab\.ac\.ug$/, csp);
    assert.ok(!csp.includes('club.example.org'), 'an entry with a path is ignored');
    assert.equal(res.headers.get('x-frame-options'), null, 'X-Frame-Options would block the embed');
  });

  test('SameSite=None is used only on https, with Secure', async () => {
    const body = JSON.stringify({ password: 'longpassword1', setupCode });
    const http = await fetch(BASE + '/api/auth/claim-admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    assert.equal(http.status, 201);
    const plain = http.headers.getSetCookie().join('\n');
    assert.match(plain, /SameSite=Lax/, 'plain http keeps Lax because None without Secure is rejected by browsers');
    assert.ok(!/SameSite=None/.test(plain));

    const reg = JSON.stringify({ email: 'embed@kab.ac.ug', fullName: 'Embed Tester', password: 'longpassword1' });
    const https = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
      body: reg,
    });
    assert.equal(https.status, 201);
    const secure = https.headers.getSetCookie();
    const session = secure.find((c) => c.startsWith('kab_session='))!;
    assert.match(session, /SameSite=None/);
    assert.match(session, /Secure/);
    assert.match(session, /HttpOnly/);
  });
});

describe('blank embed list', () => {
  test('a blank EMBED_ORIGINS means no other site may frame Kabmeet', async () => {
    const port2 = PORT + 1000;
    const dir = mkdtempSync(path.join(tmpdir(), 'kabmeet-embed2-'));
    const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
      env: { ...process.env, NODE_ENV: 'production', PORT: String(port2), KABMEET_DATA_DIR: dir, EMBED_ORIGINS: '', COOKIE_SAMESITE: '' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no start')), 30_000);
        child.stdout!.on('data', (c: Buffer) => {
          if (/setup code/i.test(c.toString())) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      const res = await fetch(`http://127.0.0.1:${port2}/`);
      assert.match(res.headers.get('content-security-policy') ?? '', /frame-ancestors 'self'$/, 'empty list means self only');
    } finally {
      child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
