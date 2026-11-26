# Deploying Kabmeet

## 1. The app
1. `bun install`
2. Copy `.env.example` to `.env` and fill it in.
3. `npx vite build`, then `NODE_ENV=production npx tsx server.ts`.
4. First start prints a one-time admin setup code (or set `ADMIN_SETUP_CODE`).

## 2. Video (LiveKit)
Kabmeet works without video: Rooms show "Video is not configured on this server" and chat, hands and the workspace still run. To turn video on:

1. Start LiveKit: edit `infra/livekit/livekit.yaml` (key pair, TURN domain, certificate paths), then `docker compose -f infra/livekit/docker-compose.yml up -d`.
2. In Kabmeet's `.env` set `LIVEKIT_URL` (the `wss://` address browsers use), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Restart Kabmeet.
3. Put LiveKit's signalling port behind HTTPS (reverse proxy `wss://video.example.ac.ug` to port 7880). Browsers only allow camera, microphone and screen capture on HTTPS.

### Ports to open on the LiveKit server
| Port | Protocol | Use |
|---|---|---|
| 7880 | TCP | Signalling (behind the HTTPS proxy) |
| 7881 | TCP | Media fallback when UDP is blocked |
| 50000-50200 | UDP | Media |
| 3478 | UDP | TURN |
| 5349 | TCP | TURN over TLS |

### Why TURN matters on campus
University networks often block UDP and unusual ports. Without TURN, students on those networks see a black tile or never connect. TURN over TLS on port 5349 (or 443 if you can spare it) looks like normal HTTPS and gets through most firewalls. Test from a real campus Wi-Fi and a phone on mobile data before the first class.

### What the server decides
- A join token lasts 10 minutes and is only needed to connect.
- Hosts, moderators, lecturers, admins and SPEAKER accounts may publish. A member may publish only after the host approves their raised hand; the host can mute them or send them back to the audience at any time, and the media server is told straight away.
- People waiting in the waiting room, and people outside a private class, get no token.
- Capacity: plan roughly 50 viewers and up to 12 publishers per room on a 4-core server; measure before relying on it.

## 3. Sign-in cookies and the reverse proxy
The browser app stays signed in with two cookies: `kab_session` (httpOnly, `SameSite=Lax`, holds the sign-in token) and `kab_csrf` (readable by the page, checked on every write). Behind Nginx or Caddy:
- Send `X-Forwarded-Proto: https` and `Host`, and pass `Origin` through unchanged. Kabmeet trusts one proxy hop (`trust proxy 1`), and uses the proto header to add the `Secure` flag.
- Without that header the cookies are sent without `Secure` (fine for local http, wrong for production). `COOKIE_SECURE=1` forces the flag.
- Cookie sign-in is accepted on the websocket only when the `Origin` header matches the site, so another website cannot open a socket as a signed-in person.
- Requests that use an `Authorization: Bearer` header (scripts, tests) are unaffected.

## 4. Embedding Kabmeet in ai.kab.ac.ug/indabax

Kabmeet is meant to be shown inside the club site. Three things must be right, or sign-in, camera, microphone or screen share will silently fail.

1. **Allow the framing site.** Kabmeet only lets itself be framed by the origins in `EMBED_ORIGINS` (default `https://ai.kab.ac.ug`). It sends `Content-Security-Policy: frame-ancestors 'self' <origins>`. Add more sites separated by spaces, origin only (no path).
2. **Delegate the devices in the iframe tag** on the club page. Without `allow`, the browser blocks camera, microphone and screen share inside an iframe, and Kabmeet cannot do anything about it:

   ```html
   <iframe
     src="https://meet.kab.ac.ug/"
     title="Kabmeet live sessions"
     allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
     style="width:100%; height:90vh; border:0"
     loading="lazy"></iframe>
   ```

   To open a specific page, put it in `src`, for example `https://meet.kab.ac.ug/watch/sess-ml-python` or `/events/indabax-kabale-day`. Kabmeet's address changes happen inside the iframe, so refreshing the club page returns to the `src` page.
3. **Keep both sites on one registrable domain.** Put Kabmeet on a `kab.ac.ug` address (for example `meet.kab.ac.ug`, or `ai.kab.ac.ug/kabmeet` through the reverse proxy). Then the browser treats the iframe as the same site and the sign-in cookie works. If Kabmeet must live on another domain, set `COOKIE_SAMESITE=none` (needs https). Some browsers still block third-party cookies by default, so expect sign-in problems there; the same-domain setup is the reliable one.

The page serving Kabmeet must be https. Browsers refuse camera and screen capture on plain http, inside or outside an iframe.

