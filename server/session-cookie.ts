// Cookie sign-in for the browser app.
//
// Two cookies are set when someone signs in:
//   kab_session  httpOnly, SameSite=Lax, Secure on https. Holds the sign-in token. JavaScript cannot read it.
//   kab_csrf     SameSite=Lax, Secure on https. A random value the app copies into the X-CSRF-Token header.
//
// A browser sends cookies to our site even when a page on another site triggers the request. So every
// state-changing request that is authenticated by cookie must (1) come from our own origin and
// (2) carry an X-CSRF-Token header equal to the kab_csrf cookie. A page on another site can do neither.
// Requests that use an "Authorization: Bearer" header (tests, scripts) are not affected: browsers never
// attach that header by themselves.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { NextFunction, Request, Response } from 'express';

export const SESSION_COOKIE = 'kab_session';
export const CSRF_COOKIE = 'kab_csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** These routes create the session, so there is no CSRF value to send yet. The origin check still applies. */
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/claim-admin']);

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      /* ignore a cookie we cannot decode */
    }
  }
  return out;
}

export function sessionTokenFromCookies(headers: IncomingHttpHeaders): string | null {
  const value = parseCookies(headers.cookie)[SESSION_COOKIE];
  return value && value.length > 0 ? value : null;
}

function isHttps(req: Request): boolean {
  // `trust proxy` is set in server.ts, so req.secure follows X-Forwarded-Proto from our reverse proxy.
  return req.secure || process.env.COOKIE_SECURE === '1';
}

function serialize(name: string, value: string, req: Request, opts: { httpOnly: boolean; maxAgeSeconds: number }): string {
  // COOKIE_SAMESITE=none is for a Kabmeet address on a different registrable domain than the site that frames it.
  // Browsers only accept SameSite=None together with Secure, so it is used only when the request is https.
  const wantsNone = process.env.COOKIE_SAMESITE?.toLowerCase() === 'none' && isHttps(req);
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `Max-Age=${opts.maxAgeSeconds}`, wantsNone ? 'SameSite=None' : 'SameSite=Lax'];
  if (opts.httpOnly) parts.push('HttpOnly');
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

export function setSessionCookies(req: Request, res: Response, rawToken: string, expiresAt: string): void {
  const maxAgeSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  res.append('Set-Cookie', serialize(SESSION_COOKIE, rawToken, req, { httpOnly: true, maxAgeSeconds }));
  res.append(
    'Set-Cookie',
    serialize(CSRF_COOKIE, randomBytes(32).toString('hex'), req, { httpOnly: false, maxAgeSeconds }),
  );
}

/** Gives a signed-in browser a fresh CSRF value if it lost the cookie (the session cookie is still valid). */
export function ensureCsrfCookie(req: Request, res: Response, expiresAt: string): void {
  if (parseCookies(req.headers.cookie)[CSRF_COOKIE]) return;
  const maxAgeSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  res.append(
    'Set-Cookie',
    serialize(CSRF_COOKIE, randomBytes(32).toString('hex'), req, { httpOnly: false, maxAgeSeconds }),
  );
}

export function clearSessionCookies(req: Request, res: Response): void {
  res.append('Set-Cookie', serialize(SESSION_COOKIE, '', req, { httpOnly: true, maxAgeSeconds: 0 }));
  res.append('Set-Cookie', serialize(CSRF_COOKIE, '', req, { httpOnly: false, maxAgeSeconds: 0 }));
}

/** True when an Origin header (if any) names the same host the request was sent to. */
export function isSameOrigin(
  originHeader: string | undefined,
  hostHeader: string | undefined,
  forwardedHost?: string | string[] | undefined,
): boolean {
  if (!originHeader) return true; // Browsers always send Origin on cross-site writes; its absence means same-origin or a non-browser.
  // Many proxies (nginx without `proxy_set_header Host $host`) replace Host with the app's own address,
  // so the public name arrives in X-Forwarded-Host. We trust one proxy hop, as server.ts says.
  const forwarded = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0]?.trim();
  const allowed = [hostHeader, forwarded].filter((h): h is string => Boolean(h));
  if (allowed.length === 0) return false;
  try {
    return allowed.includes(new URL(originHeader).host);
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Mount on /api. Refuses cross-site and token-less writes that rely on the session cookie. */
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  const usesBearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
  if (usesBearer) return next();

  const cookies = parseCookies(req.headers.cookie);
  if (!cookies[SESSION_COOKIE] && !CSRF_EXEMPT_PATHS.has(req.originalUrl.split('?')[0])) return next(); // nothing to forge

  if (!isSameOrigin(req.headers.origin, req.headers.host, req.headers['x-forwarded-host'])) {
    res.status(403).json({ code: 'CSRF', message: 'This request came from another site and was refused.' });
    return;
  }
  if (CSRF_EXEMPT_PATHS.has(req.originalUrl.split('?')[0])) return next();

  const header = req.headers[CSRF_HEADER];
  const sent = typeof header === 'string' ? header : '';
  const expected = cookies[CSRF_COOKIE] ?? '';
  if (!sent || !expected || !safeEqual(sent, expected)) {
    res.status(403).json({ code: 'CSRF', message: 'Your session check failed. Reload the page and try again.' });
    return;
  }
  next();
}
