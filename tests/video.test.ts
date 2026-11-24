// Tests for Task 1 (video). They check the rules the server must enforce, not the picture itself:
// who may get a video token, who may send video, and what happens when no media server is set up.
// Each test group starts the real server on a spare port with a throwaway data folder.
// No LiveKit server is needed: tokens are signed locally, and calls to the media server fail quietly.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

interface RunningServer {
  base: string;
  setupCode: string;
  stop: () => void;
}

async function startServer(extraEnv: Record<string, string>): Promise<RunningServer> {
  const port = 3700 + Math.floor(Math.random() * 600);
  const dataDir = mkdtempSync(path.join(tmpdir(), 'kabmeet-video-test-'));
  const child: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      KABMEET_DATA_DIR: dataDir,
      ADMIN_PASSCODE: '',
      ADMIN_SETUP_CODE: '',
      LIVEKIT_URL: '',
      LIVEKIT_API_KEY: '',
      LIVEKIT_API_SECRET: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let setupCode = '';
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start in 30 s')), 30_000);
    child.stdout!.on('data', (chunk: Buffer) => {
      const match = chunk.toString().match(/setup code: ([a-f0-9]+)/);
      if (match) {
        setupCode = match[1];
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', () => reject(new Error('server exited early')));
  });
  return {
    base: `http://127.0.0.1:${port}`,
    setupCode,
    stop: () => {
      child.kill();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

async function call(base: string, method: string, url: string, body?: unknown, token?: string) {
  const res = await fetch(base + url, {
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

async function register(base: string, email: string) {
  const r = await call(base, 'POST', '/api/auth/register', {
    email,
    fullName: 'Test Student',
    password: 'longpassword1',
  });
  assert.equal(r.status, 201, `register ${email} failed: ${JSON.stringify(r.json)}`);
  return { token: r.json.accessToken as string, user: r.json.user };
}

/** Reads the claims out of a signed token without checking the signature (the server signed it). */
function decodeToken(jwt: string): any {
  return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
}

/** A tiny websocket client that keeps every message so tests can wait for what they need. */
class RoomSocket {
  readonly inbox: Array<{ event: string; payload: any }> = [];
  clientId = '';
  private readonly ws: WebSocket;

  constructor(base: string, sessionId: string, token: string) {
    this.ws = new WebSocket(`${base.replace('http', 'ws')}/ws?sessionId=${sessionId}&token=${token}`);
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.event === 'session:init') this.clientId = msg.payload.clientId;
      this.inbox.push(msg);
    });
  }

  get open(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  send(event: string, payload: Record<string, unknown> = {}): void {
    this.ws.send(JSON.stringify({ event, payload }));
  }

  /** Waits until the latest room:state satisfies the check. */
  async waitForRoom(check: (room: { participants: any[]; waitingRoom: any[] }) => boolean): Promise<void> {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      for (let i = this.inbox.length - 1; i >= 0; i--) {
        if (this.inbox[i].event === 'room:state') {
          if (check(this.inbox[i].payload)) return;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('timed out waiting for the room state');
  }

  async ready(): Promise<void> {
    const deadline = Date.now() + 5000;
    while (!this.clientId && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25));
    assert.ok(this.clientId, 'websocket should be connected');
  }

  close(): void {
    this.ws.close();
  }
}

const LIVEKIT_ENV = {
  LIVEKIT_URL: 'ws://127.0.0.1:7880',
  LIVEKIT_API_KEY: 'testkey',
  LIVEKIT_API_SECRET: 'test-secret-that-is-long-enough-for-hs256',
};

describe('video tokens (video configured)', () => {
  let server: RunningServer;
  let adminToken = '';
  let adminId = '';
  let roomId = '';
  let classId = '';
  const sockets: RoomSocket[] = [];

  before(async () => {
    server = await startServer(LIVEKIT_ENV);
    const claimed = await call(server.base, 'POST', '/api/auth/claim-admin', {
      password: 'longpassword1',
      setupCode: server.setupCode,
    });
    assert.equal(claimed.status, 201);
    adminToken = claimed.json.accessToken;
    adminId = claimed.json.user.id;

    const room = await call(
      server.base,
      'POST',
      '/api/sessions',
      {
        title: 'Git workshop for beginners',
        description: 'Hands-on session for first-year students.',
        communitySlug: 'kab-ai',
        mode: 'ROOM',
        startNow: true,
      },
      adminToken,
    );
    assert.equal(room.status, 201, JSON.stringify(room.json));
    roomId = room.json.session.id;

    const cls = await call(
      server.base,
      'POST',
      '/api/classes',
      {
        courseCode: 'BCS3104',
        title: 'Distributed systems',
        description: 'Private class for enrolled students',
        allowedStudents: ['enrolled@kab.ac.ug'],
      },
      adminToken,
    );
    assert.equal(cls.status, 201, JSON.stringify(cls.json));
    classId = cls.json.classSession.id;
  });

  after(() => {
    sockets.forEach((s) => s.close());
    server?.stop();
  });

  async function joinRoom(sessionId: string, token: string, requireWaitingRoom = true): Promise<RoomSocket> {
    const socket = new RoomSocket(server.base, sessionId, token);
    sockets.push(socket);
    await socket.ready();
    socket.send('room:join', { requireWaitingRoom });
    return socket;
  }

  const tokenFor = (sessionId: string, token?: string) =>
    call(server.base, 'POST', `/api/sessions/${sessionId}/video-token`, undefined, token);

  test('someone who is not signed in gets nothing', async () => {
    assert.equal((await tokenFor(roomId)).status, 401);
  });

  test('an unknown session is a 404', async () => {
    const member = await register(server.base, 'lost@kab.ac.ug');
    assert.equal((await tokenFor('no-such-session', member.token)).status, 404);
  });

  test('people outside a private class are refused, enrolled students get a view-only token', async () => {
    const outsider = await register(server.base, 'outsider@kab.ac.ug');
    assert.equal((await tokenFor(classId, outsider.token)).status, 403);

    const enrolled = await register(server.base, 'enrolled@kab.ac.ug');
    await joinRoom(classId, enrolled.token);
    const ok = await tokenFor(classId, enrolled.token);
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.configured, true);
    assert.equal(ok.json.canPublish, false);
    const claims = decodeToken(ok.json.token);
    assert.equal(claims.video.canPublish, false);
    assert.equal(claims.video.room, `kabmeet-${classId}`);
    assert.equal(claims.sub, enrolled.user.id);
  });

  test('a member who has not joined an open room yet gets no token', async () => {
    const member = await register(server.base, 'notjoined@kab.ac.ug');
    const r = await tokenFor(roomId, member.token);
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'NOT_IN_ROOM');
  });

  test('tokens are short-lived (10 minutes)', async () => {
    const claims = decodeToken((await tokenFor(roomId, adminToken)).json.token);
    assert.equal(claims.exp - claims.nbf, 600);
  });

  test('waiting room, approval, mute and demotion decide who may publish', async () => {
    const hostSocket = await joinRoom(roomId, adminToken);
    await hostSocket.waitForRoom((r) => r.participants.some((p) => p.userId === adminId));

    // The host (admin) may publish everything.
    const host = await tokenFor(roomId, adminToken);
    assert.equal(host.status, 200);
    assert.equal(host.json.canPublish, true);
    assert.deepEqual(
      [...decodeToken(host.json.token).video.canPublishSources].sort(),
      ['camera', 'microphone', 'screen_share', 'screen_share_audio'],
    );

    // A member waits outside until the host lets them in: no token yet.
    const member = await register(server.base, 'waiting@kab.ac.ug');
    const memberSocket = await joinRoom(roomId, member.token);
    await hostSocket.waitForRoom((r) => r.waitingRoom.some((w) => w.userId === member.user.id));
    const waiting = await tokenFor(roomId, member.token);
    assert.equal(waiting.status, 403);
    assert.equal(waiting.json.code, 'WAITING');

    // Admitted, but not a speaker: may watch and listen, may not publish.
    hostSocket.send('room:admit_guest', { clientId: memberSocket.clientId });
    await memberSocket.waitForRoom((r) => r.participants.some((p) => p.userId === member.user.id));
    const viewer = await tokenFor(roomId, member.token);
    assert.equal(viewer.status, 200);
    assert.equal(viewer.json.canPublish, false);
    assert.equal(decodeToken(viewer.json.token).video.canPublish, false);
    assert.deepEqual(decodeToken(viewer.json.token).video.canPublishSources ?? [], []);

    // Host approves the raised hand: now the member may publish.
    hostSocket.send('room:approve_speaker', { clientId: memberSocket.clientId });
    await memberSocket.waitForRoom((r) => r.participants.some((p) => p.userId === member.user.id && p.isSpeaker));
    const speaker = await tokenFor(roomId, member.token);
    assert.equal(speaker.json.canPublish, true);
    assert.ok(decodeToken(speaker.json.token).video.canPublishSources.includes('microphone'));

    // Host mutes them: camera and screen stay, the microphone permission is gone.
    hostSocket.send('room:mute_peer', { clientId: memberSocket.clientId });
    await memberSocket.waitForRoom((r) => r.participants.some((p) => p.userId === member.user.id && p.mutedByHost));
    const muted = decodeToken((await tokenFor(roomId, member.token)).json.token);
    assert.equal(muted.video.canPublish, true);
    assert.ok(!muted.video.canPublishSources.includes('microphone'));
    assert.ok(muted.video.canPublishSources.includes('camera'));

    // Host sends them back to the audience: no publishing again.
    hostSocket.send('room:demote_speaker', { clientId: memberSocket.clientId });
    await memberSocket.waitForRoom((r) => r.participants.some((p) => p.userId === member.user.id && !p.isSpeaker));
    const demoted = await tokenFor(roomId, member.token);
    assert.equal(demoted.json.canPublish, false);
  });

  test('a member cannot approve themselves as a speaker', async () => {
    const member = await register(server.base, 'selfapprove@kab.ac.ug');
    const hostSocket = await joinRoom(roomId, adminToken);
    const memberSocket = await joinRoom(roomId, member.token);
    await hostSocket.waitForRoom((r) => r.waitingRoom.some((w) => w.userId === member.user.id));
    hostSocket.send('room:admit_guest', { clientId: memberSocket.clientId });
    await memberSocket.waitForRoom((r) => r.participants.some((p) => p.userId === member.user.id));

    memberSocket.send('room:approve_speaker', { clientId: memberSocket.clientId });
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(memberSocket.inbox.some((m) => m.event === 'error'), 'server should answer with an error');
    assert.equal((await tokenFor(roomId, member.token)).json.canPublish, false);
  });

  test('a shared slide (about 300 KB) travels over the websocket without dropping the connection', async () => {
    const hostSocket = await joinRoom(roomId, adminToken);
    await hostSocket.waitForRoom((r) => r.participants.some((p) => p.userId === adminId));
    const slide = `data:image/jpeg;base64,${'A'.repeat(300_000)}`;
    hostSocket.send('room:media_state', { sharedSlideUrl: slide });
    await hostSocket.waitForRoom((r) => r.participants.some((p) => p.userId === adminId && p.sharedSlideUrl === slide));
    assert.ok(hostSocket.open, 'connection should still be open');
  });

  test('after the host ends the session, no new tokens are issued', async () => {
    const hostSocket = await joinRoom(roomId, adminToken);
    await hostSocket.waitForRoom((r) => r.participants.some((p) => p.userId === adminId));
    hostSocket.send('room:end_for_all', {});
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await tokenFor(roomId, adminToken)).status, 409);
  });
});

describe('video tokens (no media server configured)', () => {
  let server: RunningServer;

  before(async () => {
    server = await startServer({});
  });

  after(() => server?.stop());

  test('the app runs, and the token route says video is not configured instead of failing', async () => {
    const health = await fetch(`${server.base}/api/health`);
    assert.equal(health.status, 200);

    const claimed = await call(server.base, 'POST', '/api/auth/claim-admin', {
      password: 'longpassword1',
      setupCode: server.setupCode,
    });
    const r = await call(server.base, 'POST', '/api/sessions/sess-ml-python/video-token', undefined, claimed.json.accessToken);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.configured, false);
    assert.match(r.json.message, /not configured/i);
    assert.equal(r.json.token, undefined);
  });

  test('access rules still apply first: signed-out people get a 401', async () => {
    const r = await call(server.base, 'POST', '/api/sessions/sess-ml-python/video-token');
    assert.equal(r.status, 401);
  });
});
