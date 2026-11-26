// Task 7: the address bar rules (pure functions, no server needed).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPath, parsePath, safeReturnPath } from '../src/lib/routes';

describe('parsePath', () => {
  test('knows every screen', () => {
    assert.deepEqual(parsePath('/'), { route: 'discover' });
    assert.deepEqual(parsePath('/communities'), { route: 'communities', communitySlug: null });
    assert.deepEqual(parsePath('/communities/kab-ai'), { route: 'communities', communitySlug: 'kab-ai' });
    assert.deepEqual(parsePath('/watch'), { route: 'watch' });
    assert.deepEqual(parsePath('/watch/sess-ml-python'), { route: 'watch', sessionId: 'sess-ml-python' });
    assert.deepEqual(parsePath('/room/abc_123'), { route: 'room', sessionId: 'abc_123' });
    assert.equal(parsePath('/classes')?.route, 'classes');
    assert.equal(parsePath('/host')?.route, 'host-panel');
    assert.equal(parsePath('/profile')?.route, 'profile');
    assert.equal(parsePath('/admin')?.route, 'admin');
    assert.equal(parsePath('/auth')?.route, 'auth');
    assert.equal(parsePath('/leaderboard')?.route, 'leaderboard');
    assert.equal(parsePath('/events')?.route, 'events');
    assert.deepEqual(parsePath('/events/indabax-kabale-day'), { route: 'event', eventSlug: 'indabax-kabale-day' });
  });

  test('ignores a trailing slash and rejects unknown or malformed addresses', () => {
    assert.equal(parsePath('/classes/')?.route, 'classes');
    assert.equal(parsePath('/nonsense'), null);
    assert.equal(parsePath('/room'), null);
    assert.equal(parsePath('/room/a/b'), null);
    assert.equal(parsePath('/room/%E0%A4%A'), null);
    assert.equal(parsePath('/room/<script>'), null);
    assert.equal(parsePath('/admin/extra'), null);
  });
});

describe('buildPath', () => {
  test('is the inverse of parsePath', () => {
    for (const path of ['/', '/communities', '/communities/kab-ai', '/watch', '/watch/s1', '/room/s1', '/classes', '/host', '/profile', '/admin', '/auth', '/leaderboard', '/events', '/events/indabax-kabale-day']) {
      const parsed = parsePath(path)!;
      assert.equal(
        buildPath(parsed.route, { sessionId: parsed.sessionId, communitySlug: parsed.communitySlug, eventSlug: parsed.eventSlug }),
        path,
      );
    }
  });
});

describe('safeReturnPath', () => {
  test('accepts our own screens only', () => {
    assert.equal(safeReturnPath('/room/s1'), '/room/s1');
    assert.equal(safeReturnPath('/classes'), '/classes');
  });
  test('refuses other sites, protocol-relative links, the sign-in screen and junk', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', '/auth', '/nope', '', null, undefined, 'javascript:alert(1)']) {
      assert.equal(safeReturnPath(bad as string | null | undefined), null, String(bad));
    }
  });
});

describe('sign-in return targets for new screens', () => {
  test('the leaderboard needs an account, events do not', async () => {
    const { SIGN_IN_ROUTES } = await import('../src/lib/routes');
    assert.ok(SIGN_IN_ROUTES.has('leaderboard'));
    assert.ok(!SIGN_IN_ROUTES.has('events'));
    assert.ok(!SIGN_IN_ROUTES.has('event'));
    assert.equal(safeReturnPath('/events/indabax-kabale-day'), '/events/indabax-kabale-day');
  });
});

describe('same-origin check behind a proxy', () => {
  test('accepts the public name from X-Forwarded-Host when the proxy rewrote Host, and still refuses other sites', async () => {
    const { isSameOrigin } = await import('../server/session-cookie');
    assert.equal(isSameOrigin('https://meet.kab.ac.ug', '127.0.0.1:3000', 'meet.kab.ac.ug'), true);
    assert.equal(isSameOrigin('https://meet.kab.ac.ug', 'meet.kab.ac.ug'), true);
    assert.equal(isSameOrigin('https://evil.example', '127.0.0.1:3000', 'meet.kab.ac.ug'), false);
    assert.equal(isSameOrigin('https://evil.example', 'meet.kab.ac.ug'), false);
    assert.equal(isSameOrigin('not a url', 'meet.kab.ac.ug'), false);
    assert.equal(isSameOrigin(undefined, 'meet.kab.ac.ug'), true);
  });
});

