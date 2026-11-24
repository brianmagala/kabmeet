# PROMPT.md: Kabmeet shared work file

This file is the communication link between the **Master** (Claude, planner and approver), any **Executor** model that Brian brings in, and **Brian** (project owner, validator).

Brian starts every round by telling an executor: *"Read PROMPT.md, analyze it as well as you can, and do the next open task."* Nothing runs unless Brian says so.

---

## 1. How this file works

1. **Master** writes tasks in section 6 and keeps section 5 (status) current.
2. **Executor** reads this whole file, picks the first task marked `OPEN`, works on it on its own branch (`task-<number>-<short-name>`), then writes its report in section 8. It does **not** edit sections 1 to 7, except to change the status word of its own task.
3. **Master** reads section 8, checks the work against the acceptance list (section 7), then marks the task `VERIFIED`, `REWORK` (with reasons) or `REJECTED`, and adds the next tasks.
4. **Brian** is the gate. A task is finished only when the Master marks it `VERIFIED`.

Status words: `OPEN` > `IN PROGRESS` > `READY FOR REVIEW` > `VERIFIED` (or `REWORK`).

If anything here is unclear or looks wrong, **say so in section 8 and stop**. Do not guess on security, roles or data.

---

## 2. The project

**Kabmeet** is the live-session platform of the Kabale AI Club / IndabaX site (`ai.kab.ac.ug/indabax`), hosted on the university's own servers.

**Problem:** students, lecturers and clubs run their sessions on Google Meet or Zoom, so people leave our site and have to juggle links and logins.
**Solution:** one site, one login, where people can:
- find live sessions (YouTube Live style: live list, watch page, top chat, stickers, polls, Q&A),
- join interactive rooms (Google Meet style: camera, mic, screen share, raise hand, host controls, waiting room),
- run communities that host sessions,
- hold private virtual classes with attendance,
- work together in a shared workspace (notes, tasks, code).

**Standing rule from Brian:** never mention or compare with any existing university e-learning platform, in code, comments, UI text or docs. Treat them as if they never existed.

**Quality bar:** it must look and feel human-made, not generated. No filler copy, no lorem ipsum, no generic template look. Real Kabale content, real labels.

---

## 3. Design rules (do not break)

- **Colors:** use the CSS tokens only, never raw hex inside components. Palette: Indaba Deep Green `#065A4B`, Signal Green `#00E676`, KAB Blue `#0072BB`, Sun Yellow `#F5EC1E`, Amber Gold `#F6A623`, Live Red `#E5484D` (LIVE badge only), Night Forest `#0A1F1A`, Mist `#F2F7F5`, Line `#D5E3DE`. These hex values were read by eye from screenshots, so verify against the live pages in DevTools and correct the tokens if they differ.
- **Fonts:** Oswald for headings, Poppins for body.
- **Shape:** pill buttons, 12px cards, 8px spacing grid. Icons: `lucide-react`, one stroke width.
- **No emojis in the UI chrome** (see `kabmeet/.github/copilot-instructions.md`). The one exception is the chat reaction and sticker set, which is content, not chrome.
- **Never rely on color alone.** Pair status colors with a word or an icon.
- **Both light and dark theme** must work. Respect `prefers-reduced-motion`.
- **Phone first:** must work at 360px width. Many users are on phones and weak networks.

## 4. Engineering rules (do not break)

- Every role and private-class check is enforced **on the server** (`server.ts`, `server/ws.ts`). The client only hides buttons.
- No secrets in git. `.env` stays out of the repo.
- Validate every input with `zod` on the server. Cap sizes.
- Small commits, one purpose each. Message format: `Phase X: what changed`.
- Before you report: `npx tsc --noEmit` and `npx vite build` must pass, and you must have run the feature yourself. Say in section 8 what you ran, and what you could **not** run.
- Install with `bun install` (npm hits a peer-dependency conflict).
- Do not claim something works if you did not run it. Half-done is fine; write it down honestly.

---

## 5. Status (kept by the Master)

**Reviewed on 2026-11-24 (Master).** I read the server (`server.ts`, `server/auth.ts`), the auth/session paths, the websocket layer's role checks, the page and component list, and ran typecheck and build (both pass). I did not read every page line by line, and I did not click through the UI in a browser.

**What exists and looks sound**
- Passwords hashed with scrypt, sign-in tokens stored hashed, zod validation on routes, role checks in the websocket for host/staff actions.
- Pages: Discover, Watch, Room, Classes, Communities, Host Panel, Admin, Profile, Auth. Chat, polls, Q&A, reactions, notes/tasks/code pad, attendance, CSV export, PWA, Data Saver, offline indicator.
- A custom loader (`KabmeetLoader.tsx`: Signal Prism, loading card, top network bar) is already wired into the app shell and pages.

**Browser debug run, 2026-11-24 (Master, Playwright, desktop 1280px and phone 360px, two browsers in one room with fake cameras).**
Worked: first-admin setup through the UI, sign-in, every top-nav page loads with no JavaScript errors, no horizontal overflow, phone bottom nav present, Watch page chat sends and appears, websocket connects, waiting room holds a member until the host admits them, a member who presses Cam is told to raise a hand first, host controls and People list show.
Confirmed bugs:
- **Video is not shared.** With both people in the room and the admin's camera on, the admin sees their own video, but the second person sees only a "KA, Video active" placeholder. Nothing reaches other browsers (Task 1).
- **Refresh logs you out and the URL never changes** (always `/`). The sign-in token is kept in memory only, and routing is a state variable. So refresh, the Back button and shared links to a session all fail (Task 7).
- **Websocket sign-in token is sent in the URL** (`/ws?sessionId=..&token=..`), which ends up in server and proxy logs. The server already accepts the token in a message; use that instead (Task 8).
- **Fonts load from Google Fonts.** On campus bandwidth, or with Google blocked, headings fall back to Arial. Self-host Oswald, Poppins and JetBrains Mono (Task 8).
Not tested: a real slow network, the loader stages, Classes attendance by a real student, Admin page actions, the PWA offline mode.

**Problems found**
1. **No real video between people.** `RoomPage.tsx` uses `getUserMedia` / `getDisplayMedia` for the person's *own* camera and screen only. There is no WebRTC, no media server, no signalling. Other participants appear as presence tiles, not video. The README's "Phase 3 done" overstates this. This is the biggest gap.
2. **Data lives in a JSON file** (`data/`, via `server/store.ts`). Fine for a demo, not safe for real use (no concurrent writes, no backups, whole-file saves).
3. **Two codebases.** The working app is at the repo root. The `kabmeet/` folder is a monorepo skeleton (mostly READMEs and config, a placeholder Next.js app) that nothing uses. It misleads readers and the README describes both as real.
4. **README claims more than is built** (all phases ticked).
5. The first-admin screen let whoever reached a fresh server first become admin; there was no rate limiting on sign-in; IDs were `Date.now()` based; the sign-in token list was capped at 200 across all users. (Fixed in Phase A, below.)
6. Emoji rule in `copilot-instructions.md` and the emoji-heavy README disagree (see rule in section 3).

**Done so far (branches)**
- `phase-a-hardening`: first-admin setup now needs a one-time setup code (printed on first start, or `ADMIN_SETUP_CODE`); rate limits on sign-in, register and admin setup; security headers; random IDs; per-user token cap; websocket message size limit; placeholder person name removed from the admin form. Tested: wrong code is refused, right code works, the 11th sign-in attempt returns 429.
- `phase-b-hygiene` (on top of A): `.env.example` rewritten for Kabmeet (it was an AI Studio template), package renamed from `react-example` to `kabmeet`, unused Gemini SDK and its capability flag removed.

**Not pushed yet.** At the time of writing, the Master's GitHub access for this repo was refused (403), so both branches exist only in the Master's working copy until Brian fixes the GitHub connection. If you can see this file, the branches were pushed; check `git branch -a`.

**Half-baked / still to do**
- Everything in section 6.
- Loader kit: a separate, richer set (Beacon, Thread, pill pulse, signal bars, top thread, shimmer, hop dots, lens) was designed in the Kabmeet Loading Kit page. It is not yet compared with `KabmeetLoader.tsx`; see Task 4.

---

## 6. Task queue (kept by the Master)

### Task 1: Real video behind an adapter (`OPEN`, highest value)
**Goal:** people in a Room see and hear each other, and screen shares reach everyone.
**Approach:** self-hosted **LiveKit** (runs on university servers, free), behind a small interface so the provider can change.
1. Create `server/video.ts` with `createRoomToken({ sessionId, user, canPublish })` using `livekit-server-sdk`. Role rules come from the existing server checks: HOST/MODERATOR/LECTURER/ADMIN/SPEAKER may publish; MEMBER may publish only after the host approves (raise hand); class rooms are allowed only for people on the allowlist.
2. Add `POST /api/sessions/:id/video-token` (auth required, uses `canUserAccessSession`). Short expiry (10 minutes).
3. In `RoomPage.tsx`, replace local-only tiles with LiveKit tracks (`livekit-client`): grid for up to ~12 visible tiles, active-speaker highlight, mic/cam/screen-share toggles wired to real tracks. Keep the existing waiting room, raise-hand and host controls working (they live in `server/ws.ts`).
4. Add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` to `.env.example`. If they are not set, the Room must say clearly "Video is not configured on this server" and still allow chat. No crash.
5. Add `infra/livekit/` with a minimal `livekit.yaml` and a compose snippet. Document the ports and the TURN requirement for campus networks in `docs/DEPLOYMENT.md`.
6. Data Saver: when on, subscribe to audio only (and low quality video if turned on).
**Acceptance:** two browsers on two machines see each other and a shared screen; a MEMBER cannot publish before approval (test by calling the token endpoint as a member and confirming `canPublish: false`); tokens are refused for people outside a private class; app still runs with no LiveKit configured; typecheck and build pass.
**Also:** report honestly what you could not test (for example real campus network conditions).

### Task 2: Replace the JSON file store (`OPEN`)
**Goal:** safe, real storage.
1. Pick **SQLite via Prisma** first (no extra server to run), written so that switching the provider to PostgreSQL is one line.
2. Move users, tokens, sessions, communities, attendance, reports, audit log. Keep chat/polls in memory with periodic flush if simpler, but attendance and audit must be durable.
3. Write a one-time import from the existing `data/` JSON so nothing is lost.
4. Keep the same API shapes so the client does not change.
**Acceptance:** restart keeps data; two simultaneous registrations both succeed; typecheck and build pass; migration steps in `docs/DEPLOYMENT.md`.

### Task 3: Repo cleanup, one codebase (`OPEN`, needs Brian's decision first)
Recommended: keep the root app as the product. Move `docs/` content that is still true to the root `docs/`, delete the unused `kabmeet/` skeleton, and rewrite the README so every claim matches what is built (tick only what runs). If Brian prefers the monorepo, the Master will write a migration plan first. **Do not start this task until the Master changes it to `OPEN-APPROVED`.**

### Task 4: Loading kit alignment (`OPEN`)
1. Read `src/components/KabmeetLoader.tsx` and the hooks in `KabmeetContext.tsx` that decide slow requests.
2. Make the staging match these rules: nothing under 0.4 s; loader after 0.4 s; plain notice "Your connection is slow. Still trying." at 3 s; at 8 s offer audio only / Data Saver; at 20 s stop, show a Try again button and keep the existing content; offline shows a banner and queues chat sends.
3. Add the seven moment-specific loaders where they fit: Beacon (page), Thread (joining a session), pill pulse (buttons, blocks double clicks), signal bars with a text label (room header), top thread (route change), card shimmer (lists), hop dots (chat sending), lens (camera starting). Keep or retire the existing Signal Prism, but do not show two different "main" loaders.
4. Everything uses the tokens and respects `prefers-reduced-motion`.
**Acceptance:** throttle the network in browser DevTools to Slow 3G and screenshot each stage; typecheck and build pass.

### Task 5: Tests for the rules that matter (`VERIFIED`, done by the Master; extend it)
`tests/api.test.ts` (run `npm test`, 7 tests passing) now covers: setup code, register forces MEMBER, members cannot change roles or create sessions/classes, private classes, sign-in rate limit; CI runs it from `.github/workflows/ci.yml`. Executors: add a test for every rule you add. Still to add: MEMBER cannot publish video (after Task 1), websocket role checks. Original list was: register forces MEMBER; non-admin cannot change roles; MEMBER cannot publish video; private class refuses non-allowlisted users; setup code required for the first admin; rate limit returns 429. Add a `npm test` script and run it in CI (`.github/workflows`).

### Task 6: Attendance you can trust (`OPEN`)
Check how join/leave and active minutes are measured (`/api/classes/:id/attendance/ping`). Fix double counting from multiple tabs, and make the CSV export include join time, leave time, minutes and the student's university ID. Add a test.

### Task 7: Real URLs and staying signed in (`OPEN`)
1. Add URL routing (`/`, `/communities`, `/watch/:id`, `/room/:id`, `/classes`, `/host`, `/profile`, `/admin`, `/auth`) so refresh, Back and shared links work. The Nginx/Express fallback to `index.html` already exists.
2. Keep people signed in across refresh. Preferred: an `httpOnly`, `SameSite=Lax`, `Secure` cookie session set by the login routes and read by `resolveAuthUser`, with CSRF protection on state-changing routes. Do not put the token in `localStorage`.
3. Test: refresh keeps you signed in and on the same page; signing out clears it; a private class link opened signed out sends you to sign in, then back.

### Task 8: Small fixes found in the debug run (`OPEN`)
1. Websocket: authenticate with a first message, not the URL query. Keep working for the existing client during the change.
2. Self-host the three font families (woff2 in `public/fonts`, `font-display: swap`) and remove the Google Fonts link. Keep real fallback stacks.
3. Class, session, audit and message IDs: use `randomUUID()`.

### Later (Master will open when ready)
Broadcast mode for 150+ viewers (HLS for the audience), live captions (Whisper), host analytics, notification emails, accessibility audit, load test with `k6`.

---

## 7. Review checklist (what the Master checks before `VERIFIED`)

- [ ] Server enforces the rule, not just the UI.
- [ ] Input validated and capped; no secrets committed.
- [ ] Works at 360px, light and dark, reduced motion.
- [ ] Uses tokens and the two fonts; looks hand-made.
- [ ] `npx tsc --noEmit` and `npx vite build` pass.
- [ ] The executor states what it ran and what it could not run.
- [ ] Commits are small and clearly named.
- [ ] README and docs claim only what actually works.

---

## 8. Executor reports (executors write below this line)

Use this template, newest report on top. Be honest and specific.

```
### Report: Task <n>, <date>, <model name>
Branch: task-<n>-<name>
Done:
- ...
Half-done (and exactly where I stopped):
- ...
Could not run / not verified:
- ...
Problems or things that look wrong elsewhere:
- ...
Suggestions:
- ...
Ready for review: yes / no
```

(no reports yet)

---

## 9. Master notes and decisions log

- 2026-11-24: Phases A and B are on `main`. Phase C (tests plus root CI) added by the Master. Known small issue for any executor: class and session IDs use `Date.now()` and can collide; switch them to `randomUUID()` (and the same for audit/message IDs).
- 2026-11-24: Master reviewed the repo, applied Phases A and B, and wrote this file. Open decision for Brian: Task 3 (keep one codebase at the root, recommended).
